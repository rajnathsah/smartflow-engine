from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal

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

class FieldMapping(BaseModel):
    source_field: str
    destination_field: str
    data_type: Literal['string', 'integer', 'boolean', 'timestamp', 'float', 'json'] = 'string'
    transformation: Literal['none', 'uppercase', 'lowercase', 'trim', 'cast'] = 'none'


class SchemaMappingConfig(BaseModel):
    mappings: List[FieldMapping] = Field(default_factory=list)


class PipelineRequest(BaseModel):
    id: Optional[str] = None
    source_connection_id: str
    destination_connection_id: str
    schema_mapping: Optional[SchemaMappingConfig] = None
    model_config = {"extra": "allow"}


class PipelineResponse(BaseModel):
    id: str
    source_connection_id: str
    destination_connection_id: str
    schema_mapping: Optional[SchemaMappingConfig] = None
    model_config = {"extra": "allow"}


class PipelineRunLogEntry(BaseModel):
    id: str
    run_id: str
    level: str
    message: str
    timestamp: str
    sequence: int
    extra: Optional[Dict[str, Any]] = None


class PipelineRunLogsResponse(BaseModel):
    run_id: str
    pipeline_id: Optional[str] = None
    total: int
    logs: List[PipelineRunLogEntry]
