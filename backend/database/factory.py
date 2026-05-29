from typing import Any, Dict, Optional
import urllib.parse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from backend.config import settings
from backend.utils.encryption import decrypt_payload
from backend.utils.logging import logger

_LOCALHOST_ALIASES = {"localhost", "127.0.0.1", "::1"}

class BaseDBConfig(BaseModel):
    """Base Pydantic model for database connection configurations."""
    host: str = "127.0.0.1"
    port: int = 5432
    database: str
    username: str
    password: str
    target_db: str = Field("postgresql", alias="targetDb")

    model_config = {
        "populate_by_name": True,
        "extra": "ignore"
    }

class PostgreSQLConfig(BaseDBConfig):
    """PostgreSQL connection configuration."""
    port: int = 5432

class MySQLConfig(BaseDBConfig):
    """MySQL connection configuration."""
    port: int = 3306

def _resolve_host(host: str, target_db: str) -> str:
    """Remaps localhost to docker host aliases inside Docker.

    Args:
        host: Host name.
        target_db: Name of target DB dialect.

    Returns:
        str: Resolved host name.
    """
    if host.strip().lower() not in _LOCALHOST_ALIASES:
        return host

    db = target_db.lower()
    if db == "mysql":
        docker_host = settings.MYSQL_DOCKER_HOST
        if docker_host:
            logger.info(f"Remapping target host '{host}' to '{docker_host}' via Settings")
            return docker_host
    elif db in ("postgresql", "postgres", "redshift"):
        docker_host = settings.POSTGRES_DOCKER_HOST
        if docker_host:
            logger.info(f"Remapping target host '{host}' to '{docker_host}' via Settings")
            return docker_host

    return host

def get_decrypted_password(password: str) -> str:
    """Decrypts database passwords if encrypted.

    Args:
        password: Raw password.

    Returns:
        str: Decrypted password.
    """
    if not password:
        return ""
    if ":" in password:
        try:
            return decrypt_payload(password)
        except Exception:
            pass
    return password

def _resolve_connection_params(db_config: Dict[str, Any], override_port: Optional[int] = None) -> Dict[str, Any]:
    """Resolves database parameters from config.

    Args:
        db_config: Raw config dict.
        override_port: Optional port to override.

    Returns:
        dict: Resolved parameters dictionary.
    """
    cfg = BaseDBConfig(**db_config)
    target_db = cfg.target_db.lower()
    username = cfg.username
    password_raw = cfg.password
    password_decrypted = get_decrypted_password(password_raw)

    if override_port is not None:
        host = "127.0.0.1"
        port = override_port
    else:
        host = _resolve_host(cfg.host, target_db)
        port = cfg.port

    database = cfg.database

    return {
        "target_db": target_db,
        "username": username,
        "password": password_decrypted,
        "host": host,
        "port": port,
        "database": database
    }

def get_async_engine(db_config: Dict[str, Any], override_port: Optional[int] = None) -> AsyncEngine:
    """Retrieves an asynchronous engine instance.

    Args:
        db_config: Config dictionary.
        override_port: Optional port to override.

    Returns:
        AsyncEngine: SQLAlchemy asynchronous engine.
    """
    cfg = BaseDBConfig(**db_config)
    target_db = cfg.target_db.lower()
    if target_db in ("snowflake", "bigquery"):
        logger.info(
            f"Initializing {target_db.capitalize()} Cloud Warehouse sync connector. "
            "Simulating warehouse pipeline execution via PostgreSQL database...",
            host=settings.POSTGRES_SERVER,
            database=settings.POSTGRES_DB
        )
        connection_uri = str(settings.SQLALCHEMY_DATABASE_URI).replace("postgresql+psycopg", "postgresql+asyncpg")
        return create_async_engine(connection_uri)

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
    """Ensures that the target database exists.

    Args:
        db_config: Connection config.
        override_port: Port override.
    """
    cfg = BaseDBConfig(**db_config)
    target_db = cfg.target_db.lower()
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
