from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.api import pipelines
from backend.api.auth import router as auth_router, get_tenant_uuid
from backend.utils.logging import configure_logging, logger, tenant_uuid_context
from backend.utils.limiter import limiter

# 1. Initialize Structured JSON Logger
configure_logging()
logger.info("Initializing synq.to Backend Services")

app = FastAPI(
    title="synq.to Sync Engine API",
    description="Enterprise Universal Data Sync Backend orchestrating pipeline configurations.",
    version="1.0.0"
)

# 2. Configure SlowAPI Rate Limiting Integration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
logger.info("Security rate limiter initialized successfully")

# Configure CORS to allow dashboard frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production environments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register authentication routing
app.include_router(auth_router)
app.include_router(pipelines.router, prefix="/api/v1/pipelines", tags=["pipelines"])


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "synq.to Sync Engine Backend",
        "documentation": "/docs"
    }


@app.get("/api/v1/verify-tenant", dependencies=[Depends(get_tenant_uuid)])
async def verify_tenant():
    """
    Sample protected endpoint to verify JWT tenant context extraction.
    Returns the currently active tenant_uuid injected into the thread context.
    """
    active_tenant = tenant_uuid_context.get()
    return {
        "verified": True,
        "active_tenant_uuid": active_tenant
    }
