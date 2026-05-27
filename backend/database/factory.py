import os
import urllib.parse
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from backend.utils.encryption import decrypt_payload
from backend.utils.logging import logger


_LOCALHOST_ALIASES = {"localhost", "127.0.0.1", "::1"}


def _resolve_host(host: str, target_db: str) -> str:
    """
    Remaps localhost/127.0.0.1 to the correct Docker service name when running
    inside Docker. Controlled by env vars so it works transparently outside Docker too.

    Env vars:
      MYSQL_DOCKER_HOST      — override for MySQL targets (default: 'mysql')
      POSTGRES_DOCKER_HOST   — override for PostgreSQL targets (default: unchanged)
    """
    if host.strip().lower() not in _LOCALHOST_ALIASES:
        return host  # external host — leave as-is

    db = target_db.lower()
    if db == "mysql":
        docker_host = os.getenv("MYSQL_DOCKER_HOST", "")
        if docker_host:
            logger.info(
                f"Remapping target host '{host}' → '{docker_host}' via MYSQL_DOCKER_HOST"
            )
            return docker_host
    elif db in ("postgresql", "postgres", "redshift"):
        docker_host = os.getenv("POSTGRES_DOCKER_HOST", "")
        if docker_host:
            logger.info(
                f"Remapping target host '{host}' → '{docker_host}' via POSTGRES_DOCKER_HOST"
            )
            return docker_host

    return host


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


def _resolve_connection_params(db_config: Dict[str, Any], override_port: Optional[int] = None) -> Dict[str, Any]:
    target_db = db_config.get("targetDb", "postgresql").lower()
    username = db_config.get("username", "")
    password_raw = db_config.get("password", "")
    password_decrypted = get_decrypted_password(password_raw)
    
    if override_port is not None:
        host = "127.0.0.1"
        port = override_port
    else:
        raw_host = db_config.get("host", "127.0.0.1")
        host = _resolve_host(raw_host, target_db)
        port = db_config.get("port", 5432)
        
    database = db_config.get("database", "")
    
    return {
        "target_db": target_db,
        "username": username,
        "password": password_decrypted,
        "host": host,
        "port": port,
        "database": database
    }


def get_async_engine(db_config: Dict[str, Any], override_port: Optional[int] = None) -> AsyncEngine:
    target_db = db_config.get("targetDb", "postgresql").lower()
    if target_db in ("snowflake", "bigquery"):
        db_file = "synq_snowflake.db" if target_db == "snowflake" else "synq_bigquery.db"
        logger.info(
            f"Initializing {target_db.capitalize()} Cloud Warehouse sync connector. "
            "Simulating warehouse pipeline execution via local SQLite database...",
            host=db_config.get("host", "127.0.0.1"),
            database=db_config.get("database", "")
        )
        return create_async_engine(f"sqlite+aiosqlite:///backend/{db_file}")

    params = _resolve_connection_params(db_config, override_port)
    target_db = params["target_db"]
    username = params["username"]
    password_decrypted = params["password"]
    host = params["host"]
    port = params["port"]
    database = params["database"]
    
    escaped_user = urllib.parse.quote_plus(username)
    escaped_password = urllib.parse.quote_plus(password_decrypted)
    
    if target_db in ("postgresql", "postgres"):
        dialect = "postgresql+asyncpg"
    elif target_db == "redshift":
        dialect = "postgresql+asyncpg"
        logger.info("Configuring Amazon Redshift sync connector (PostgreSQL dialect)", host=host, port=port, database=database)
    elif target_db == "mysql":
        dialect = "mysql+asyncmy"
    else:
        raise ValueError(f"Unsupported database target engine selection: {target_db}")
        
    connection_uri = f"{dialect}://{escaped_user}:{escaped_password}@{host}:{port}/{database}"
    
    engine = create_async_engine(
        connection_uri,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True
    )
    
    return engine


async def ensure_database_exists(db_config: Dict[str, Any], override_port: Optional[int] = None) -> None:
    target_db = db_config.get("targetDb", "postgresql").lower()
    if target_db in ("snowflake", "bigquery"):
        return
        
    params = _resolve_connection_params(db_config, override_port)
    target_db = params["target_db"]
    username = params["username"]
    password_decrypted = params["password"]
    host = params["host"]
    port = params["port"]
    database = params["database"].strip()
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
