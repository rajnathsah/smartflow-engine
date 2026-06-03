from pydantic import BaseModel
from typing import Optional

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

    @classmethod
    def from_result(cls, result: dict) -> "LoginResponse":
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
        return cls(**data)

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

class RootResponse(BaseModel):
    status: str
    service: str
    documentation: str

class VerifyTenantResponse(BaseModel):
    verified: bool
    active_tenant_uuid: str
