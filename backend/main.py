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
    from backend.config import settings
    from sqlalchemy import create_engine, text
    import urllib.parse
    import time

    # Retrying parameters
    max_retries = 15
    retry_interval = 2.0

    # 1. Ensure the database exists
    database_ready = False
    logger.info("Checking/creating database connection...")
    for attempt in range(1, max_retries + 1):
        try:
            host = settings.POSTGRES_SERVER
            if host.lower() in ("localhost", "127.0.0.1", "::1") and settings.POSTGRES_DOCKER_HOST:
                host = settings.POSTGRES_DOCKER_HOST

            escaped_user = urllib.parse.quote_plus(settings.POSTGRES_USER)
            escaped_password = urllib.parse.quote_plus(settings.POSTGRES_PASSWORD)
            default_db_uri = f"postgresql+psycopg://{escaped_user}:{escaped_password}@{host}:{settings.POSTGRES_PORT}/postgres"
            
            temp_engine = create_engine(default_db_uri, isolation_level="AUTOCOMMIT")
            with temp_engine.connect() as conn:
                result = conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                    {"dbname": settings.POSTGRES_DB}
                )
                exists = result.scalar() is not None
                if not exists:
                    logger.info(f"Database '{settings.POSTGRES_DB}' does not exist. Creating...")
                    safe_db_name = settings.POSTGRES_DB.replace('"', '""')
                    conn.execute(text(f'CREATE DATABASE "{safe_db_name}"'))
                    logger.info(f"Database '{settings.POSTGRES_DB}' created successfully.")
                else:
                    logger.info(f"Database '{settings.POSTGRES_DB}' already exists.")
            temp_engine.dispose()
            database_ready = True
            break
        except Exception as exc:
            logger.warning(
                f"Attempt {attempt}/{max_retries} to ensure database '{settings.POSTGRES_DB}' exists failed: {str(exc)}. "
                f"Retrying in {retry_interval}s..."
            )
            time.sleep(retry_interval)

    if not database_ready:
        logger.error(f"Failed to ensure database '{settings.POSTGRES_DB}' exists after {max_retries} attempts.")
        raise RuntimeError(f"Could not connect to or create database '{settings.POSTGRES_DB}'")

    # 2. Run migrations and/or create schemas + vector extension
    schema_ready = False
    logger.info("Initializing database schemas and vector extension...")
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
            Base.metadata.create_all(bind=engine)
            logger.info("Database schemas and pgvector extension initialized successfully")
            schema_ready = True
            break
        except Exception as exc:
            logger.warning(
                f"Attempt {attempt}/{max_retries} to initialize schemas failed: {str(exc)}. "
                f"Retrying in {retry_interval}s..."
            )
            time.sleep(retry_interval)

    if not schema_ready:
        logger.error("Failed to initialize database schemas and extension.")
        raise RuntimeError("Database schema/extension initialization failed")

    # 3. Seed data
    seeding_completed = False
    logger.info("Seeding database...")
    for attempt in range(1, max_retries + 1):
        try:
            with SessionLocal() as db:
                auth_service = AuthService(db)
                auth_service.seed_data()
            logger.info("Database seeding completed successfully")
            seeding_completed = True
            break
        except Exception as exc:
            logger.warning(
                f"Attempt {attempt}/{max_retries} to seed database failed: {str(exc)}. "
                f"Retrying in {retry_interval}s..."
            )
            time.sleep(retry_interval)

    if not seeding_completed:
        logger.error("Failed to complete database seeding.")
        raise RuntimeError("Database seeding failed")
