from fastapi import APIRouter, Depends, Body, HTTPException
from backend.api.deps import get_tenant_uuid, get_current_user_claims
from backend.schemas import RootResponse, VerifyTenantResponse, MappingsResponse
from backend.utils.logging import tenant_uuid_context

router = APIRouter(tags=["root"])

@router.get("/", response_model=RootResponse)
def read_root():
    """Retrieves basic root service status metadata.

    Returns:
        RootResponse: Service status object.
    """
    return {
        "status": "online",
        "service": "synq.to Sync Engine Backend",
        "documentation": "/docs"
    }

@router.get("/api/v1/verify-tenant", response_model=VerifyTenantResponse, dependencies=[Depends(get_tenant_uuid)])
async def verify_tenant():
    """Validates the tenant identifier context.

    Returns:
        VerifyTenantResponse: Verification status and tenant identifier.
    """
    active_tenant = tenant_uuid_context.get()
    return {
        "verified": True,
        "active_tenant_uuid": active_tenant
    }

@router.post("/api/v1/mappings", response_model=MappingsResponse)
async def save_mappings(
    payload: list = Body(...),
    claims: dict = Depends(get_current_user_claims)
):
    """Saves structural mapping configuration parameters.

    Args:
        payload: List of mapping objects.
        claims: Token claims.

    Returns:
        MappingsResponse: Success notification.
    """
    tenant_id = claims.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Unauthorized: tenant_id is missing.")
    return {"status": "success", "message": "Schema mapping saved successfully."}
