import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from backend.database import get_pg_connection
from backend.utils.limiter import limiter
from backend.utils.logging import tenant_uuid_context
from backend.services import auth_service

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "synq-jwt-super-secret-key-change-me")
JWT_ALGORITHM = "HS256"

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
security_bearer = HTTPBearer()

def get_conn():
    conn = get_pg_connection()
    try:
        yield conn
    finally:
        conn.close()

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

def build_login_response(result: dict) -> LoginResponse:
    data = {
        "access_token": None,
        "reset_token": None,
        "token_type": "bearer",
        "tenant_id": result["tenant_id"],
        "tenant_uuid": result["tenant_id"],
        "tenant_name": result["tenant_name"],
        "role": result["role"],
        "email": result["email"],
        "is_first_login": result["is_first_login"]
    }
    data[result["token_key"]] = result["token"]
    return LoginResponse(**data)

@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, conn = Depends(get_conn)):
    result = auth_service.login_user(conn, payload.username, payload.password, payload.tenant)
    return build_login_response(result)

@router.post("/register", response_model=LoginResponse)
async def register_tenant(payload: RegisterRequest, conn = Depends(get_conn)):
    result = auth_service.register_user(conn, payload.tenant, payload.username, payload.email, payload.password)
    return build_login_response(result)

@router.post("/invite", response_model=InviteResponse)
async def invite_user(payload: InviteRequest, claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)):
    result = await auth_service.invite_teammate(conn, payload.email, payload.name, payload.role, claims)
    return InviteResponse(**result)

@router.post("/reset-password", response_model=LoginResponse)
async def reset_password(payload: ResetPasswordRequest, claims: dict = Depends(get_reset_claims), conn = Depends(get_conn)):
    result = auth_service.reset_user_password(conn, payload.new_password, claims)
    return build_login_response(result)

@router.post("/google", response_model=LoginResponse)
async def google_auth(payload: GoogleAuthRequest, conn = Depends(get_conn)):
    result = auth_service.authenticate_google(conn, payload.email, payload.name, payload.google_id)
    return build_login_response(result)

@router.post("/google-login", response_model=LoginResponse)
async def google_login(payload: GoogleLoginRequest, conn = Depends(get_conn)):
    result = auth_service.authenticate_google(conn, payload.email, payload.name, "mock_legacy_google_id")
    return build_login_response(result)

@router.get("/users", response_model=List[UserRecordResponse])
async def list_users(claims: dict = Depends(get_current_user_claims), conn = Depends(get_conn)):
    users = auth_service.get_workspace_users(conn, claims["tenant_id"])
    return [UserRecordResponse(**u) for u in users]
