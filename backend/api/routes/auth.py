from typing import List
from fastapi import APIRouter, Depends, Request
from backend.api.deps import (
    get_db,
    get_current_user_claims,
    get_reset_claims
)
from backend.schemas import (
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
auth_service = AuthService()

def build_login_response(result: dict) -> LoginResponse:
    """Helper to construct the unified login response payload.

    Args:
        result: Auth service output dict.

    Returns:
        LoginResponse: Response payload.
    """
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
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    """Logs in an existing user and returns session tokens.

    Args:
        request: The FastAPI Request instance.
        payload: Username and password details.
        db: Database session.

    Returns:
        LoginResponse: Session bearer credentials.
    """
    result = auth_service.login_user(db, payload.username, payload.password, payload.tenant)
    return build_login_response(result)

@router.post("/register", response_model=LoginResponse)
async def register_tenant(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new tenant space and initial admin user.

    Args:
        payload: Workspace name and credentials.
        db: Database session.

    Returns:
        LoginResponse: Session bearer credentials.
    """
    result = auth_service.register_user(db, payload.tenant, payload.username, payload.email, payload.password)
    return build_login_response(result)

@router.post("/invite", response_model=InviteResponse)
async def invite_user(payload: InviteRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Invites a colleague to join the workspace.

    Args:
        payload: Target email, name and role.
        claims: Caller's identity claims.
        db: Database session.

    Returns:
        InviteResponse: Invitation delivery status.
    """
    result = await auth_service.invite_teammate(db, payload.email, payload.name, payload.role, claims)
    return InviteResponse(**result)

@router.post("/reset-password", response_model=LoginResponse)
async def reset_password(payload: ResetPasswordRequest, claims: dict = Depends(get_reset_claims), db: Session = Depends(get_db)):
    """Forces first-time password resets.

    Args:
        payload: New password payload.
        claims: Reset purpose validation claims.
        db: Database session.

    Returns:
        LoginResponse: Session bearer credentials.
    """
    result = auth_service.reset_user_password(db, payload.new_password, claims)
    return build_login_response(result)

@router.post("/google", response_model=LoginResponse)
async def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticates a user via Google credentials.

    Args:
        payload: OAuth details.
        db: Database session.

    Returns:
        LoginResponse: Session bearer credentials.
    """
    result = auth_service.authenticate_google(db, payload.email, payload.name, payload.google_id)
    return build_login_response(result)

@router.post("/google-login", response_model=LoginResponse)
async def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Logs in user with basic Google profile attributes.

    Args:
        payload: Basic OAuth attributes.
        db: Database session.

    Returns:
        LoginResponse: Session bearer credentials.
    """
    result = auth_service.authenticate_google(db, payload.email, payload.name, "mock_legacy_google_id")
    return build_login_response(result)

@router.get("/users", response_model=List[UserRecordResponse])
async def list_users(claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Retrieves all users registered within the caller's workspace.

    Args:
        claims: Identity claims.
        db: Database session.

    Returns:
        list: Workspace users list.
    """
    users = auth_service.get_workspace_users(db, claims["tenant_id"])
    return [UserRecordResponse(**u) for u in users]
