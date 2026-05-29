from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from typing import Optional, List

class Base(DeclarativeBase):
    """Declarative Base class for all ORM models."""
    pass

class Tenant(Base):
    """ORM representation of the tenants table."""
    __tablename__ = "tenants"

    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_uuid: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    users: Mapped[List["User"]] = relationship("User", back_populates="tenant")

class User(Base):
    """ORM representation of the users table."""
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String, primary_key=True)
    username: Mapped[str] = mapped_column(String, nullable=False)
    password: Mapped[str] = mapped_column(String, nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=True)
    tenant_uuid: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=False)
    is_first_login: Mapped[int] = mapped_column(Integer, default=1)
    requires_password_reset: Mapped[int] = mapped_column(Integer, default=0)
    google_linked: Mapped[int] = mapped_column(Integer, default=0)
    google_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    invited_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    last_login_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", back_populates="users")

class Source(Base):
    """ORM representation of the sources table."""
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

class Destination(Base):
    """ORM representation of the destinations table."""
    __tablename__ = "destinations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

class Connection(Base):
    """ORM representation of the connections table."""
    __tablename__ = "connections"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

class Log(Base):
    """ORM representation of the logs table."""
    __tablename__ = "logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.tenant_id"), nullable=False)
    data: Mapped[str] = mapped_column(String, nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
