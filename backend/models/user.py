from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from backend.models import Base

class User(Base):
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
