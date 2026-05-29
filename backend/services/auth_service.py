import os
import uuid
import secrets
import string
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import HTTPException, status
from passlib.context import CryptContext
from jose import jwt
from backend.database import get_pg_connection

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "synq-jwt-super-secret-key-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120
RESET_TOKEN_EXPIRE_MINUTES = 15
INVITE_DENIED_MESSAGE = "Access Denied: You have not been invited to this workspace. Please contact your administrator."

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def table_columns(cursor, table: str) -> set[str]:
    cursor.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
        (table.lower(),)
    )
    return {row["column_name"] for row in cursor.fetchall()}

def ensure_columns(cursor, table: str, columns: dict[str, str]):
    existing = table_columns(cursor, table)
    for name, ddl in columns.items():
        if name not in existing:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")

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
    conn = get_pg_connection()
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
        requires_password_reset INTEGER DEFAULT 0,
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
        "google_id": "TEXT",
        "requires_password_reset": "INTEGER DEFAULT 0"
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
    cursor.execute("UPDATE users SET requires_password_reset = 1 WHERE is_first_login = 1")
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
    conn = get_pg_connection()
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

def create_token(username: str, email: str, tenant_id: str, role: str, purpose: str, minutes: int) -> str:
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

def login_user(conn, username: str, password: str, tenant: str) -> Dict[str, Any]:
    cursor = conn.cursor()
    if tenant:
        cursor.execute("SELECT tenant_id, name FROM tenants WHERE lower(name) = lower(?)", (tenant,))
        tenant_row = cursor.fetchone()
        if not tenant_row:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
        tenant_id = tenant_row["tenant_id"]
        cursor.execute(
            "SELECT email, username, password, role, is_first_login, requires_password_reset FROM users WHERE (username = ? OR email = ?) AND tenant_id = ?",
            (username, username, tenant_id)
        )
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
        tenant_name = tenant_row["name"]
    else:
        cursor.execute(
            "SELECT email, username, password, role, is_first_login, requires_password_reset, tenant_id FROM users WHERE lower(email) = lower(?)",
            (username,)
        )
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INVITE_DENIED_MESSAGE)
        tenant_id = user_row["tenant_id"]
        cursor.execute("SELECT name FROM tenants WHERE tenant_id = ?", (tenant_id,))
        tenant_row = cursor.fetchone()
        tenant_name = tenant_row["name"] if tenant_row else ""
    if not pwd_context.verify(password, user_row["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed. Invalid username or password.")
    requires_reset = int(user_row["requires_password_reset"] or 0) == 1 or int(user_row["is_first_login"]) == 1
    if requires_reset:
        reset_token = create_token(user_row["username"], user_row["email"], tenant_id, user_row["role"], "first_login_reset", RESET_TOKEN_EXPIRE_MINUTES)
        raise HTTPException(
            status_code=428,
            detail={
                "message": "Password reset required",
                "reset_token": reset_token,
                "tenant_name": tenant_name,
                "role": user_row["role"],
                "email": user_row["email"],
                "is_first_login": True
            }
        )
    cursor.execute(
        "UPDATE users SET last_login_at = ? WHERE email = ? AND tenant_id = ?",
        (datetime.utcnow().isoformat(), user_row["email"], tenant_id)
    )
    conn.commit()
    access_token = create_token(user_row["username"], user_row["email"], tenant_id, user_row["role"], "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "token_key": "access_token",
        "token": access_token,
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "role": user_row["role"],
        "email": user_row["email"],
        "is_first_login": False
    }

def register_user(conn, tenant: str, username: str, email: str, password: str) -> Dict[str, Any]:
    cursor = conn.cursor()
    cursor.execute("SELECT tenant_id FROM tenants WHERE lower(name) = lower(?)", (tenant,))
    if cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace name is already registered.")
    cursor.execute("SELECT email FROM users WHERE lower(email) = lower(?)", (email,))
    if cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email address is already registered.")
    tenant_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    insert_tenant(cursor, tenant_id, tenant, now)
    cursor.execute(
        "INSERT INTO users (email, username, password, tenant_id, tenant_uuid, role, is_first_login, last_login_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
        (email, username, pwd_context.hash(password), tenant_id, tenant_id, "Tenant_Admin", now)
    )
    conn.commit()
    access_token = create_token(username, email, tenant_id, "Tenant_Admin", "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "token_key": "access_token",
        "token": access_token,
        "tenant_id": tenant_id,
        "tenant_name": tenant,
        "role": "Tenant_Admin",
        "email": email,
        "is_first_login": False
    }

async def invite_teammate(conn, email: str, name: str, role: str, claims: dict) -> Dict[str, Any]:
    if claims.get("role") not in ("Tenant_Admin", "Super_Admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only workspace administrators can invite team members.")
    invite_email = email.strip().lower()
    invite_name = name.strip()
    invite_role = role
    if not invite_role or len(invite_role) > 64 or not invite_role.replace("_", "").replace("-", "").replace(" ", "").isalnum():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workspace role requested.")
    cursor = conn.cursor()
    cursor.execute("SELECT email FROM users WHERE lower(email) = lower(?)", (invite_email,))
    if cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email address already exists.")
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    temp_password = "".join(secrets.choice(alphabet) for _ in range(14))
    tenant_id = claims["tenant_id"]
    cursor.execute(
        "INSERT INTO users (email, username, password, tenant_id, tenant_uuid, role, is_first_login, requires_password_reset, invited_at) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)",
        (invite_email, invite_name, pwd_context.hash(temp_password), tenant_id, tenant_id, invite_role, datetime.utcnow().isoformat())
    )
    cursor.execute("SELECT name FROM tenants WHERE tenant_id = ?", (tenant_id,))
    tenant_name_row = cursor.fetchone()
    conn.commit()
    n8n_webhook_url = os.getenv("N8N_WEBHOOK_URL", "https://aditya546shah.app.n8n.cloud/webhook/user-onboarding")
    email_sent = False
    email_error = None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                n8n_webhook_url,
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

def reset_user_password(conn, new_password: str, claims: dict) -> Dict[str, Any]:
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")
    tenant_id = claims["tenant_id"]
    email = claims["email"]
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET password = ?, is_first_login = 0, requires_password_reset = 0, last_login_at = ? WHERE email = ? AND tenant_id = ? AND (is_first_login = 1 OR requires_password_reset = 1)",
        (pwd_context.hash(new_password), datetime.utcnow().isoformat(), email, tenant_id)
    )
    if cursor.rowcount != 1:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password reset is not available for this account.")
    cursor.execute("SELECT name FROM tenants WHERE tenant_id = ?", (tenant_id,))
    tenant_row = cursor.fetchone()
    conn.commit()
    access_token = create_token(claims["sub"], email, tenant_id, claims["role"], "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "token_key": "access_token",
        "token": access_token,
        "tenant_id": tenant_id,
        "tenant_name": tenant_row["name"] if tenant_row else "",
        "role": claims["role"],
        "email": email,
        "is_first_login": False
    }

def authenticate_google(conn, email: str, name: str, google_id: str) -> Dict[str, Any]:
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
    access_token = create_token(username, email, tenant_id, role, "access", ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "token_key": "access_token",
        "token": access_token,
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "role": role,
        "email": email,
        "is_first_login": False
    }

def get_workspace_users(conn, tenant_id: str) -> List[Dict[str, Any]]:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT username, email, role, is_first_login, google_linked, last_login_at FROM users WHERE tenant_id = ?",
        (tenant_id,)
    )
    rows = cursor.fetchall()
    return [
        {
            "name": row["username"],
            "email": row["email"],
            "role": row["role"],
            "status": "Active" if int(row["is_first_login"]) == 0 or int(row["google_linked"]) == 1 else "Inactive",
            "last_login": row["last_login_at"] or "Never logged in"
        }
        for row in rows
    ]
