from sqlalchemy import String, ForeignKey, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from backend.models import Base

class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    source_connection_id: Mapped[str] = mapped_column(ForeignKey("connections.id"), nullable=False)
    destination_connection_id: Mapped[str] = mapped_column(ForeignKey("connections.id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    schema_mapping: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    source_connection: Mapped["Connection"] = relationship(foreign_keys=[source_connection_id])
    destination_connection: Mapped["Connection"] = relationship(foreign_keys=[destination_connection_id])


class PipelineRunLog(Base):
    """Stores structured log entries for each pipeline task execution."""
    __tablename__ = "pipeline_run_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    run_id: Mapped[str] = mapped_column(String, nullable=False, index=True)  # Celery task_id
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    pipeline_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    level: Mapped[str] = mapped_column(String, nullable=False)  # INFO | WARNING | ERROR | DEBUG
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    timestamp: Mapped[str] = mapped_column(String, nullable=False)  # ISO-8601
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)  # ordering
    extra: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

class Connection(Base):
    __tablename__ = "connections"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

class Log(Base):
    __tablename__ = "logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
