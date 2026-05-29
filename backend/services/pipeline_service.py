import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List
from celery.result import AsyncResult
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend.utils.logging import logger
from backend.workers.tasks import sync_pipeline_task
from backend.workers.celery_app import app as celery_app
from backend.models import Source, Destination, Connection, Log

def _get_model_class(table: str):
    """Retrieves the SQLAlchemy model class based on the table name.

    Args:
        table: Target table name.

    Returns:
        type: SQLAlchemy model class.
    """
    mapping = {
        "sources": Source,
        "destinations": Destination,
        "connections": Connection,
        "logs": Log
    }
    cls = mapping.get(table.lower())
    if not cls:
        raise ValueError(f"Unknown table representation: {table}")
    return cls

class PipelineService:
    """Pipeline service handling data source, destination, connection configurations and ETL orchestration."""

    def read_tenant_rows(self, db: Session, table: str, tenant_id: str) -> List[Dict[str, Any]]:
        """Reads all rows for a given tenant workspace.

        Args:
            db: The SQLAlchemy session.
            table: Target table name.
            tenant_id: Tenant workspace ID.

        Returns:
            list: List of row dictionaries.
        """
        cls = _get_model_class(table)
        rows = db.query(cls).filter(cls.tenant_id == tenant_id).order_by(cls.created_at.desc()).all()
        return [{**json.loads(row.data), "id": row.id} for row in rows]

    def read_tenant_row(self, db: Session, table: str, tenant_id: str, item_id: str) -> Dict[str, Any]:
        """Reads a specific row for a tenant workspace.

        Args:
            db: The SQLAlchemy session.
            table: Target table name.
            tenant_id: Tenant workspace ID.
            item_id: Row identifier.

        Returns:
            dict: The matching row dictionary.
        """
        cls = _get_model_class(table)
        row = db.query(cls).filter((cls.tenant_id == tenant_id) & (cls.id == item_id)).first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
        return {**json.loads(row.data), "id": row.id}

    def upsert_tenant_row(self, db: Session, table: str, tenant_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
        """Inserts or updates a tenant configuration row.

        Args:
            db: The SQLAlchemy session.
            table: Target table name.
            tenant_id: Tenant workspace ID.
            item: Raw config dictionary.

        Returns:
            dict: Upserted config dictionary.
        """
        cls = _get_model_class(table)
        item_id = str(item.get("id") or uuid.uuid4())
        existing = db.query(cls).filter(cls.id == item_id).first()
        if existing and existing.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Resource belongs to another tenant."
            )
        now = datetime.utcnow().isoformat()
        data = {**item, "id": item_id, "tenant_id": tenant_id}
        if existing:
            existing.data = json.dumps(data)
            existing.updated_at = now
        else:
            new_row = cls(
                id=item_id,
                tenant_id=tenant_id,
                data=json.dumps(data),
                created_at=now,
                updated_at=now
            )
            db.add(new_row)
        db.commit()
        return data

    def update_tenant_row(self, db: Session, table: str, tenant_id: str, item_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
        """Updates a specific tenant configuration row.

        Args:
            db: The SQLAlchemy session.
            table: Target table name.
            tenant_id: Tenant workspace ID.
            item_id: Row identifier.
            item: Configuration payload.

        Returns:
            dict: Updated configuration dictionary.
        """
        self.read_tenant_row(db, table, tenant_id, item_id)
        cls = _get_model_class(table)
        row = db.query(cls).filter((cls.tenant_id == tenant_id) & (cls.id == item_id)).first()
        now = datetime.utcnow().isoformat()
        data = {**item, "id": item_id, "tenant_id": tenant_id}
        row.data = json.dumps(data)
        row.updated_at = now
        db.commit()
        return data

    def delete_tenant_row(self, db: Session, table: str, tenant_id: str, item_id: str) -> Dict[str, str]:
        """Deletes a tenant configuration row.

        Args:
            db: The SQLAlchemy session.
            table: Target table name.
            tenant_id: Tenant workspace ID.
            item_id: Row identifier.

        Returns:
            dict: Status dictionary.
        """
        cls = _get_model_class(table)
        row = db.query(cls).filter((cls.tenant_id == tenant_id) & (cls.id == item_id)).first()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
        db.delete(row)
        db.commit()
        return {"status": "deleted", "id": item_id}

    def save_log(self, db: Session, tenant_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Saves a sync operation log.

        Args:
            db: The SQLAlchemy session.
            tenant_id: Tenant workspace ID.
            payload: Log message payload.

        Returns:
            dict: Stored log data dictionary.
        """
        now = datetime.utcnow().isoformat()
        log_id = str(payload.get("id") or uuid.uuid4())
        data = {**payload, "id": log_id, "tenant_id": tenant_id}
        new_log = Log(
            id=log_id,
            tenant_id=tenant_id,
            data=json.dumps(data),
            created_at=now
        )
        db.add(new_log)
        db.commit()
        return data

    def get_active_pipelines(self, db: Session, tenant_id: str) -> List[Dict[str, Any]]:
        """Retrieves and updates active ETL sync pipelines states.

        Args:
            db: The SQLAlchemy session.
            tenant_id: Tenant workspace ID.

        Returns:
            list: Active pipeline dictionaries.
        """
        rows = db.query(Connection).filter(Connection.tenant_id == tenant_id).order_by(Connection.updated_at.desc()).all()
        active = []
        for row in rows:
            data = json.loads(row.data)
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
                    row.data = json.dumps(data)
                    row.updated_at = now
                    db.commit()
            if status_val in ("syncing", "failed", "completed", "active"):
                active.append({
                    "id": row.id,
                    "name": data.get("name", row.id),
                    "sourceUrl": data.get("sourceUrl", ""),
                    "targetTable": data.get("targetDbName", ""),
                    "rowsFetched": records_synced,
                    "rowsInserted": records_synced,
                    "totalRows": max(records_synced, 1),
                    "errorsCount": 1 if status_val == "failed" else 0,
                    "status": "syncing" if status_val == "syncing" else ("failed" if status_val == "failed" else "completed")
                })
        return active

    def trigger_pipeline_sync(self, db: Session, tenant_id: str, id: str, pipeline_config: Dict[str, Any] | None) -> Dict[str, Any]:
        """Launches a sync execution for a pipeline.

        Args:
            db: The SQLAlchemy session.
            tenant_id: Tenant workspace ID.
            id: Connection / pipeline identifier.
            pipeline_config: Context payload dictionary.

        Returns:
            dict: Celery task acceptance parameters.
        """
        existing = db.query(Connection).filter(Connection.id == id).first()
        if existing and existing.tenant_id != tenant_id:
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
        if existing:
            existing.data = json.dumps(data)
            existing.task_id = async_result.id
            existing.updated_at = now
        else:
            new_conn = Connection(
                id=id,
                tenant_id=tenant_id,
                data=json.dumps(data),
                task_id=async_result.id,
                created_at=now,
                updated_at=now
            )
            db.add(new_conn)
        db.commit()
        logger.info("Pipeline sync task queued", pipeline_id=id, tenant_id=tenant_id, celery_task_id=async_result.id)
        return {"status": "accepted", "pipeline_id": id, "task_id": async_result.id}

    def get_task_status(self, db: Session, tenant_id: str, task_id: str) -> Dict[str, Any]:
        """Checks and caches Celery task execution status.

        Args:
            db: The SQLAlchemy session.
            tenant_id: Tenant workspace ID.
            task_id: Celery task ID.

        Returns:
            dict: Task status dictionary.
        """
        row = db.query(Connection).filter((Connection.tenant_id == tenant_id) & (Connection.task_id == task_id)).first()
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
            conn_data = json.loads(row.data)
            if conn_data.get("status") == "syncing":
                conn_data["status"] = status_val
                conn_data["recordsSynced"] = records_synced
                now = datetime.utcnow().isoformat()
                row.data = json.dumps(conn_data)
                row.updated_at = now
                db.commit()
        return data

    def save_auth_driver(self, db: Session, tenant_id: str, id: str, code: str) -> Dict[str, str]:
        """Writes custom authentication driver script.

        Args:
            db: The SQLAlchemy session.
            tenant_id: Tenant workspace ID.
            id: Target connection ID.
            code: Python script string.

        Returns:
            dict: Status outcomes.
        """
        self.read_tenant_row(db, "connections", tenant_id, id)
        if not code:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing code field.")
        drivers_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "auth_drivers")
        os.makedirs(drivers_dir, exist_ok=True)
        driver_path = os.path.join(drivers_dir, f"{id}_auth_driver.py")
        with open(driver_path, "w", encoding="utf-8") as f:
            f.write(code)
        return {"status": "success", "message": "Auth driver saved successfully."}

    def get_active_schema(self, tenant_id: str) -> Dict[str, List[str]]:
        """Returns structural mapping columns schema.

        Args:
            tenant_id: Tenant workspace ID.

        Returns:
            dict: Key mapping list maps.
        """
        return {
            "sourceKeys": ["user_id", "email", "created_at", "status_flag", "total_spent", "ip_address"],
            "targetColumns": ["id", "contact_email", "signup_date", "active_status", "lifetime_value", "signup_ip"]
        }
