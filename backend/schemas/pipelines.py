from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class SourceRequest(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    model_config = {"extra": "allow"}

class SourceResponse(BaseModel):
    id: str
    name: str
    type: str
    model_config = {"extra": "allow"}

class DestinationRequest(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    model_config = {"extra": "allow"}

class DestinationResponse(BaseModel):
    id: str
    name: str
    type: str
    model_config = {"extra": "allow"}

class ConnectionRequest(BaseModel):
    id: Optional[str] = None
    name: str
    model_config = {"extra": "allow"}

class ConnectionResponse(BaseModel):
    id: str
    name: str
    model_config = {"extra": "allow"}

class LogRequest(BaseModel):
    id: Optional[str] = None
    model_config = {"extra": "allow"}

class LogResponse(BaseModel):
    id: str
    model_config = {"extra": "allow"}

class ActivePipelineResponse(BaseModel):
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
    status: str
    pipeline_id: str
    task_id: str

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class AuthDriverRequest(BaseModel):
    code: str

class AuthDriverResponse(BaseModel):
    status: str
    message: str

class ActiveSchemaResponse(BaseModel):
    sourceKeys: List[str]
    targetColumns: List[str]

class DeleteResponse(BaseModel):
    status: str
    id: str

class MappingsResponse(BaseModel):
    status: str
    message: str
