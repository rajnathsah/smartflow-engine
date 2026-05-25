import os
import uuid
import sqlite3
import secrets
import string
import httpx
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from passlib.context import CryptContext
from dotenv import load_dotenv
from backend.utils.limiter import limiter
from backend.utils.logging import tenant_uuid_context

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "synq-jwt-super-secret-key-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120
RESET_TOKEN_EXPIRE_MINUTES = 15
INVITE_DENIED_MESSAGE = "Access Denied: You have not been invited to this workspace. Please contact your administrator."

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
security_bearer = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "synq_auth.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_columns(cursor, table: str, columns: dict[str, str]):
    cursor.execute(f"PRAGMA table_info({table})")
    existing = {row["name"] for row in cursor.fetchall()}
    for name, ddl in columns.items():
        if name not in existing:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def table_columns(cursor, table: str) -> set[str]:
    cursor.execute(f"PRAGMA table_info({table})")
    return {row["name"] for row in cursor.fetchall()}


def insert_tenant(cursor, tenant_id: str, name: str, created_at: str):
    cols = table_columns(cursor, "tenants")
    if "uuid" in cols:
        cursor.execute(
            "INSERT INTO tenants (uuid, tenant_id, tenant_uuid, name, created_at) VALUES (?, ?, ?, ?, ?)",
            (tenant_id, tenant_id, tenant_id, name, created_at)
        )
        return
    cursor.execute(
        "INSERT INTO tenants (tenant_id, tenant_uuid, name, created_at) VALUES (?, ?, ?, ?)",
        (tenant_id, tenant_id, name, created_at)
    )


def init_db():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        tenant_uuid TEXT UNIQUE,
        name TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        tenant_id TEXT,
        tenant_uuid TEXT,
        role TEXT NOT NULL,
        is_first_login INTEGER DEFAULT 1,
        google_linked INTEGER DEFAULT 0,
        google_id TEXT,
        invited_at TEXT,
        last_login_at TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    )
    """)
    ensure_columns(cursor, "tenants", {
        "tenant_id": "TEXT",
        "tenant_uuid": "TEXT",
        "created_at": "TEXT"
    })
    ensure_columns(cursor, "users", {
        "tenant_id": "TEXT",
        "tenant_uuid": "TEXT",
        "invited_at": "TEXT",
        "last_login_at": "TEXT",
        "google_id": "TEXT"
    })
    cols = table_columns(cursor, "tenants")
    if "uuid" in cols:
        cursor.execute("UPDATE tenants SET tenant_id = COALESCE(tenant_id, tenant_uuid, uuid)")
        cursor.execute("UPDATE tenants SET tenant_uuid = COALESCE(tenant_uuid, tenant_id, uuid)")
    else:
        cursor.execute("UPDATE tenants SET tenant_id = COALESCE(tenant_id, tenant_uuid)")
        cursor.execute("UPDATE tenants SET tenant_uuid = COALESCE(tenant_uuid, tenant_id)")
    cursor.execute("UPDATE tenants SET created_at = COALESCE(created_at, ?)", (datetime.utcnow().isoformat(),))
    cursor.execute("UPDATE users SET tenant_id = COALESCE(tenant_id, tenant_uuid)")
    cursor.execute("UPDATE users SET tenant_uuid = COALESCE(tenant_uuid, tenant_id)")
    for table in ("sources", "destinations", "connections", "logs"):
        cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {table} (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            data TEXT NOT NULL,
            task_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
        )
        """)
        ensure_columns(cursor, table, {"tenant_id": "TEXT"})
    conn.commit()
    conn.close()


def seed_data():
    conn = get_conn()
    cursor = conn.cursor()
    tenant_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute("SELECT tenant_id FROM tenants WHERE name = ?", ("System Workspace",))
    if not cursor.fetchone():
        insert_tenant(cursor, tenant_id, "System Workspace", now)
    cursor.execute("SELECT tenant_id FROM tenants WHERE name = ?", ("System Workspace",))
    tenant_id = cursor.fetchone()["tenant_id"]
    cursor.execute("SELECT email FROM users WHERE email = ?", ("admin@synq.to",))
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (email, username, password, tenant_id, tenant_uuid, role, is_first_login, last_login_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
            ("admin@synq.to", "superadmin", pwd_context.hash("admin123"), tenant_id, tenant_id, "Super_Admin", now)
        )
    conn.commit()
    conn.close()


init_db()
seed_data()


class LoginRequest(BaseModel):
    tenant: str = ""
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    reset_token: Optional[str] = None
    token_type: str
    tenant_id: str
    tenant_uuid: str
    tenant_name: str
    role: str
    email: str
    is_first_login: bool


class RegisterRequest(BaseModel):
    tenant: str
    username: str
    email: str
    password: str


class InviteRequest(BaseModel):
    email: str
    name: str
    role: str = "Tenant_User"


class InviteResponse(BaseModel):
    email: str
    name: str
    role: str
    temp_password: str
    email_sent: bool
    resend_configured: bool = False
    email_error: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    new_password: str


class GoogleLoginRequest(BaseModel):
    email: str
    name: str


class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    google_id: str


class UserRecordResponse(BaseModel):
    name: str
    email: str
    role: str
    status: str
    last_login: str


def create_token(username: str, email: str, tenant_id: str, role: str, purpose: str, minutes: int):
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    return jwt.encode({
        "sub": username,
        "email": email,
        "tenant_id": tenant_id,
        "tenant_uuid": tenant_id,
        "role": role,
        "purpose": purpose,
        "exp": expire
    }, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_claims_for_purpose(purpose: str, credentials: HTTPAuthorizationCredentials):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        tenant_id = payload.get("tenant_id") or payload.get("tenant_uuid")
        if not tenant_id or payload.get("purpose") != purpose:
            raise JWTError()
        payload["tenant_id"] = tenant_id
        payload["tenant_uuid"] = tenant_id
        tenant_uuid_context.set(tenant_id)
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_claims(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    return get_claims_for_purpose("access", credentials)


def get_reset_claims(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    return get_claims_for_purpose("first_login_reset", credentials)


def get_tenant_uuid(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> str:
    claims = get_current_user_claims(credentials)
    return claims["tenant_id"]


def email_domain(email: str) -> str:
    return email.split("@", 1)[1].lower() if "@" in email else ""


def build_login_response(token_key: str, token: str, tenant_id: str, tenant_name: str, role: str, email: str, is_first_login: bool):
    data = {
        "access_token": None,
        "reset_token": None,
        "token_type": "bearer",
        "tenant_id": tenant_id,
        "tenant_uuid": tenant_id,
        "tenant_name": tenant_name,
        "role": role,
        "email": email,
        "is_first_login": is_first_login
    }
    data[token_key] = token
    return LoginResponse(**data)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest):
    username = payload.username.strip()
    password = payload.password
    tenant = payload.tenant.strip()
    if not username or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Fields 'username' and 'password' are required.")
    conn = get_conn()
    cursor = conn.cursor()
    if tenant:
        cursor.execute("SELECT tenant_id, name FROM tenants WHERE lower(name) = lower(?)", (tenant,))
        tenant_row = cursor.fetchone()
        if not tenant_row:
            conn.close()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
        tenant_id = tenant_row["tenant_id"]
        cursor.execute(
            "SELECT email, username, password, role, is_first_login FROM users WHERE (username = ? OR email = ?) AND tenant_id = ?",
            (username, username, tenant_id)
        )
        user_row = cursor.fetchone()
        if not user_row:
            conn.close()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
        tenant_name = tenant_row["name"]
    else:
        cursor.execute(
            "SELECT email, username, password, role, is_first_login, tenant_id FROM users WHERE lower(email) = lower(?)",
            (username,)
        )
        user_row = cursor.fetchone()
        if not user_row:
            conn.close()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
        tenant_id = user_row["tenant_id"]
        cursor.execute("SELECT name FROM tenants WHERE tenant_id = ?", (tenant_id,))
        tenant_row = cursor.fetchone()
        tenant_name = tenant_row["name"] if tenant_row else ""
    if not pwd_context.verify(password, user_row["password"]):
        conn.close()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed. Invalid username or password.")
    if int(user_row["is_first_login"]) == 1:
        reset_token = create_token(user_row["username"], user_row["email"], tenant_id, user_row["role"], "first_login_reset", RESET_TOKEN_EXPIRE_MINUTES)
        conn.close()
        return build_login_response("reset_token", reset_token, tenant_id, tenant_name, user_row["role"], user_row["email"], True)
    cursor.execute(
        "UPDATE users SET last_login_at = ? WHERE email = ? AND tenant_id = ?",
        (datetime.utcnow().isoformat(), user_row["email"], tenant_id)
    )
    conn.commit()
    conn.close()
    access_token = create_token(user_row["username"], user_row["email"], tenant_id, user_row["role"], "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return build_login_response("access_token", access_token, tenant_id, tenant_name, user_row["role"], user_row["email"], False)


@router.post("/register", response_model=LoginResponse)
async def register_tenant(payload: RegisterRequest):
    tenant = payload.tenant.strip()
    username = payload.username.strip()
    email = payload.email.strip().lower()
    password = payload.password
    if not tenant or not username or not email or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="All fields are required.")
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT tenant_id FROM tenants WHERE lower(name) = lower(?)", (tenant,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace name is already registered.")
    cursor.execute("SELECT email FROM users WHERE lower(email) = lower(?)", (email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email address is already registered.")
    tenant_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    insert_tenant(cursor, tenant_id, tenant, now)
    cursor.execute(
        "INSERT INTO users (email, username, password, tenant_id, tenant_uuid, role, is_first_login, last_login_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
        (email, username, pwd_context.hash(password), tenant_id, tenant_id, "Tenant_Admin", now)
    )
    conn.commit()
    conn.close()
    access_token = create_token(username, email, tenant_id, "Tenant_Admin", "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return build_login_response("access_token", access_token, tenant_id, tenant, "Tenant_Admin", email, False)


@router.post("/invite", response_model=InviteResponse)
async def invite_user(payload: InviteRequest, claims: dict = Depends(get_current_user_claims)):
    if claims.get("role") not in ("Tenant_Admin", "Super_Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only workspace administrators can invite team members.")
    invite_email = payload.email.strip().lower()
    invite_name = payload.name.strip()
    invite_role = payload.role
    if not invite_role or len(invite_role) > 64 or not invite_role.replace("_", "").isalnum():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workspace role requested.")
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users WHERE lower(email) = lower(?)", (invite_email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email address already exists.")
    alphabet = string.ascii_letters + string.digits
    temp_password = "".join(secrets.choice(alphabet) for _ in range(12))
    tenant_id = claims["tenant_id"]
    cursor.execute(
        "INSERT INTO users (email, username, password, tenant_id, tenant_uuid, role, is_first_login, invited_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
        (invite_email, invite_name, pwd_context.hash(temp_password), tenant_id, tenant_id, invite_role, datetime.utcnow().isoformat())
    )
    cursor.execute("SELECT name FROM tenants WHERE tenant_id = ?", (tenant_id,))
    tenant_name_row = cursor.fetchone()
    conn.commit()
    conn.close()
    tenant_name = tenant_name_row["name"] if tenant_name_row else "your workspace"
    admin_email = claims.get("email")
    resend_api_key = os.getenv("RESEND_API_KEY")
    email_sent = False
    email_error = None
    if resend_api_key:
        try:
            from_email = os.getenv("RESEND_FROM_EMAIL") or "synq.to <onboarding@resend.dev>"
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
                    json={
                        "from": from_email,
                        "to": [invite_email],
                        "reply_to": admin_email,
                        "subject": f"Invitation to {tenant_name} on synq.to",
                        "html": f"<p>Hello {invite_name},</p><p>You have been invited to {tenant_name} on synq.to.</p><p>Login URL: {os.getenv('APP_LOGIN_URL') or '/login'}<br/>Email: {invite_email}<br/>Temporary Password: <strong>{temp_password}</strong></p>"
                    }
                )
                email_sent = res.status_code in (200, 201, 202)
                if not email_sent:
                    email_error = res.text
        except Exception:
            email_error = "Resend request failed."
            email_sent = False
    return InviteResponse(email=invite_email, name=invite_name, role=invite_role, temp_password=temp_password, email_sent=email_sent, resend_configured=bool(resend_api_key), email_error=email_error)


@router.post("/reset-password", response_model=LoginResponse)
async def reset_password(payload: ResetPasswordRequest, claims: dict = Depends(get_reset_claims)):
    new_password = payload.new_password
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters.")
    tenant_id = claims["tenant_id"]
    email = claims["email"]
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET password = ?, is_first_login = 0, last_login_at = ? WHERE email = ? AND tenant_id = ? AND is_first_login = 1",
        (pwd_context.hash(new_password), datetime.utcnow().isoformat(), email, tenant_id)
    )
    if cursor.rowcount != 1:
        conn.close()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password reset is not available for this account.")
    cursor.execute("SELECT name FROM tenants WHERE tenant_id = ?", (tenant_id,))
    tenant_row = cursor.fetchone()
    conn.commit()
    conn.close()
    access_token = create_token(claims["sub"], email, tenant_id, claims["role"], "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return build_login_response("access_token", access_token, tenant_id, tenant_row["name"] if tenant_row else "", claims["role"], email, False)


@router.post("/google", response_model=LoginResponse)
async def google_auth(payload: GoogleAuthRequest):
    email = payload.email.strip().lower()
    name = payload.name.strip()
    google_id = payload.google_id.strip()
    if not email or not name or not google_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account details are missing.")
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT email, username, tenant_id, role, is_first_login FROM users WHERE lower(email) = lower(?)", (email,))
    user_row = cursor.fetchone()
    if user_row:
        tenant_id = user_row["tenant_id"]
        role = user_row["role"]
        username = user_row["username"]
        cursor.execute(
            "UPDATE users SET google_linked = 1, google_id = ?, is_first_login = 0, last_login_at = ? WHERE email = ? AND tenant_id = ?",
            (google_id, datetime.utcnow().isoformat(), email, tenant_id)
        )
        cursor.execute("SELECT name FROM tenants WHERE tenant_id = ?", (tenant_id,))
        tenant_name_row = cursor.fetchone()
        tenant_name = tenant_name_row["name"] if tenant_name_row else ""
    else:
        tenant_id = str(uuid.uuid4())
        tenant_name = f"{name}'s Workspace"
        now = datetime.utcnow().isoformat()
        insert_tenant(cursor, tenant_id, tenant_name, now)
        cursor.execute(
            "INSERT INTO users (email, username, password, tenant_id, tenant_uuid, role, is_first_login, google_linked, google_id, last_login_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)",
            (email, name, "", tenant_id, tenant_id, "Tenant_Admin", google_id, now)
        )
        username = name
        role = "Tenant_Admin"
    conn.commit()
    conn.close()
    access_token = create_token(username, email, tenant_id, role, "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return build_login_response("access_token", access_token, tenant_id, tenant_name, role, email, False)


@router.post("/google-login", response_model=LoginResponse)
async def google_login(payload: GoogleLoginRequest):
    return await google_auth(GoogleAuthRequest(email=payload.email, name=payload.name, google_id="mock_legacy_google_id"))


@router.get("/users", response_model=List[UserRecordResponse])
async def list_users(claims: dict = Depends(get_current_user_claims)):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT username, email, role, is_first_login, google_linked, last_login_at FROM users WHERE tenant_id = ?",
        (claims["tenant_id"],)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        UserRecordResponse(
            name=row["username"],
            email=row["email"],
            role=row["role"],
            status="Active" if int(row["is_first_login"]) == 0 or int(row["google_linked"]) == 1 else "Inactive",
            last_login=row["last_login_at"] or "Never logged in"
        )
        for row in rows
    ]
