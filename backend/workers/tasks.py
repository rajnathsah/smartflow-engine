import asyncio
import json
import traceback
from itertools import chain
from typing import Any, Dict, Iterable, Iterator, List, Tuple

from sqlalchemy import BOOLEAN, DATETIME, FLOAT, INTEGER, TEXT, Column, MetaData, String, Table, insert, inspect
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from backend.database.factory import get_async_engine, ensure_database_exists
from backend.utils.logging import logger
from backend.utils.tunneling import ssh_tunnel_context
from backend.workers.celery_app import app as celery_app
from backend.workers.extractors import extract_records_generator

CHUNK_SIZE = 5000

INFERRED_TYPE_BUILDERS = {
    "boolean": lambda: BOOLEAN(),
    "datetime": lambda: DATETIME(),
    "float": lambda: FLOAT(),
    "integer": lambda: INTEGER(),
    "string": lambda: String(length=255),
    "text": lambda: TEXT(),
}


def _default_port(target_db: str) -> int:
    return 3306 if target_db.lower() == "mysql" else 5432


def _headers_to_dict(headers: Any) -> Dict[str, str]:
    if isinstance(headers, dict):
        return {str(key): str(value) for key, value in headers.items()}

    if isinstance(headers, list):
        compiled: Dict[str, str] = {}
        for item in headers:
            if not isinstance(item, dict):
                continue

            key = str(item.get("key", "")).strip()
            value = str(item.get("value", "")).strip()
            if key:
                compiled[key] = value

        return compiled

    return {}


def _normalize_pipeline_config(
    pipeline_config: Dict[str, Any],
) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]] | Dict[str, Any]]:
    source = pipeline_config.get("source")
    target = pipeline_config.get("target")

    if isinstance(source, dict):
        source_config = source.copy()
    else:
        source_config = {
            "endpointUrl": pipeline_config.get("sourceUrl", ""),
            "auth": {
                "authType": pipeline_config.get("sourceAuthType", "none"),
                "authToken": pipeline_config.get("sourceToken", ""),
            },
            "customHeaders": _headers_to_dict(pipeline_config.get("sourceHeaders", {})),
            "pagination": pipeline_config.get("pagination", {}),
        }

    if isinstance(target, dict):
        target_config = target.copy()
    else:
        target_db = str(pipeline_config.get("targetDbDialect", "postgresql")).lower()
        target_config = {
            "targetDb": target_db,
            "host": pipeline_config.get("targetDbHost", ""),
            "port": pipeline_config.get("targetDbPort", _default_port(target_db)),
            "database": pipeline_config.get("targetDbName", ""),
            "username": pipeline_config.get("targetDbUser", ""),
            "password": pipeline_config.get("targetDbPassword", ""),
            "tableName": pipeline_config.get("tableName") or pipeline_config.get("name") or "sync_table",
            "sshEnabled": bool(pipeline_config.get("enableSshBastion", False)),
            "bastionHost": pipeline_config.get("bastionHost", ""),
            "bastionUser": pipeline_config.get("bastionUser", ""),
            "bastionPort": pipeline_config.get("bastionPort", 22),
            "pemKeyContent": pipeline_config.get("pemKeyContent", ""),
        }

    source_config["auth"] = source_config.get("auth") or {
        "authType": pipeline_config.get("sourceAuthType", "none"),
        "authToken": pipeline_config.get("sourceToken", ""),
    }
    source_config["customHeaders"] = _headers_to_dict(
        source_config.get("customHeaders", pipeline_config.get("sourceHeaders", {}))
    )
    source_config["pagination"] = source_config.get("pagination") or pipeline_config.get("pagination", {})
    source_config["dataPath"] = (
        source_config.get("dataPath")
        or source_config.get("data_path")
        or pipeline_config.get("sourceDataPath")
        or ""
    )

    target_db = str(target_config.get("targetDb", target_config.get("dialect", "postgresql"))).lower()
    target_config["targetDb"] = target_db
    target_config["port"] = int(target_config.get("port") or _default_port(target_db))
    target_config["tableName"] = str(target_config.get("tableName") or pipeline_config.get("name") or "sync_table").strip()
    target_config["sshEnabled"] = bool(target_config.get("sshEnabled", False))
    target_config["bastionPort"] = int(target_config.get("bastionPort", 22))

    schema_mapping = pipeline_config.get("schema_mapping")
    if schema_mapping is None:
        schema_mapping = pipeline_config.get("schemaMapping")
    if schema_mapping is None:
        schema_mapping = []

    if not isinstance(schema_mapping, (list, dict)):
        raise ValueError("`schema_mapping` must be a list or dictionary of mapping definitions.")

    return source_config, target_config, schema_mapping


def _validate_target_config(target_config: Dict[str, Any]) -> None:
    required_fields = ("targetDb", "host", "database", "username", "tableName")
    missing = [field for field in required_fields if not str(target_config.get(field, "")).strip()]
    if missing:
        raise ValueError(f"Target database configuration is incomplete. Missing fields: {', '.join(missing)}")


def _infer_column_type_name(value: Any) -> str:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "string" if len(value) <= 255 else "text"
    return "text"


def infer_schema(first_record: Dict[str, Any]) -> List[Dict[str, str]]:
    if not isinstance(first_record, dict) or not first_record:
        return []

    inferred_mapping = [
        {
            "source_key": str(key),
            "target_key": str(key),
            "column_type": _infer_column_type_name(value),
        }
        for key, value in first_record.items()
    ]
    logger.info("Inferred schema mapping", mapping=inferred_mapping)
    return inferred_mapping


def _schema_mapping_is_empty(schema_mapping: List[Dict[str, Any]] | Dict[str, Any] | None) -> bool:
    if schema_mapping is None:
        return True
    if isinstance(schema_mapping, dict):
        return len(schema_mapping) == 0
    return len(schema_mapping) == 0


def _normalize_schema_mapping(
    schema_mapping: List[Dict[str, Any]] | Dict[str, Any] | None,
) -> List[Dict[str, Any]]:
    if _schema_mapping_is_empty(schema_mapping):
        return []

    if isinstance(schema_mapping, dict):
        normalized_mapping: List[Dict[str, Any]] = []
        for key, value in schema_mapping.items():
            source_key = str(key).strip()
            if not source_key:
                continue

            column_type_name = _infer_column_type_name(value)
            normalized_mapping.append(
                {
                    "source_key": source_key,
                    "target_key": source_key,
                    "column_type": column_type_name,
                }
            )
        return normalized_mapping

    return schema_mapping





def _build_dynamic_table(
    table_name: str, schema_mapping: List[Dict[str, Any]]
) -> Tuple[type[DeclarativeBase], Table, Dict[str, str]]:
    schema_mapping = _normalize_schema_mapping(schema_mapping)
    mapping_dict: Dict[str, str] = {}
    column_types: Dict[str, Any] = {}

    for index, item in enumerate(schema_mapping):
        source_key = str(item.get("source_key", item.get("sourceKey", ""))).strip()
        target_key = str(item.get("target_key", item.get("targetKey", ""))).strip()
        column_type_name = str(item.get("column_type", item.get("columnType", "text"))).strip().lower() or "text"

        if not source_key or not target_key:
            raise ValueError(f"Invalid schema mapping at index {index}: both source_key and target_key are required.")

        if target_key in mapping_dict.values():
            raise ValueError(f"Duplicate target column detected in schema mapping: {target_key}")

        mapping_dict[source_key] = target_key
        column_types[target_key] = INFERRED_TYPE_BUILDERS.get(column_type_name, INFERRED_TYPE_BUILDERS["text"])()

    if not mapping_dict:
        raise RuntimeError("Dynamic table construction failed because no usable schema mapping could be derived.")

    base_metadata = MetaData()

    class Base(DeclarativeBase):
        pass

    Base.metadata = base_metadata

    dynamic_table = Table(
        table_name,
        Base.metadata,
        *(Column(column_name, column_types.get(column_name, TEXT()), nullable=True) for column_name in mapping_dict.values()),
        extend_existing=True,
    )

    return Base, dynamic_table, mapping_dict


async def _ensure_target_table(engine: AsyncEngine, Base: type[DeclarativeBase], table_name: str) -> None:
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            table_exists = await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table(table_name))
    except Exception as exc:
        logger.error(
            "Failed while provisioning target table",
            table_name=table_name,
            error=str(exc),
            traceback=traceback.format_exc(),
            target_database=engine.url.database,
            target_host=engine.url.host,
            target_port=engine.url.port,
        )
        raise

    if not table_exists:
        raise RuntimeError(f"Target table `{table_name}` was not created in database `{engine.url.database}`.")

    logger.info(
        "Target table verified",
        table_name=table_name,
        target_database=engine.url.database,
        target_host=engine.url.host,
        target_port=engine.url.port,
    )


async def _write_chunk(
    session_factory: async_sessionmaker,
    target_table: Table,
    rows: List[Dict[str, Any]],
    table_name: str,
    chunk_index: int,
) -> int:
    async with session_factory() as session:
        try:
            await session.execute(insert(target_table), rows)
            await session.flush()
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error(
                "Failed to persist records chunk",
                table_name=table_name,
                chunk_index=chunk_index,
                chunk_size=len(rows),
                error=str(exc),
                traceback=traceback.format_exc(),
            )
            raise

    logger.info(
        "Persisted records chunk",
        table_name=table_name,
        chunk_index=chunk_index,
        chunk_size=len(rows),
    )
    return len(rows)


async def load_records_chunked(
    engine: AsyncEngine,
    table_name: str,
    schema_mapping: List[Dict[str, Any]] | Dict[str, Any] | None,
    records_generator: Iterable[List[Dict[str, Any]]],
) -> int:
    records_iterator = iter(records_generator)
    
    # Safely get the first chunk
    first_chunk = next(records_iterator, None)
    if not first_chunk or len(first_chunk) == 0:
        if _schema_mapping_is_empty(schema_mapping):
            raise ValueError("Cannot initiate ETL sync with an empty schema mapping")
        raise ValueError("API returned no data.")
        
    # Re-inject the chunk back into the generator so we don't lose data
    def prepend_chunk(chunk, gen):
        yield chunk
        yield from gen
    records_generator = prepend_chunk(first_chunk, records_iterator)

    if _schema_mapping_is_empty(schema_mapping):
        first_record = first_chunk[0] if isinstance(first_chunk[0], dict) else None
        if not first_record:
            raise ValueError("Cannot initiate ETL sync with an empty schema mapping")

        inferred_mapping = infer_schema(first_record)
        logger.warning(
            "Schema mapping was empty, injected fallback schema based on first record.",
            mapping=inferred_mapping,
            table_name=table_name,
        )
        schema_mapping = inferred_mapping
    else:
        schema_mapping = _normalize_schema_mapping(schema_mapping)

    Base, target_table, mapping_dict = _build_dynamic_table(table_name, schema_mapping)
    await _ensure_target_table(engine, Base, table_name)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    buffer: List[Dict[str, Any]] = []
    chunk_index = 0
    total_loaded = 0
    skipped_records = 0

    try:
        for page_records in records_generator:
            for record in page_records:
                transformed_record = {}
                for source_key, target_key in mapping_dict.items():
                    if source_key in record:
                        val = record[source_key]
                        if isinstance(val, (dict, list, tuple)):
                            transformed_record[target_key] = json.dumps(val)
                        else:
                            transformed_record[target_key] = val

                if not transformed_record:
                    skipped_records += 1
                    continue

                buffer.append(transformed_record)

                if len(buffer) == CHUNK_SIZE:
                    chunk_index += 1
                    total_loaded += await _write_chunk(
                        session_factory=session_factory,
                        target_table=target_table,
                        rows=buffer,
                        table_name=table_name,
                        chunk_index=chunk_index,
                    )
                    buffer = []

        if buffer:
            chunk_index += 1
            total_loaded += await _write_chunk(
                session_factory=session_factory,
                target_table=target_table,
                rows=buffer,
                table_name=table_name,
                chunk_index=chunk_index,
            )
    finally:
        close_generator = getattr(records_generator, "close", None)
        if callable(close_generator):
            close_generator()

    logger.info(
        "Completed target load",
        table_name=table_name,
        total_loaded=total_loaded,
        skipped_records=skipped_records,
        chunks_written=chunk_index,
        target_database=engine.url.database,
    )
    return total_loaded


async def _run_with_engine(
    target_config: Dict[str, Any],
    table_name: str,
    schema_mapping: List[Dict[str, Any]],
    records_generator: Iterable[List[Dict[str, Any]]],
    override_port: int | None = None,
) -> int:
    engine: AsyncEngine | None = None

    try:
        await ensure_database_exists(target_config, override_port=override_port)
        engine = get_async_engine(target_config, override_port=override_port)
        logger.info(
            "Initialized target async engine",
            driver=engine.url.drivername,
            target_database=engine.url.database,
            target_host=engine.url.host,
            target_port=engine.url.port,
            table_name=table_name,
        )
        return await load_records_chunked(engine, table_name, schema_mapping, records_generator)
    except Exception as exc:
        logger.error(
            "Target engine initialization or execution failed",
            error=str(exc),
            traceback=traceback.format_exc(),
            target_database=target_config.get("database"),
            target_host="127.0.0.1" if override_port is not None else target_config.get("host"),
            target_port=override_port or target_config.get("port"),
            table_name=table_name,
        )
        raise
    finally:
        if engine is not None:
            await engine.dispose()


async def run_pipeline_orchestration(pipeline_config: Dict[str, Any]) -> int:
    source_config, target_config, schema_mapping = _normalize_pipeline_config(pipeline_config)
    logger.info("Payload received", config=target_config)
    _validate_target_config(target_config)

    table_name = target_config["tableName"]
    endpoint_url = str(source_config.get("endpointUrl", "")).strip()
    if not endpoint_url:
        raise ValueError("Source endpointUrl is required to start the sync pipeline.")

    target_db = str(target_config.get("targetDb", "postgresql")).lower()
    remote_db_port = int(target_config.get("port") or _default_port(target_db))

    records_generator = extract_records_generator(
        endpoint_url=endpoint_url,
        auth_config=source_config.get("auth", {}),
        pagination_config=source_config.get("pagination", {}),
        custom_headers=source_config.get("customHeaders", {}),
        data_path=source_config.get("dataPath"),
    )

    logger.info(
        "Starting ETL pipeline orchestration",
        table_name=table_name,
        source_endpoint=endpoint_url,
        target_database=target_config.get("database"),
        target_host=target_config.get("host"),
        target_port=remote_db_port,
        ssh_enabled=target_config.get("sshEnabled", False),
    )

    try:
        if target_config.get("sshEnabled", False):
            with ssh_tunnel_context(
                bastion_host=str(target_config.get("bastionHost", "")).strip(),
                bastion_user=str(target_config.get("bastionUser", "")).strip(),
                decrypted_pem_key=str(target_config.get("pemKeyContent", "")),
                remote_db_host=str(target_config.get("host", "")).strip(),
                remote_db_port=remote_db_port,
                ssh_port=int(target_config.get("bastionPort", 22)),
            ) as local_port:
                return await _run_with_engine(
                    target_config=target_config,
                    table_name=table_name,
                    schema_mapping=schema_mapping,
                    records_generator=records_generator,
                    override_port=local_port,
                )

        return await _run_with_engine(
            target_config=target_config,
            table_name=table_name,
            schema_mapping=schema_mapping,
            records_generator=records_generator,
        )
    except Exception as exc:
        logger.error(
            "ETL pipeline orchestration failed",
            error=str(exc),
            traceback=traceback.format_exc(),
            table_name=table_name,
            target_database=target_config.get("database"),
            target_host=target_config.get("host"),
            target_port=remote_db_port,
        )
        raise


def run_async_bridge(coro: Any) -> Any:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=3)
def sync_pipeline_task(self, pipeline_config: Dict[str, Any]) -> Dict[str, Any]:
    logger.info("Initiating ETL sync task", task_id=self.request.id)

    try:
        total_loaded = run_async_bridge(run_pipeline_orchestration(pipeline_config))
        logger.info(
            "ETL sync task completed successfully",
            task_id=self.request.id,
            records_synced=total_loaded,
        )
        return {
            "status": "success",
            "task_id": self.request.id,
            "records_synced": total_loaded,
        }
    except Exception as exc:
        logger.error(
            "ETL sync task failed",
            task_id=self.request.id,
            error=str(exc),
            traceback=traceback.format_exc(),
        )
        raise self.retry(exc=exc, countdown=15)
