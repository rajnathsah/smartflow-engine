import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.config import settings
from backend.utils.logging import logger

def ensure_database_exists():
    host = settings.POSTGRES_SERVER
    if host.lower() in ("localhost", "127.0.0.1", "::1") and settings.POSTGRES_DOCKER_HOST:
        host = settings.POSTGRES_DOCKER_HOST

    escaped_user = urllib.parse.quote_plus(settings.POSTGRES_USER)
    escaped_password = urllib.parse.quote_plus(settings.POSTGRES_PASSWORD)
    db_name = settings.POSTGRES_DB
    
    # Try connecting directly
    test_db_uri = f"postgresql+psycopg://{escaped_user}:{escaped_password}@{host}:{settings.POSTGRES_PORT}/{db_name}"
    
    try:
        # Check connection to target DB
        engine_test = create_engine(test_db_uri)
        with engine_test.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine_test.dispose()
    except Exception as e:
        err_msg = str(e)
        # Catch psycopg OperationalError or other exceptions with code 3D000 (database does not exist)
        is_missing_db = "3D000" in err_msg or "does not exist" in err_msg
        
        if is_missing_db:
            logger.warning(f"[Auto-Heal] Database '{db_name}' does not exist. Connecting to default 'postgres' database to create it.")
            default_db_uri = f"postgresql+psycopg://{escaped_user}:{escaped_password}@{host}:{settings.POSTGRES_PORT}/postgres"
            try:
                temp_engine = create_engine(default_db_uri, isolation_level="AUTOCOMMIT")
                with temp_engine.connect() as conn:
                    safe_db_name = db_name.replace('"', '""')
                    conn.execute(text(f'CREATE DATABASE "{safe_db_name}"'))
                temp_engine.dispose()
                logger.warning(f"[Auto-Heal] Database created successfully: '{db_name}'")
            except Exception as create_err:
                logger.error(f"[Auto-Heal] Failed to auto-create database '{db_name}': {str(create_err)}")
                raise
        else:
            logger.error(f"[Auto-Heal] Database connection check failed: {err_msg}")
            raise

# Ensure target database exists before creating application engine
try:
    ensure_database_exists()
except Exception as e:
    logger.error(f"[Auto-Heal] Database pre-flight check error: {str(e)}")

# Create target application database engine
engine = create_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=10,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Auto-Create System Tables (ORM) on module import
try:
    from backend.models import Base
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    logger.warning("[Auto-Heal] Database schemas and pgvector extension validated/created successfully.")
except Exception as schema_err:
    logger.error(f"[Auto-Heal] Failed to auto-initialize ORM schemas: {str(schema_err)}")

def get_db():
    """Dependency generator to retrieve database sessions.

    Yields:
        SessionLocal: An active SQLAlchemy database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
