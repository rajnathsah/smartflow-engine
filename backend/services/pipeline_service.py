import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List
from celery.result import AsyncResult
from fastapi import HTTPException, status
from backend.utils.logging import logger
from backend.workers.tasks import sync_pipeline_task
from backend.workers.celery_app import app as celery_app

def read_tenant_rows(conn, table: str, tenant_id: str) -> List[Dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table} WHERE tenant_id = ? ORDER BY created_at DESC", (tenant_id,))
    rows = cursor.fetchall()
    return [{**json.loads(row["data"]), "id": row["id"]} for row in rows]

def read_tenant_row(conn, table: str, tenant_id: str, item_id: str) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {table} WHERE tenant_id = ? AND id = ?", (tenant_id, item_id))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    return {**json.loads(row["data"]), "id": row["id"]}

def upsert_tenant_row(conn, table: str, tenant_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
    cursor = conn.cursor()
    item_id = str(item.get("id") or uuid.uuid4())
    cursor.execute(f"SELECT tenant_id FROM {table} WHERE id = ?", (item_id,))
    existing = cursor.fetchone()
    if existing and existing["tenant_id"] != tenant_id:
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
    return data

def update_tenant_row(conn, table: str, tenant_id: str, item_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
    read_tenant_row(conn, table, tenant_id, item_id)
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    data = {**item, "id": item_id, "tenant_id": tenant_id}
    cursor.execute(
        f"UPDATE {table} SET data = ?, updated_at = ? WHERE tenant_id = ? AND id = ?",
        (json.dumps(data), now, tenant_id, item_id)
    )
    conn.commit()
    return data

def delete_tenant_row(conn, table: str, tenant_id: str, item_id: str) -> Dict[str, str]:
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {table} WHERE tenant_id = ? AND id = ?", (tenant_id, item_id))
    if cursor.rowcount != 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    conn.commit()
    return {"status": "deleted", "id": item_id}

def save_log(conn, tenant_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    log_id = str(payload.get("id") or uuid.uuid4())
    data = {**payload, "id": log_id, "tenant_id": tenant_id}
    cursor.execute(
        "INSERT INTO logs (id, tenant_id, data, created_at) VALUES (?, ?, ?, ?)",
        (log_id, tenant_id, json.dumps(data), now)
    )
    conn.commit()
    return data

def get_active_pipelines(conn, tenant_id: str) -> List[Dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM connections WHERE tenant_id = ? ORDER BY updated_at DESC", (tenant_id,))
    rows = cursor.fetchall()
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
                cursor.execute(
                    "UPDATE connections SET data = ?, updated_at = ? WHERE id = ?",
                    (json.dumps(data), now, row["id"])
                )
                conn.commit()
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

def trigger_pipeline_sync(conn, tenant_id: str, id: str, pipeline_config: Dict[str, Any] | None) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute("SELECT tenant_id FROM connections WHERE id = ?", (id,))
    existing = cursor.fetchone()
    if existing and existing["tenant_id"] != tenant_id:
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
    logger.info("Pipeline sync task queued", pipeline_id=id, tenant_id=tenant_id, celery_task_id=async_result.id)
    return {"status": "accepted", "pipeline_id": id, "task_id": async_result.id}

def get_task_status(conn, tenant_id: str, task_id: str) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM connections WHERE tenant_id = ? AND task_id = ?", (tenant_id, task_id))
    row = cursor.fetchone()
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
            cursor.execute(
                "UPDATE connections SET data = ?, updated_at = ? WHERE task_id = ?",
                (json.dumps(conn_data), now, task_id)
            )
            conn.commit()
    return data

def save_auth_driver(conn, tenant_id: str, id: str, code: str) -> Dict[str, str]:
    read_tenant_row(conn, "connections", tenant_id, id)
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing code field.")
    drivers_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "auth_drivers")
    os.makedirs(drivers_dir, exist_ok=True)
    driver_path = os.path.join(drivers_dir, f"{id}_auth_driver.py")
    with open(driver_path, "w", encoding="utf-8") as f:
        f.write(code)
    return {"status": "success", "message": "Auth driver saved successfully."}

def get_active_schema(tenant_id: str) -> Dict[str, List[str]]:
    return {
        "sourceKeys": ["user_id", "email", "created_at", "status_flag", "total_spent", "ip_address"],
        "targetColumns": ["id", "contact_email", "signup_date", "active_status", "lifetime_value", "signup_ip"]
    }
