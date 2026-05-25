import contextlib
import io
import logging
import paramiko
from sshtunnel import SSHTunnelForwarder

# Mute noisy connection loggings from sshtunnel/paramiko
logging.getLogger("sshtunnel").setLevel(logging.WARNING)
logging.getLogger("paramiko").setLevel(logging.WARNING)


@contextlib.contextmanager
def ssh_tunnel_context(
    bastion_host: str,
    bastion_user: str,
    decrypted_pem_key: str,
    remote_db_host: str,
    remote_db_port: int,
    ssh_port: int = 22
):
    """
    Context manager to spin up an SSH tunnel through a bastion gateway to a remote database.
    Loads the private PEM key string purely in-memory and binds to a dynamic local port (127.0.0.1:0).
    Yields the local port to allow SQLAlchemy to connect.
    Guarantees cleanup of threads and sockets upon exit.
    """
    if not decrypted_pem_key:
        raise ValueError("Cannot establish SSH tunnel with empty PEM key content.")
        
    # Attempt to load the PEM key text stream as different key classes
    key_stream = io.StringIO(decrypted_pem_key.strip())
    pkey = None
    
    for key_class in (paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey, paramiko.DSSKey):
        try:
            key_stream.seek(0)
            pkey = key_class.from_private_key(key_stream)
            break
        except Exception:
            continue
            
    if not pkey:
        raise ValueError(
            "Could not parse private key. Ensure it is a valid, unencrypted PEM formatted key "
            "(RSA, Ed25519, ECDSA, or DSS)."
        )

    # Initialize the SSHTunnelForwarder with dynamic port allocation (port 0)
    tunnel = SSHTunnelForwarder(
        (bastion_host, ssh_port),
        ssh_username=bastion_user,
        ssh_private_key=pkey,
        remote_bind_address=(remote_db_host, int(remote_db_port)),
        local_bind_address=("127.0.0.1", 0),
        set_keepalive=15.0  # Keep connection alive during sync operations
    )
    
    try:
        # Start the tunnel process (running in a background thread)
        tunnel.start()
        # Yield the local port that maps to the destination database port
        yield tunnel.local_bind_port
    except Exception as e:
        raise ConnectionError(f"Failed to establish SSH bastion tunnel: {str(e)}") from e
    finally:
        # Explicit teardown to prevent zombie threads and socket port leaks
        if tunnel and tunnel.is_active:
            tunnel.stop()
