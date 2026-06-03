from fastapi import APIRouter, Depends, Body, HTTPException, Request
from backend.schemas.auth import RootResponse, VerifyTenantResponse
from backend.schemas.pipelines import MappingsResponse

router = APIRouter(tags=["root"])

@router.get("/", response_model=RootResponse)
def read_root():
    return {
        "status": "online",
        "service": "synq.to Sync Engine Backend",
        "documentation": "/docs"
    }

@router.get("/api/v1/verify-tenant", response_model=VerifyTenantResponse)
async def verify_tenant(request: Request):
    return {
        "verified": True,
        "active_tenant_uuid": request.state.tenant_id
    }

@router.post("/api/v1/mappings", response_model=MappingsResponse)
async def save_mappings(
    request: Request,
    payload: list = Body(...)
):
    tenant_id = request.state.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Unauthorized: tenant_id is missing.")
    return {"status": "success", "message": "Schema mapping saved successfully."}
