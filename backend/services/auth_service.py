import uuid
import secrets
import string
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from passlib.context import CryptContext
from jose import jwt
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.config import settings
from backend.models import Tenant, User

INVITE_DENIED_MESSAGE = "Access Denied: You have not been invited to this workspace. Please contact your administrator."

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def __init__(self, db: Session, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id

    def seed_data(self) -> None:
        tenant = self.db.query(Tenant).filter(Tenant.name == "System Workspace").first()
        if not tenant:
            tenant_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            tenant = Tenant(
                tenant_id=tenant_id,
                tenant_uuid=tenant_id,
                name="System Workspace",
                created_at=now
            )
            self.db.add(tenant)
            self.db.commit()
            self.db.refresh(tenant)

        user = self.db.query(User).filter(User.email == "admin@synq.to").first()
        if not user:
            now = datetime.utcnow().isoformat()
            user = User(
                email="admin@synq.to",
                username="superadmin",
                password=pwd_context.hash("admin123"),
                tenant_id=tenant.tenant_id,
                tenant_uuid=tenant.tenant_id,
                role="Super_Admin",
                is_first_login=0,
                last_login_at=now
            )
            self.db.add(user)
            self.db.commit()

    def create_token(self, username: str, email: str, tenant_id: str, role: str, purpose: str, minutes: int) -> str:
        expire = datetime.utcnow() + timedelta(minutes=minutes)
        return jwt.encode({
            "sub": username,
            "email": email,
            "tenant_id": tenant_id,
            "tenant_uuid": tenant_id,
            "role": role,
            "purpose": purpose,
            "exp": expire
        }, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    def login_user(self, username: str, password: str, tenant: str) -> Dict[str, Any]:
        if tenant:
            tenant_row = self.db.query(Tenant).filter(func.lower(Tenant.name) == func.lower(tenant)).first()
            if not tenant_row:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
            tenant_id = tenant_row.tenant_id
            user_row = self.db.query(User).filter(
                ((User.username == username) | (User.email == username)) & (User.tenant_id == tenant_id)
            ).first()
            if not user_row:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
            tenant_name = tenant_row.name
        else:
            user_row = self.db.query(User).filter(func.lower(User.email) == func.lower(username)).first()
            if not user_row:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
            tenant_id = user_row.tenant_id
            tenant_row = self.db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            tenant_name = tenant_row.name if tenant_row else ""

        if not pwd_context.verify(password, user_row.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed. Invalid username or password.")

        requires_reset = int(user_row.requires_password_reset or 0) == 1 or int(user_row.is_first_login) == 1
        if requires_reset:
            reset_token = self.create_token(
                user_row.username,
                user_row.email,
                tenant_id,
                user_row.role,
                "first_login_reset",
                settings.RESET_TOKEN_EXPIRE_MINUTES
            )
            raise HTTPException(
                status_code=428,
                detail={
                    "message": "Password reset required",
                    "reset_token": reset_token,
                    "tenant_name": tenant_name,
                    "role": user_row.role,
                    "email": user_row.email,
                    "is_first_login": True
                }
            )

        user_row.last_login_at = datetime.utcnow().isoformat()
        self.db.commit()

        access_token = self.create_token(
            user_row.username,
            user_row.email,
            tenant_id,
            user_row.role,
            "access",
            settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        return {
            "token_key": "access_token",
            "token": access_token,
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "role": user_row.role,
            "email": user_row.email,
            "is_first_login": False
        }

    def register_user(self, tenant: str, username: str, email: str, password: str) -> Dict[str, Any]:
        existing_tenant = self.db.query(Tenant).filter(func.lower(Tenant.name) == func.lower(tenant)).first()
        if existing_tenant:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace name is already registered.")

        existing_user = self.db.query(User).filter(func.lower(User.email) == func.lower(email)).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email address is already registered.")

        tenant_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        new_tenant = Tenant(
            tenant_id=tenant_id,
            tenant_uuid=tenant_id,
            name=tenant,
            created_at=now
        )
        self.db.add(new_tenant)

        new_user = User(
            email=email,
            username=username,
            password=pwd_context.hash(password),
            tenant_id=tenant_id,
            tenant_uuid=tenant_id,
            role="Tenant_Admin",
            is_first_login=0,
            last_login_at=now
        )
        self.db.add(new_user)
        self.db.commit()

        access_token = self.create_token(
            username,
            email,
            tenant_id,
            "Tenant_Admin",
            "access",
            settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        return {
            "token_key": "access_token",
            "token": access_token,
            "tenant_id": tenant_id,
            "tenant_name": tenant,
            "role": "Tenant_Admin",
            "email": email,
            "is_first_login": False
        }

    async def invite_teammate(self, email: str, name: str, role: str, claims: dict) -> Dict[str, Any]:
        if claims.get("role") not in ("Tenant_Admin", "Super_Admin"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only workspace administrators can invite team members.")

        invite_email = email.strip().lower()
        invite_name = name.strip()
        invite_role = role
        if not invite_role or len(invite_role) > 64 or not invite_role.replace("_", "").replace("-", "").replace(" ", "").isalnum():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workspace role requested.")

        existing_user = self.db.query(User).filter(func.lower(User.email) == func.lower(invite_email)).first()
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email address already exists.")

        alphabet = string.ascii_letters + string.digits + "!@#$%"
        temp_password = "".join(secrets.choice(alphabet) for _ in range(14))
        tenant_id = claims["tenant_id"]

        new_user = User(
            email=invite_email,
            username=invite_name,
            password=pwd_context.hash(temp_password),
            tenant_id=tenant_id,
            tenant_uuid=tenant_id,
            role=invite_role,
            is_first_login=1,
            requires_password_reset=1,
            invited_at=datetime.utcnow().isoformat()
        )
        self.db.add(new_user)
        self.db.commit()

        email_sent = False
        email_error = None
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.post(
                    settings.N8N_WEBHOOK_URL,
                    json={
                        "user_email": invite_email,
                        "temp_password": temp_password
                    },
                    headers={"Content-Type": "application/json"}
                )
                email_sent = res.status_code in (200, 201, 202)
                if not email_sent:
                    email_error = res.text
        except Exception as exc:
            email_error = str(exc)

        return {
            "email": invite_email,
            "name": invite_name,
            "role": invite_role,
            "temp_password": "",
            "email_sent": email_sent,
            "email_error": email_error
        }

    def reset_user_password(self, new_password: str, claims: dict) -> Dict[str, Any]:
        if not new_password or len(new_password) < 8:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")

        tenant_id = claims["tenant_id"]
        email = claims["email"]
        user_row = self.db.query(User).filter(
            (User.email == email) &
            (User.tenant_id == tenant_id) &
            ((User.is_first_login == 1) | (User.requires_password_reset == 1))
        ).first()

        if not user_row:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password reset is not available for this account.")

        user_row.password = pwd_context.hash(new_password)
        user_row.is_first_login = 0
        user_row.requires_password_reset = 0
        user_row.last_login_at = datetime.utcnow().isoformat()
        self.db.commit()

        tenant_row = self.db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        access_token = self.create_token(
            claims["sub"],
            email,
            tenant_id,
            claims["role"],
            "access",
            settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        return {
            "token_key": "access_token",
            "token": access_token,
            "tenant_id": tenant_id,
            "tenant_name": tenant_row.name if tenant_row else "",
            "role": claims["role"],
            "email": email,
            "is_first_login": False
        }

    def authenticate_google(self, email: str, name: str, google_id: str) -> Dict[str, Any]:
        user_row = self.db.query(User).filter(func.lower(User.email) == func.lower(email)).first()
        if user_row:
            tenant_id = user_row.tenant_id
            role = user_row.role
            username = user_row.username
            user_row.google_linked = 1
            user_row.google_id = google_id
            user_row.is_first_login = 0
            user_row.last_login_at = datetime.utcnow().isoformat()
            tenant_row = self.db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            tenant_name = tenant_row.name if tenant_row else ""
        else:
            tenant_id = str(uuid.uuid4())
            tenant_name = f"{name}'s Workspace"
            now = datetime.utcnow().isoformat()
            new_tenant = Tenant(
                tenant_id=tenant_id,
                tenant_uuid=tenant_id,
                name=tenant_name,
                created_at=now
            )
            self.db.add(new_tenant)

            new_user = User(
                email=email,
                username=name,
                password="",
                tenant_id=tenant_id,
                tenant_uuid=tenant_id,
                role="Tenant_Admin",
                is_first_login=0,
                google_linked=1,
                google_id=google_id,
                last_login_at=now
            )
            self.db.add(new_user)
            username = name
            role = "Tenant_Admin"

        self.db.commit()
        access_token = self.create_token(
            username,
            email,
            tenant_id,
            role,
            "access",
            settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        return {
            "token_key": "access_token",
            "token": access_token,
            "tenant_id": tenant_id,
            "tenant_name": tenant_name,
            "role": role,
            "email": email,
            "is_first_login": False
        }

    def get_workspace_users(self) -> List[Dict[str, Any]]:
        rows = self.db.query(User).filter(User.tenant_id == self.tenant_id).all()
        return [
            {
                "name": row.username,
                "email": row.email,
                "role": row.role,
                "status": "Active" if int(row.is_first_login) == 0 or int(row.google_linked) == 1 else "Inactive",
                "last_login": row.last_login_at or "Never logged in"
            }
            for row in rows
        ]
