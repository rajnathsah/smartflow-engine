import asyncio
import json
import traceback
from typing import Any, Dict, Iterable, List, Tuple
from sqlalchemy import BOOLEAN, DATETIME, FLOAT, INTEGER, TEXT, Column, MetaData, String, Table, insert, inspect
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
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
            "port": pipeline_config.get("targetDbPort"),
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
    existing_pagination = source_config.get("pagination") or pipeline_config.get("pagination") or {}
    if not existing_pagination.get("type"):
        frontend_strat = str(pipeline_config.get("paginationStrategy") or "").strip().lower()
        if frontend_strat in ("page", "offset", "cursor"):
            existing_pagination = {**existing_pagination, "type": frontend_strat}
    source_config["pagination"] = existing_pagination
    source_config["dataPath"] = (
        source_config.get("dataPath")
        or source_config.get("data_path")
        or pipeline_config.get("sourceDataPath")
        or ""
    )
    target_db = str(target_config.get("targetDb", target_config.get("dialect", "postgresql"))).lower()
    target_config["targetDb"] = target_db
    port_val = target_config.get("port")
    target_config["port"] = int(port_val) if port_val else None
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

def infer_schema(record: Dict[str, Any]) -> List[Dict[str, str]]:
    schema = []
    for key, value in record.items():
        type_name = _infer_column_type_name(value)
        schema.append({
            "sourceKey": key,
            "targetColumn": key.lower().replace(" ", "_").replace("-", "_"),
            "targetType": type_name,
        })
    return schema

def _schema_mapping_is_empty(schema_mapping: List[Dict[str, Any]] | Dict[str, Any] | None) -> bool:
    if not schema_mapping:
        return True
    if isinstance(schema_mapping, list) and len(schema_mapping) == 0:
        return True
    if isinstance(schema_mapping, dict) and len(schema_mapping) == 0:
        return True
    return False

def _normalize_schema_mapping(schema_mapping: List[Dict[str, Any]] | Dict[str, Any]) -> List[Dict[str, Any]]:
    if isinstance(schema_mapping, list):
        return schema_mapping
    normalized = []
    for source_key, val in schema_mapping.items():
        if isinstance(val, str):
            normalized.append({
                "sourceKey": source_key,
                "targetColumn": val,
                "targetType": "string",
            })
        elif isinstance(val, dict):
            normalized.append({
                "sourceKey": source_key,
                "targetColumn": val.get("targetColumn") or val.get("target_column") or source_key,
                "targetType": val.get("targetType") or val.get("target_type") or "string",
            })
    return normalized

class DynamicBase(DeclarativeBase):
    pass

def _build_dynamic_table(
    table_name: str,
    schema_mapping: List[Dict[str, Any]],
) -> Tuple[Any, Table, Dict[str, str]]:
    metadata = MetaData()
    columns = [
        Column("id", INTEGER(), primary_key=True, autoincrement=True),
    ]
    mapping_dict = {}
    for item in schema_mapping:
        source_key = item["sourceKey"]
        target_col = item["targetColumn"]
        target_type = str(item.get("targetType") or item.get("target_type") or "string").lower()
        builder = INFERRED_TYPE_BUILDERS.get(target_type)
        if not builder:
            builder = lambda: String(length=255)
        columns.append(Column(target_col, builder(), nullable=True))
        mapping_dict[source_key] = target_col
    dynamic_table = Table(table_name, metadata, *columns)
    return DynamicBase, dynamic_table, mapping_dict

async def _ensure_target_table(engine: AsyncEngine, Base: Any, table_name: str) -> None:
    async with engine.begin() as conn:
        def check_table(connection):
            inspector = inspect(connection)
            return inspector.has_table(table_name)
        table_exists = await conn.run_sync(check_table)
        if not table_exists:
            await conn.run_sync(Base.metadata.create_all)

async def _write_chunk(
    session_factory: Any,
    target_table: Table,
    rows: List[Dict[str, Any]],
    table_name: str,
    chunk_index: int,
) -> int:
    async with session_factory() as session:
        async with session.begin():
            stmt = insert(target_table).values(rows)
            await session.execute(stmt)
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
    first_chunk = next(records_iterator, None)
    if not first_chunk or len(first_chunk) == 0:
        if _schema_mapping_is_empty(schema_mapping):
            raise ValueError("Cannot initiate ETL sync with an empty schema mapping")
        raise ValueError("API returned no data.")
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
    buffer = []
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
    from backend.database.factory import get_decrypted_password
    from backend.workers.connections import get_etl_connection
    target_db = str(target_config.get("targetDb", "postgresql")).lower()
    password = target_config.get("password", "")
    password_decrypted = get_decrypted_password(password)
    handler = get_etl_connection(target_db)
    await handler.create_database_if_not_exists(target_config, password_decrypted, override_port)
    connection_uri = handler.get_connection_uri(target_config, password_decrypted, override_port)
    engine = handler.create_engine(connection_uri)
    try:
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
            "Target engine execution failed",
            error=str(exc),
            traceback=traceback.format_exc(),
            table_name=table_name,
        )
        raise
    finally:
        await engine.dispose()

def load_custom_auth_token(connection_id: str, auth_config: dict) -> str:
    import importlib.util
    import os
    drivers_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "auth_drivers")
    safe_connection_id = os.path.basename(connection_id)
    driver_path = os.path.join(drivers_dir, f"{safe_connection_id}_auth_driver.py")
    if not os.path.exists(driver_path):
        return auth_config.get("authToken", "")
    spec = importlib.util.spec_from_file_location(f"dynamic_auth_{connection_id}", driver_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load spec for auth driver.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, "get_auth_token"):
        raise AttributeError("Auth driver does not define 'get_auth_token' function.")
    return str(module.get_auth_token(auth_config))

async def run_pipeline_orchestration(pipeline_config: Dict[str, Any]) -> int:
    source_config, target_config, schema_mapping = _normalize_pipeline_config(pipeline_config)
    logger.info("Payload received", config=target_config)
    _validate_target_config(target_config)
    table_name = target_config["tableName"]
    endpoint_url = str(source_config.get("endpointUrl", "")).strip()
    if not endpoint_url:
        raise ValueError("Source endpointUrl is required to start the sync pipeline.")
    target_db = str(target_config.get("targetDb", "postgresql")).lower()
    port_val = target_config.get("port")
    remote_db_port = int(port_val) if port_val else None
    connection_id = pipeline_config.get("id")
    if connection_id:
        auth_config = source_config.get("auth", {})
        token = load_custom_auth_token(connection_id, auth_config)
        if token:
            auth_config["authToken"] = token
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

def generate_openai_embeddings(text: str) -> List[float]:
    from backend.config import settings
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            logger.warn("OpenAI Embeddings request failed, falling back to mock vector", error=str(e))
    else:
        logger.warn("OpenAI API Key is not set, falling back to mock vector")
    import hashlib
    import random
    sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
    seed = int(sha256[:8], 16)
    rng = random.Random(seed)
    return [rng.uniform(-1.0, 1.0) for _ in range(1536)]

def run_tesseract_ocr(image_path: str) -> str:
    import subprocess
    result = subprocess.run(
        ["tesseract", image_path, "stdout"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8"
    )
    return result.stdout

def extract_text_from_document(file_path: str) -> str:
    import os
    import subprocess
    _, ext = os.path.splitext(file_path.lower())
    extracted_text = ""
    if ext == ".txt":
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        except Exception:
            pass
    if not extracted_text.strip():
        if ext == ".pdf":
            import tempfile
            with tempfile.TemporaryDirectory() as tmpdir:
                try:
                    subprocess.run(
                        ["pdftoppm", "-png", "-r", "150", file_path, os.path.join(tmpdir, "page")],
                        check=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )
                    for img_file in sorted(os.listdir(tmpdir)):
                        if img_file.endswith(".png"):
                            img_path = os.path.join(tmpdir, img_file)
                            text = run_tesseract_ocr(img_path)
                            if text:
                                extracted_text += text + "\n"
                except Exception as e:
                    logger.error("OCR execution failed via pdftoppm/tesseract", file_path=file_path, error=str(e))
        elif ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
            try:
                extracted_text = run_tesseract_ocr(file_path)
            except Exception as e:
                logger.error("OCR execution failed for image", file_path=file_path, error=str(e))
    return extracted_text

def semantic_chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    chunks = []
    start = 0
    if not text:
        return chunks
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start += chunk_size - overlap
    return chunks

def save_chunks_to_db(tenant_id: str, document_name: str, chunks: List[str]) -> None:
    from backend.database.database import SessionLocal
    from backend.models import DocumentChunk
    from datetime import datetime
    db_chunks = []
    for idx, chunk in enumerate(chunks):
        embedding = generate_openai_embeddings(chunk)
        db_chunk = DocumentChunk(
            tenant_id=tenant_id,
            document_name=document_name,
            chunk_index=idx,
            content=chunk,
            embedding=embedding,
            created_at=datetime.utcnow().isoformat()
        )
        db_chunks.append(db_chunk)
    with SessionLocal() as db:
        db.add_all(db_chunks)
        db.commit()

@celery_app.task(bind=True, max_retries=3)
def process_document_task(self, tenant_id: str, file_path: str, file_name: str) -> Dict[str, Any]:
    logger.info("Initiating AI document processing task", task_id=self.request.id, tenant_id=tenant_id, document_name=file_name)
    try:
        extracted_text = extract_text_from_document(file_path)
        if not extracted_text.strip():
            extracted_text = f"Empty or unreadable document: {file_name}. Simulating semantic content processing."
        chunks = semantic_chunk_text(extracted_text)
        save_chunks_to_db(tenant_id, file_name, chunks)
        logger.info("AI document processing task completed successfully", task_id=self.request.id, chunks_processed=len(chunks))
        return {
            "status": "success",
            "task_id": self.request.id,
            "document_name": file_name,
            "chunks_processed": len(chunks)
        }
    except Exception as exc:
        logger.error(
            "AI document processing task failed",
            task_id=self.request.id,
            error=str(exc),
            traceback=traceback.format_exc()
        )
        raise self.retry(exc=exc, countdown=15)
