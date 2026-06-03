from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.api.routes import pipelines
from backend.api.routes.documents import router as documents_router
from backend.api.routes.auth import router as auth_router
from backend.api.routes.root import router as root_router
from backend.utils.logging import configure_logging, logger
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

from backend.api.middleware import GlobalMiddleware

app.add_middleware(GlobalMiddleware)

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
app.include_router(root_router)

@app.on_event("startup")
def on_startup():
    from backend.database.database import engine, SessionLocal
    from backend.models import Base
    from backend.services.auth_service import AuthService
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
        Base.metadata.create_all(bind=engine)
        logger.info("Database schemas and pgvector extension initialized successfully")
    except Exception as exc:
        logger.error(f"Database schema initialization failed: {str(exc)}")

    try:
        with SessionLocal() as db:
            auth_service = AuthService(db)
            auth_service.seed_data()
        logger.info("Database seeding completed successfully")
    except Exception as exc:
        logger.error(f"Database seeding failed: {str(exc)}")
