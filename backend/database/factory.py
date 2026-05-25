import urllib.parse
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from backend.utils.encryption import decrypt_payload


def get_decrypted_password(password: str) -> str:
    """
    Decrypts the database password if it is encrypted.
    Otherwise returns the password as-is (for development and fallback support).
    """
    if not password:
        return ""
    if ":" in password:
        try:
            return decrypt_payload(password)
        except Exception:
            # Fall back to raw password if decryption raises an error
            pass
    return password


def get_async_engine(db_config: Dict[str, Any], override_port: Optional[int] = None) -> AsyncEngine:
    """
    Builds a SQLAlchemy 2.0 Asynchronous Engine dynamically based on the configuration dictionary.
    Handles credential decryption and formats the dialect URI using asyncpg or asyncmy.
    Configures strict pooling limits for heavy throughput workloads.
    """
    target_db = db_config.get("targetDb", "postgresql").lower()
    username = db_config.get("username", "")
    password_raw = db_config.get("password", "")
    password_decrypted = get_decrypted_password(password_raw)
    
    # If tunneling, database calls must point to localhost on the forwarded port
    if override_port is not None:
        host = "127.0.0.1"
        port = override_port
    else:
        host = db_config.get("host", "127.0.0.1")
        port = db_config.get("port", 5432)
        
    database = db_config.get("database", "")
    
    # Escape credentials to support passwords and usernames containing special characters
    escaped_user = urllib.parse.quote_plus(username)
    escaped_password = urllib.parse.quote_plus(password_decrypted)
    
    # Map configuration to async dialects
    if target_db in ("postgresql", "postgres"):
        dialect = "postgresql+asyncpg"
    elif target_db == "mysql":
        dialect = "mysql+asyncmy"
    else:
        raise ValueError(f"Unsupported database target engine selection: {target_db}")
        
    connection_uri = f"{dialect}://{escaped_user}:{escaped_password}@{host}:{port}/{database}"
    
    # Instantiate AsyncEngine with enterprise-grade pooling limits
    engine = create_async_engine(
        connection_uri,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True  # Automatically check connection health on checkouts
    )
    
    return engine
