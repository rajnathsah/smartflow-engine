import json
import os
from backend.database import get_pg_connection
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


def get_conn():
    return get_pg_connection()



def read_tenant_rows(table: str, tenant_id: str) -> List[Dict[str, Any]]:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table} WHERE tenant_id = ? ORDER BY created_at DESC", (tenant_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{**json.loads(row["data"]), "id": row["id"]} for row in rows]


def read_tenant_row(table: str, tenant_id: str, item_id: str) -> Dict[str, Any]:
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table} WHERE tenant_id = ? AND id = ?", (tenant_id, item_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    return {**json.loads(row["data"]), "id": row["id"]}


def upsert_tenant_row(table: str, tenant_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_conn()
    cursor = conn.cursor()
    item_id = str(item.get("id") or uuid.uuid4())
    cursor.execute(f"SELECT tenant_id FROM {table} WHERE id = ?", (item_id,))
    existing = cursor.fetchone()
    if existing and existing["tenant_id"] != tenant_id:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Resource belongs to another tenant."
        )
    now = datetime.utcnow().isoformat()
    data = {**item, "id": item_id, "tenant_id": tenant_id}
    cursor.execute(
        f"INSERT INTO {table} (id, tenant_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at WHERE {table}.tenant_id = ?",
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
    data = {**item, "id": item_id, "tenant_id": tenant_id}
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
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return read_tenant_rows("sources", tenant_id)


@router.get("/sources/{id}")
async def get_source(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return read_tenant_row("sources", tenant_id, id)


@router.post("/sources", status_code=status.HTTP_201_CREATED)
async def save_source(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return upsert_tenant_row("sources", tenant_id, payload)


@router.put("/sources/{id}")
async def update_source(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return update_tenant_row("sources", tenant_id, id, payload)


@router.delete("/sources/{id}")
async def delete_source(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, str]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return delete_tenant_row("sources", tenant_id, id)


@router.get("/destinations")
async def list_destinations(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return read_tenant_rows("destinations", tenant_id)


@router.get("/destinations/{id}")
async def get_destination(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return read_tenant_row("destinations", tenant_id, id)


@router.post("/destinations", status_code=status.HTTP_201_CREATED)
async def save_destination(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return upsert_tenant_row("destinations", tenant_id, payload)


@router.put("/destinations/{id}")
async def update_destination(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return update_tenant_row("destinations", tenant_id, id, payload)


@router.delete("/destinations/{id}")
async def delete_destination(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, str]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return delete_tenant_row("destinations", tenant_id, id)


@router.get("/connections")
async def list_connections(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return read_tenant_rows("connections", tenant_id)


@router.get("/connections/{id}")
async def get_connection(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return read_tenant_row("connections", tenant_id, id)


@router.post("/connections", status_code=status.HTTP_201_CREATED)
async def save_connection(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return upsert_tenant_row("connections", tenant_id, payload)


@router.put("/connections/{id}")
async def update_connection(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return update_tenant_row("connections", tenant_id, id, payload)


@router.delete("/connections/{id}")
async def delete_connection(id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, str]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return delete_tenant_row("connections", tenant_id, id)


@router.get("/logs")
async def list_logs(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return read_tenant_rows("logs", tenant_id)


@router.post("/logs", status_code=status.HTTP_201_CREATED)
async def save_log(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    conn = get_conn()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    log_id = str(payload.get("id") or uuid.uuid4())
    data = {**payload, "id": log_id, "tenant_id": tenant_id}
    cursor.execute(
        "INSERT INTO logs (id, tenant_id, data, created_at) VALUES (?, ?, ?, ?)",
        (log_id, tenant_id, json.dumps(data), now)
    )
    conn.commit()
    conn.close()
    return data


@router.get("/active")
async def active_pipelines(claims: dict = Depends(get_current_user_claims)) -> List[Dict[str, Any]]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM connections WHERE tenant_id = ? ORDER BY updated_at DESC", (tenant_id,))
    rows = cursor.fetchall()
    conn.close()
    active = []
    for row in rows:
        data = json.loads(row["data"])
        task_id = data.get("taskId")
        status_val = data.get("status", "syncing")
        records_synced = int(data.get("recordsSynced", 0))
        if task_id and status_val == "syncing":
            res = AsyncResult(task_id, app=celery_app)
            if res.ready():
                if res.successful():
                    status_val = "completed"
                    result_data = res.result or {}
                    records_synced = int(result_data.get("records_synced", 0))
                else:
                    status_val = "failed"
                data["status"] = status_val
                data["recordsSynced"] = records_synced
                now = datetime.utcnow().isoformat()
                conn_update = get_conn()
                cur_update = conn_update.cursor()
                cur_update.execute(
                    "UPDATE connections SET data = ?, updated_at = ? WHERE id = ?",
                    (json.dumps(data), now, row["id"])
                )
                conn_update.commit()
                conn_update.close()
        if status_val in ("syncing", "failed", "completed", "active"):
            active.append({
                "id": row["id"],
                "name": data.get("name", row["id"]),
                "sourceUrl": data.get("sourceUrl", ""),
                "targetTable": data.get("targetDbName", ""),
                "rowsFetched": records_synced,
                "rowsInserted": records_synced,
                "totalRows": max(records_synced, 1),
                "errorsCount": 1 if status_val == "failed" else 0,
                "status": "syncing" if status_val == "syncing" else ("failed" if status_val == "failed" else "completed")
            })
    return active


@router.post("/{id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_pipeline_sync(
    id: str,
    pipeline_config: Dict[str, Any] | None = Body(default=None),
    claims: dict = Depends(get_current_user_claims),
) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT tenant_id FROM connections WHERE id = ?", (id,))
    existing = cursor.fetchone()
    if existing and existing["tenant_id"] != tenant_id:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Connection belongs to another tenant."
        )
    task_payload: Dict[str, Any] = dict(pipeline_config or {})
    task_payload.setdefault("id", id)
    task_payload.setdefault("name", id)
    task_payload["tenant_id"] = tenant_id
    async_result = sync_pipeline_task.delay(task_payload)
    data = {**task_payload, "id": id, "status": "syncing", "taskId": async_result.id, "tenant_id": tenant_id}
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO connections (id, tenant_id, data, task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, task_id = excluded.task_id, updated_at = excluded.updated_at WHERE connections.tenant_id = ?",
        (id, tenant_id, json.dumps(data), async_result.id, now, now, tenant_id)
    )
    conn.commit()
    conn.close()
    logger.info("Pipeline sync task queued", pipeline_id=id, tenant_id=tenant_id, celery_task_id=async_result.id)
    return {"status": "accepted", "pipeline_id": id, "task_id": async_result.id}


@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str, claims: dict = Depends(get_current_user_claims)) -> Dict[str, Any]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM connections WHERE tenant_id = ? AND task_id = ?", (tenant_id, task_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline task not found.")
    res = AsyncResult(task_id, app=celery_app)
    data = {"task_id": task_id, "status": res.status}
    if res.ready():
        if res.successful():
            data["result"] = res.result
            status_val = "completed"
            records_synced = int((res.result or {}).get("records_synced", 0))
        else:
            data["error"] = str(res.result)
            status_val = "failed"
            records_synced = 0
        conn_data = json.loads(row["data"])
        if conn_data.get("status") == "syncing":
            conn_data["status"] = status_val
            conn_data["recordsSynced"] = records_synced
            now = datetime.utcnow().isoformat()
            conn_update = get_conn()
            cur_update = conn_update.cursor()
            cur_update.execute(
                "UPDATE connections SET data = ?, updated_at = ? WHERE task_id = ?",
                (json.dumps(conn_data), now, task_id)
            )
            conn_update.commit()
            conn_update.close()
    return data


@router.post("/{id}/auth-driver")
async def save_auth_driver(
    id: str,
    payload: Dict[str, str] = Body(...),
    claims: dict = Depends(get_current_user_claims)
) -> Dict[str, str]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    read_tenant_row("connections", tenant_id, id)
    code = payload.get("code")
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing code field.")
    drivers_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "auth_drivers")
    os.makedirs(drivers_dir, exist_ok=True)
    driver_path = os.path.join(drivers_dir, f"{id}_auth_driver.py")
    with open(driver_path, "w", encoding="utf-8") as f:
        f.write(code)
    return {"status": "success", "message": "Auth driver saved successfully."}


@router.get("/active/schema")
async def get_active_schema(claims: dict = Depends(get_current_user_claims)) -> Dict[str, List[str]]:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return {
        "sourceKeys": ["user_id", "email", "created_at", "status_flag", "total_spent", "ip_address"],
        "targetColumns": ["id", "contact_email", "signup_date", "active_status", "lifetime_value", "signup_ip"]
    }
