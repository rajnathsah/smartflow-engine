from typing import Any, Dict, List
from fastapi import APIRouter, Body, Depends, HTTPException, status
from backend.database import get_pg_connection
from backend.api.routes.auth import get_current_user_claims
from backend.services import pipeline_service

router = APIRouter()

def get_conn():
    conn = get_pg_connection()
    try:
        yield conn
    finally:
        conn.close()

def _check_tenant_id(claims: dict) -> str:
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized: tenant_id is missing.")
    return tenant_id

@router.get("/sources")
async def list_sources(claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> List[Dict[str, Any]]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.read_tenant_rows(conn, "sources", tenant_id)

@router.get("/sources/{id}")
async def get_source(id: str, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.read_tenant_row(conn, "sources", tenant_id, id)

@router.post("/sources", status_code=status.HTTP_201_CREATED)
async def save_source(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.upsert_tenant_row(conn, "sources", tenant_id, payload)

@router.put("/sources/{id}")
async def update_source(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.update_tenant_row(conn, "sources", tenant_id, id, payload)

@router.delete("/sources/{id}")
async def delete_source(id: str, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, str]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.delete_tenant_row(conn, "sources", tenant_id, id)

@router.get("/destinations")
async def list_destinations(claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> List[Dict[str, Any]]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.read_tenant_rows(conn, "destinations", tenant_id)

@router.get("/destinations/{id}")
async def get_destination(id: str, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.read_tenant_row(conn, "destinations", tenant_id, id)

@router.post("/destinations", status_code=status.HTTP_201_CREATED)
async def save_destination(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.upsert_tenant_row(conn, "destinations", tenant_id, payload)

@router.put("/destinations/{id}")
async def update_destination(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.update_tenant_row(conn, "destinations", tenant_id, id, payload)

@router.delete("/destinations/{id}")
async def delete_destination(id: str, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, str]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.delete_tenant_row(conn, "destinations", tenant_id, id)

@router.get("/connections")
async def list_connections(claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> List[Dict[str, Any]]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.read_tenant_rows(conn, "connections", tenant_id)

@router.get("/connections/{id}")
async def get_connection(id: str, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.read_tenant_row(conn, "connections", tenant_id, id)

@router.post("/connections", status_code=status.HTTP_201_CREATED)
async def save_connection(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.upsert_tenant_row(conn, "connections", tenant_id, payload)

@router.put("/connections/{id}")
async def update_connection(id: str, payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.update_tenant_row(conn, "connections", tenant_id, id, payload)

@router.delete("/connections/{id}")
async def delete_connection(id: str, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, str]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.delete_tenant_row(conn, "connections", tenant_id, id)

@router.get("/logs")
async def list_logs(claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> List[Dict[str, Any]]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.read_tenant_rows(conn, "logs", tenant_id)

@router.post("/logs", status_code=status.HTTP_201_CREATED)
async def save_log(payload: Dict[str, Any] = Body(...), claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.save_log(conn, tenant_id, payload)

@router.get("/active")
async def active_pipelines(claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> List[Dict[str, Any]]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.get_active_pipelines(conn, tenant_id)

@router.post("/{id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_pipeline_sync(
    id: str,
    pipeline_config: Dict[str, Any] | None = Body(default=None),
    claims: dict = Depends(get_current_user_claims),
    conn = Depends(get_conn)
) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.trigger_pipeline_sync(conn, tenant_id, id, pipeline_config)

@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)) -> Dict[str, Any]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.get_task_status(conn, tenant_id, task_id)

@router.post("/{id}/auth-driver")
async def save_auth_driver(
    id: str,
    payload: Dict[str, str] = Body(...),
    claims: dict = Depends(get_current_user_claims),
    conn = Depends(get_conn)
) -> Dict[str, str]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.save_auth_driver(conn, tenant_id, id, payload.get("code", ""))

@router.get("/active/schema")
async def get_active_schema(claims: dict = Depends(get_current_user_claims)) -> Dict[str, List[str]]:
    tenant_id = _check_tenant_id(claims)
    return pipeline_service.get_active_schema(tenant_id)
