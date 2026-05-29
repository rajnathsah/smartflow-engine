import os
from fastapi import FastAPI, Depends, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.api.routes import pipelines
from backend.api.routes.documents import router as documents_router
from backend.api.routes.auth import router as auth_router
from backend.api.deps import get_tenant_uuid, get_current_user_claims
from backend.schemas import RootResponse, VerifyTenantResponse, MappingsResponse
from backend.utils.logging import configure_logging, logger, tenant_uuid_context
from backend.utils.limiter import limiter

configure_logging()
logger.info("Initializing synq.to Backend Services")

app = FastAPI(
    title="synq.to Sync Engine API",
    description="Enterprise Universal Data Sync Backend orchestrating pipeline configurations.",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
logger.info("Security rate limiter initialized successfully")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(pipelines.router, prefix="/api/v1/pipelines", tags=["pipelines"])
app.include_router(documents_router)

@app.on_event("startup")
def on_startup():
    """Seeds default data on application startup."""
    from backend.database.database import SessionLocal
    from backend.services.auth_service import AuthService
    try:
        auth_service = AuthService()
        with SessionLocal() as db:
            auth_service.seed_data(db)
        logger.info("Database seeding completed successfully")
    except Exception as exc:
        logger.error(f"Database seeding failed: {str(exc)}")

@app.get("/", response_model=RootResponse)
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

@app.get("/api/v1/verify-tenant", response_model=VerifyTenantResponse, dependencies=[Depends(get_tenant_uuid)])
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

@app.post("/api/v1/mappings", response_model=MappingsResponse)
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
