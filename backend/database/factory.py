import urllib.parse
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from backend.utils.encryption import decrypt_payload
from backend.utils.logging import logger


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


async def ensure_database_exists(db_config: Dict[str, Any], override_port: Optional[int] = None) -> None:
    target_db = db_config.get("targetDb", "postgresql").lower()
    username = db_config.get("username", "")
    password_raw = db_config.get("password", "")
    password_decrypted = get_decrypted_password(password_raw)
    
    if override_port is not None:
        host = "127.0.0.1"
        port = override_port
    else:
        host = db_config.get("host", "127.0.0.1")
        port = db_config.get("port", 5432)
        
    database = db_config.get("database", "").strip()
    if not database:
        return
        
    escaped_user = urllib.parse.quote_plus(username)
    escaped_password = urllib.parse.quote_plus(password_decrypted)
    
    if target_db in ("postgresql", "postgres"):
        dialect = "postgresql+asyncpg"
        default_db = "postgres"
    elif target_db == "mysql":
        dialect = "mysql+asyncmy"
        default_db = "mysql"
    else:
        return

    temp_uri = f"{dialect}://{escaped_user}:{escaped_password}@{host}:{port}/{default_db}"
    temp_engine = create_async_engine(temp_uri, isolation_level="AUTOCOMMIT")
    
    try:
        async with temp_engine.connect() as conn:
            if target_db in ("postgresql", "postgres"):
                result = await conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                    {"dbname": database}
                )
                exists = result.scalar() is not None
                if not exists:
                    safe_db_name = database.replace('"', '""')
                    await conn.execute(text(f'CREATE DATABASE "{safe_db_name}"'))
            elif target_db == "mysql":
                safe_db_name = database.replace('`', '``')
                await conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{safe_db_name}`"))
    except Exception as exc:
        logger.error(
            "Error while ensuring target database exists",
            database=database,
            error=str(exc)
        )
    finally:
        await temp_engine.dispose()
