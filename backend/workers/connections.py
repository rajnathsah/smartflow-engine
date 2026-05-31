from abc import ABC, abstractmethod
from typing import Any, Dict
import urllib.parse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.pool import NullPool
from backend.utils.logging import logger

class BaseETLConnection(ABC):
    @abstractmethod
    def get_connection_uri(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> str:
        pass

    @abstractmethod
    async def create_database_if_not_exists(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> None:
        pass

    def create_engine(self, uri: str) -> AsyncEngine:
        return create_async_engine(
            uri,
            poolclass=NullPool
        )

class PostgresConnection(BaseETLConnection):
    def get_connection_uri(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> str:
        username = config.get("username", "")
        host = config.get("host", "127.0.0.1")
        port = override_port if override_port is not None else config.get("port")
        database = config.get("database", "")
        escaped_user = urllib.parse.quote_plus(username)
        escaped_password = urllib.parse.quote_plus(password)
        port_part = f":{port}" if port else ""
        return f"postgresql+asyncpg://{escaped_user}:{escaped_password}@{host}{port_part}/{database}"

    async def create_database_if_not_exists(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> None:
        username = config.get("username", "")
        host = config.get("host", "127.0.0.1")
        port = override_port if override_port is not None else config.get("port")
        database = config.get("database", "")
        escaped_user = urllib.parse.quote_plus(username)
        escaped_password = urllib.parse.quote_plus(password)
        port_part = f":{port}" if port else ""
        temp_uri = f"postgresql+asyncpg://{escaped_user}:{escaped_password}@{host}{port_part}/postgres"
        temp_engine = create_async_engine(temp_uri, poolclass=NullPool).execution_options(isolation_level="AUTOCOMMIT")
        try:
            async with temp_engine.connect() as conn:
                result = await conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                    {"dbname": database}
                )
                exists = result.scalar() is not None
                if not exists:
                    safe_db_name = database.replace('"', '""')
                    await conn.execute(text(f'CREATE DATABASE "{safe_db_name}"'))
        except Exception as e:
            logger.error("Error creating target database", database=database, error=str(e))
        finally:
            await temp_engine.dispose()

class MysqlConnection(BaseETLConnection):
    def get_connection_uri(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> str:
        username = config.get("username", "")
        host = config.get("host", "127.0.0.1")
        port = override_port if override_port is not None else config.get("port")
        database = config.get("database", "")
        escaped_user = urllib.parse.quote_plus(username)
        escaped_password = urllib.parse.quote_plus(password)
        port_part = f":{port}" if port else ""
        return f"mysql+asyncmy://{escaped_user}:{escaped_password}@{host}{port_part}/{database}"

    async def create_database_if_not_exists(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> None:
        username = config.get("username", "")
        host = config.get("host", "127.0.0.1")
        port = override_port if override_port is not None else config.get("port")
        database = config.get("database", "")
        escaped_user = urllib.parse.quote_plus(username)
        escaped_password = urllib.parse.quote_plus(password)
        port_part = f":{port}" if port else ""
        temp_uri = f"mysql+asyncmy://{escaped_user}:{escaped_password}@{host}{port_part}/mysql"
        temp_engine = create_async_engine(temp_uri, poolclass=NullPool).execution_options(isolation_level="AUTOCOMMIT")
        try:
            async with temp_engine.connect() as conn:
                safe_db_name = database.replace('`', '``')
                await conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{safe_db_name}`"))
        except Exception as e:
            logger.error("Error creating target database", database=database, error=str(e))
        finally:
            await temp_engine.dispose()

class SnowflakeConnection(BaseETLConnection):
    def get_connection_uri(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> str:
        from backend.config import settings
        return str(settings.SQLALCHEMY_DATABASE_URI).replace("postgresql+psycopg", "postgresql+asyncpg")

    async def create_database_if_not_exists(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> None:
        pass

class BigQueryConnection(BaseETLConnection):
    def get_connection_uri(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> str:
        from backend.config import settings
        return str(settings.SQLALCHEMY_DATABASE_URI).replace("postgresql+psycopg", "postgresql+asyncpg")

    async def create_database_if_not_exists(self, config: Dict[str, Any], password: str, override_port: int | None = None) -> None:
        pass

def get_etl_connection(target_db: str) -> BaseETLConnection:
    mapping = {
        "postgresql": PostgresConnection,
        "postgres": PostgresConnection,
        "mysql": MysqlConnection,
        "snowflake": SnowflakeConnection,
        "bigquery": BigQueryConnection,
    }
    cls = mapping.get(target_db.lower())
    if not cls:
        raise ValueError(f"Unsupported database target engine selection: {target_db}")
    return cls()
