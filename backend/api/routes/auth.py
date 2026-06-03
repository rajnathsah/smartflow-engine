from typing import List
from fastapi import APIRouter, Depends, Request
from backend.api.deps import (
    get_db,
    get_current_user_claims,
    get_reset_claims,
    check_write_permission
)
from backend.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    InviteRequest,
    InviteResponse,
    ResetPasswordRequest,
    GoogleLoginRequest,
    GoogleAuthRequest,
    UserRecordResponse
)
from backend.services.auth_service import AuthService
from backend.utils.limiter import limiter
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

def get_auth_service(request: Request, db: Session = Depends(get_db)) -> AuthService:
    tenant_id = getattr(request.state, "tenant_id", None)
    return AuthService(db, tenant_id)

@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, auth_service: AuthService = Depends(get_auth_service)):
    result = auth_service.login_user(payload.username, payload.password, payload.tenant)
    return LoginResponse.from_result(result)

@router.post("/register", response_model=LoginResponse)
async def register_tenant(payload: RegisterRequest, auth_service: AuthService = Depends(get_auth_service)):
    result = auth_service.register_user(payload.tenant, payload.username, payload.email, payload.password)
    return LoginResponse.from_result(result)

@router.post("/invite", response_model=InviteResponse, dependencies=[Depends(check_write_permission)])
async def invite_user(payload: InviteRequest, claims: dict = Depends(get_current_user_claims), auth_service: AuthService = Depends(get_auth_service)):
    result = await auth_service.invite_teammate(payload.email, payload.name, payload.role, claims)
    return InviteResponse(**result)

@router.post("/reset-password", response_model=LoginResponse)
async def reset_password(payload: ResetPasswordRequest, claims: dict = Depends(get_reset_claims), auth_service: AuthService = Depends(get_auth_service)):
    result = auth_service.reset_user_password(payload.new_password, claims)
    return LoginResponse.from_result(result)

@router.post("/google", response_model=LoginResponse)
async def google_auth(payload: GoogleAuthRequest, auth_service: AuthService = Depends(get_auth_service)):
    result = auth_service.authenticate_google(payload.email, payload.name, payload.google_id)
    return LoginResponse.from_result(result)

@router.post("/google-login", response_model=LoginResponse)
async def google_login(payload: GoogleLoginRequest, auth_service: AuthService = Depends(get_auth_service)):
    result = auth_service.authenticate_google(payload.email, payload.name, "mock_legacy_google_id")
    return LoginResponse.from_result(result)

@router.get("/users", response_model=List[UserRecordResponse])
async def list_users(claims: dict = Depends(get_current_user_claims), auth_service: AuthService = Depends(get_auth_service)):
    users = auth_service.get_workspace_users()
    return [UserRecordResponse(**u) for u in users]
