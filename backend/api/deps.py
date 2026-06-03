from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from backend.database.database import get_db
from backend.config import settings
from backend.utils.logging import tenant_uuid_context

security_bearer = HTTPBearer()

def get_claims_for_purpose(purpose: str, credentials: HTTPAuthorizationCredentials) -> dict:
    """Decodes JWT claims and validates the token purpose.

    Args:
        purpose: The required token purpose.
        credentials: The HTTP bearer credentials.

    Returns:
        dict: The decoded payload claims.
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
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
    """Retrieves user claims for authenticated access tokens.

    Args:
        credentials: The HTTP bearer credentials.

    Returns:
        dict: User claims.
    """
    return get_claims_for_purpose("access", credentials)

def get_reset_claims(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    """Retrieves claims for password reset tokens.

    Args:
        credentials: The HTTP bearer credentials.

    Returns:
        dict: Reset claims.
    """
    return get_claims_for_purpose("first_login_reset", credentials)

def get_tenant_uuid(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> str:
    """Retrieves the tenant UUID from the request credentials.

    Args:
        credentials: The HTTP bearer credentials.

    Returns:
        str: The tenant UUID.
    """
    claims = get_current_user_claims(credentials)
    return claims["tenant_id"]

def check_tenant_id(tenant_id: str) -> str:
    """Verifies that the tenant ID is present and valid.

    Args:
        tenant_id: The tenant ID string.

    Returns:
        str: Checked tenant ID.
    """
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: tenant_id is missing."
        )
    return tenant_id

def check_write_permission(claims: dict = Depends(get_current_user_claims)) -> None:
    """Verifies that the authenticated user has write permissions.

    Args:
        claims: Decoded JWT claims.

    Raises:
        HTTPException: If the user lacks write permissions.
    """
    role = claims.get("role")
    if role == "Tenant_User":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have write permissions to perform this action."
        )

