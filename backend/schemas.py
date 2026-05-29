from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class LoginRequest(BaseModel):
    """Request model for user login."""
    tenant: str = ""
    username: str
    password: str

class LoginResponse(BaseModel):
    """Response model for user login."""
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
    """Request model for tenant registration."""
    tenant: str
    username: str
    email: str
    password: str

class InviteRequest(BaseModel):
    """Request model for teammate invitation."""
    email: str
    name: str
    role: str = "Tenant_User"

class InviteResponse(BaseModel):
    """Response model for teammate invitation."""
    email: str
    name: str
    role: str
    temp_password: str
    email_sent: bool
    email_error: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    """Request model for password reset."""
    new_password: str

class GoogleLoginRequest(BaseModel):
    """Request model for Google login."""
    email: str
    name: str

class GoogleAuthRequest(BaseModel):
    """Request model for Google authentication."""
    email: str
    name: str
    google_id: str

class UserRecordResponse(BaseModel):
    """Response model for user records list."""
    name: str
    email: str
    role: str
    status: str
    last_login: str

class QueryRequest(BaseModel):
    """Request model for semantic querying."""
    query: str
    document_ids: Optional[List[str]] = None

class QueryResponse(BaseModel):
    """Response model for semantic querying."""
    answer: str
    chunks: List[Dict[str, Any]]

class ExportRequest(BaseModel):
    """Request model for document exporting."""
    format: str
    content: str

class SourceRequest(BaseModel):
    """Request model for sync sources."""
    id: Optional[str] = None
    name: str
    type: str
    model_config = {"extra": "allow"}

class SourceResponse(BaseModel):
    """Response model for sync sources."""
    id: str
    name: str
    type: str
    model_config = {"extra": "allow"}

class DestinationRequest(BaseModel):
    """Request model for sync destinations."""
    id: Optional[str] = None
    name: str
    type: str
    model_config = {"extra": "allow"}

class DestinationResponse(BaseModel):
    """Response model for sync destinations."""
    id: str
    name: str
    type: str
    model_config = {"extra": "allow"}

class ConnectionRequest(BaseModel):
    """Request model for sync connections."""
    id: Optional[str] = None
    name: str
    model_config = {"extra": "allow"}

class ConnectionResponse(BaseModel):
    """Response model for sync connections."""
    id: str
    name: str
    model_config = {"extra": "allow"}

class LogRequest(BaseModel):
    """Request model for sync logs."""
    id: Optional[str] = None
    model_config = {"extra": "allow"}

class LogResponse(BaseModel):
    """Response model for sync logs."""
    id: str
    model_config = {"extra": "allow"}

class ActivePipelineResponse(BaseModel):
    """Response model for active pipelines."""
    id: str
    name: str
    sourceUrl: str
    targetTable: str
    rowsFetched: int
    rowsInserted: int
    totalRows: int
    errorsCount: int
    status: str

class SyncTriggerResponse(BaseModel):
    """Response model for dynamic sync execution."""
    status: str
    pipeline_id: str
    task_id: str

class TaskStatusResponse(BaseModel):
    """Response model for checking Celery task execution."""
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AuthDriverRequest(BaseModel):
    """Request model for dynamic authentication driver code."""
    code: str

class AuthDriverResponse(BaseModel):
    """Response model for dynamic authentication driver saving."""
    status: str
    message: str

class ActiveSchemaResponse(BaseModel):
    """Response model for active schema mapping metadata."""
    sourceKeys: List[str]
    targetColumns: List[str]

class UploadResponse(BaseModel):
    """Response model for document uploading."""
    status: str
    task_id: str
    document_name: str

class DocumentResponse(BaseModel):
    """Response model for listed documents."""
    filename: str
    size: int
    created_at: float

class DeleteResponse(BaseModel):
    """Generic delete status response."""
    status: str
    id: str

class RootResponse(BaseModel):
    """Response model for API root status."""
    status: str
    service: str
    documentation: str

class VerifyTenantResponse(BaseModel):
    """Response model for tenant verification."""
    verified: bool
    active_tenant_uuid: str

class MappingsResponse(BaseModel):
    """Response model for schema mappings saving."""
    status: str
    message: str

