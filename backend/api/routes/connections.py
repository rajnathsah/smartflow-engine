from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from backend.api.deps import get_db, get_current_user_claims
from backend.services.pipeline_service import PipelineService
from backend.utils.connection_tester import test_db_connection
from typing import Dict, Any

router = APIRouter(prefix="/api/v1/connections", tags=["connections"])

def get_pipeline_service(request: Request, db: Session = Depends(get_db)) -> PipelineService:
    tenant_id = getattr(request.state, "tenant_id", None) or "System Workspace"
    return PipelineService(db, tenant_id)

@router.post("/test-dry-run")
async def test_connection_dry_run(
    payload: Dict[str, Any] = Body(...),
    claims: dict = Depends(get_current_user_claims)
):
    """Verifies connection configuration before saving (Dry Run)."""
    try:
        res = await test_db_connection(payload)
        return res
    except Exception as e:
        return {"success": False, "message": f"Connection test failed: {str(e)}"}

@router.post("/{connection_id}/test")
async def test_connection_saved(
    connection_id: str,
    pipeline_service: PipelineService = Depends(get_pipeline_service),
    claims: dict = Depends(get_current_user_claims)
):
    """Fetches saved connection credentials and runs verification tests."""
    try:
        res = await pipeline_service.test_connection(connection_id)
        return res
    except Exception as e:
        return {"success": False, "message": f"Connection test failed: {str(e)}"}
