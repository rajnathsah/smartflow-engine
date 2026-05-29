import contextlib

@contextlib.contextmanager
def ssh_tunnel_context(
    bastion_host: str,
    bastion_user: str,
    decrypted_pem_key: str,
    remote_db_host: str,
    remote_db_port: int,
    ssh_port: int = 22
):
    """Context manager for SSH tunneling.

    Args:
        bastion_host: Bastion host.
        bastion_user: Bastion user.
        decrypted_pem_key: Key string.
        remote_db_host: Database host.
        remote_db_port: Database port.
        ssh_port: SSH port.

    Raises:
        NotImplementedError: SSH Tunneling support has been removed.
    """
    raise NotImplementedError("SSH Bastion Tunneling support has been removed.")
