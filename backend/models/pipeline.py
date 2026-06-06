from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from backend.models import Base

class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    source_connection_id: Mapped[str] = mapped_column(ForeignKey("connections.id"), nullable=False)
    destination_connection_id: Mapped[str] = mapped_column(ForeignKey("connections.id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    source_connection: Mapped["Connection"] = relationship(foreign_keys=[source_connection_id])
    destination_connection: Mapped["Connection"] = relationship(foreign_keys=[destination_connection_id])

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
