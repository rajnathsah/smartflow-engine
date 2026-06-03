from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.config import settings

engine = create_engine(
    str(settings.SQLALCHEMY_DATABASE_URI),
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=10,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
