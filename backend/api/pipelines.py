import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List

from celery.result import AsyncResult
from fastapi import APIRouter, Body, Depends, HTTPException, status

from backend.api.auth import get_current_user_claims
from backend.utils.logging import logger
from backend.workers.tasks import sync_pipeline_task
from backend.workers.celery_app import app as celery_app

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "synq_auth.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def read_tenant_rows(table: str, tenant_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(f"SELECT id, data FROM {table} WHERE tenant_id = ? ORDER BY created_at DESC", (tenant_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{**json.loads(row["data"]), "id": row["id"]} for row in rows]


def read_tenant_row(table: str, tenant_id: str, item_id: str) -> Dict[str, Any]:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(f"SELECT id, data FROM {table} WHERE tenant_id = ? AND id = ?", (tenant_id, item_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    return {**json.loads(row["data"]), "id": row["id"]}


def upsert_tenant_row(table: str, tenant_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    item_id = str(item.get("id") or uuid.uuid4())
    data = {**item, "id": item_id}
    cursor.execute(
        f"INSERT INTO {table} (id, tenant_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE tenant_id = ?",
        (item_id, tenant_id, json.dumps(data), now, now, tenant_id)
    )
    conn.commit()
    conn.close()
    return data


def update_tenant_row(table: str, tenant_id: str, item_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
    read_tenant_row(table, tenant_id, item_id)
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    data = {**item, "id": item_id}
    cursor.execute(
        f"UPDATE {table} SET data = ?, updated_at = ? WHERE tenant_id = ? AND id = ?",
        (json.dumps(data), now, tenant_id, item_id)
    )
    conn.commit()
    conn.close()
    return data


def delete_tenant_row(table: str, tenant_id: str, item_id: str) -> Dict[str, str]:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {table} WHERE tenant_id = ? AND id = ?", (tenant_id, item_id))
    if cursor.rowcount != 1:
        conn.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": item_id}


@router.get("/sources")
async def list_sources(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    return read_tenant_rows("sources", claims["tenant_id"])


@router.get("/sources/{id}")
async def get_source(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return read_tenant_row("sources", claims["tenant_id"], id)


@router.post("/sources", status_code=status.HTTP_201_CREATED)
async def save_source(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return upsert_tenant_row("sources", claims["tenant_id"], payload)


@router.put("/sources/{id}")
async def update_source(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return update_tenant_row("sources", claims["tenant_id"], id, payload)


@router.delete("/sources/{id}")
async def delete_source(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, str]:
    return delete_tenant_row("sources", claims["tenant_id"], id)


@router.get("/destinations")
async def list_destinations(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    return read_tenant_rows("destinations", claims["tenant_id"])


@router.get("/destinations/{id}")
async def get_destination(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return read_tenant_row("destinations", claims["tenant_id"], id)


@router.post("/destinations", status_code=status.HTTP_201_CREATED)
async def save_destination(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return upsert_tenant_row("destinations", claims["tenant_id"], payload)


@router.put("/destinations/{id}")
async def update_destination(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return update_tenant_row("destinations", claims["tenant_id"], id, payload)


@router.delete("/destinations/{id}")
async def delete_destination(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, str]:
    return delete_tenant_row("destinations", claims["tenant_id"], id)


@router.get("/connections")
async def list_connections(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    return read_tenant_rows("connections", claims["tenant_id"])


@router.get("/connections/{id}")
async def get_connection(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return read_tenant_row("connections", claims["tenant_id"], id)


@router.post("/connections", status_code=status.HTTP_201_CREATED)
async def save_connection(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return upsert_tenant_row("connections", claims["tenant_id"], payload)


@router.put("/connections/{id}")
async def update_connection(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    return update_tenant_row("connections", claims["tenant_id"], id, payload)


@router.delete("/connections/{id}")
async def delete_connection(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, str]:
    return delete_tenant_row("connections", claims["tenant_id"], id)


@router.get("/logs")
async def list_logs(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    return read_tenant_rows("logs", claims["tenant_id"])


@router.post("/logs", status_code=status.HTTP_201_CREATED)
async def save_log(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    log_id = str(payload.get("id") or uuid.uuid4())
    data = {**payload, "id": log_id}
    cursor.execute(
        "INSERT INTO logs (id, tenant_id, data, created_at) VALUES (?, ?, ?, ?)",
        (log_id, claims["tenant_id"], json.dumps(data), now)
    )
    conn.commit()
    conn.close()
    return data


@router.get("/active")
async def active_pipelines(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, data FROM connections WHERE tenant_id = ? ORDER BY updated_at DESC", (claims["tenant_id"],))
    rows = cursor.fetchall()
    conn.close()
    active = []
    for row in rows:
        data = json.loads(row["data"])
        if data.get("status") in ("syncing", "failed", "completed"):
            active.append({
                "id": row["id"],
                "name": data.get("name", row["id"]),
                "sourceUrl": data.get("sourceUrl", ""),
                "targetTable": data.get("targetDbName", ""),
                "rowsFetched": int(data.get("recordsSynced", 0)),
                "rowsInserted": int(data.get("recordsSynced", 0)),
                "totalRows": max(int(data.get("recordsSynced", 0)), 1),
                "errorsCount": 1 if data.get("status") == "failed" else 0,
                "status": data.get("status", "syncing")
            })
    return active


@router.post("/{id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_pipeline_sync(
    id: str,
    pipeline_config: Dict[str, Any] | None = Body(default=None),
    claims: dict = Depends(get_current_user_claims),
) -> Dict[str, Any]:
    tenant_id = claims["tenant_id"]
    task_payload: Dict[str, Any] = dict(pipeline_config or {})
    task_payload.setdefault("id", id)
    task_payload.setdefault("name", id)
    task_payload["tenant_id"] = tenant_id
    async_result = sync_pipeline_task.delay(task_payload)
    data = {**task_payload, "id": id, "status": "syncing", "taskId": async_result.id}
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO connections (id, tenant_id, data, task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, task_id = excluded.task_id, updated_at = excluded.updated_at WHERE tenant_id = ?",
        (id, tenant_id, json.dumps(data), async_result.id, now, now, tenant_id)
    )
    conn.commit()
    conn.close()
    logger.info("Pipeline sync task queued", pipeline_id=id, tenant_id=tenant_id, celery_task_id=async_result.id)
    return {"status": "accepted", "pipeline_id": id, "task_id": async_result.id}


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, data FROM connections WHERE tenant_id = ? AND task_id = ?", (claims["tenant_id"], task_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline task not found.")
    res = AsyncResult(task_id, app=celery_app)
    data = {"task_id": task_id, "status": res.status}
    if res.ready():
        if res.successful():
            data["result"] = res.result
        else:
            data["error"] = str(res.result)
    return data
