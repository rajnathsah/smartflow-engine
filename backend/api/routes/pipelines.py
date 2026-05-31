from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Body, Depends, status, Request
from backend.api.deps import get_db, check_write_permission
from backend.schemas.pipelines import (
    SourceRequest,
    SourceResponse,
    DestinationRequest,
    DestinationResponse,
    ConnectionRequest,
    ConnectionResponse,
    LogRequest,
    LogResponse,
    ActivePipelineResponse,
    SyncTriggerResponse,
    TaskStatusResponse,
    AuthDriverRequest,
    AuthDriverResponse,
    ActiveSchemaResponse,
    DeleteResponse
)
from backend.services.pipeline_service import PipelineService
from sqlalchemy.orm import Session

router = APIRouter()

def get_pipeline_service(request: Request, db: Session = Depends(get_db)) -> PipelineService:
    return PipelineService(db, request.state.tenant_id)

@router.get("/sources", response_model=List[SourceResponse])
async def list_sources(pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_rows("sources")

@router.get("/sources/{id}", response_model=SourceResponse)
async def get_source(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_row("sources", id)

@router.post("/sources", response_model=SourceResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_write_permission)])
async def save_source(payload: SourceRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.upsert_tenant_row("sources", payload.model_dump())

@router.put("/sources/{id}", response_model=SourceResponse, dependencies=[Depends(check_write_permission)])
async def update_source(id: str, payload: SourceRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.update_tenant_row("sources", id, payload.model_dump())

@router.delete("/sources/{id}", response_model=DeleteResponse, dependencies=[Depends(check_write_permission)])
async def delete_source(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.delete_tenant_row("sources", id)

@router.get("/destinations", response_model=List[DestinationResponse])
async def list_destinations(pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_rows("destinations")

@router.get("/destinations/{id}", response_model=DestinationResponse)
async def get_destination(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_row("destinations", id)

@router.post("/destinations", response_model=DestinationResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_write_permission)])
async def save_destination(payload: DestinationRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.upsert_tenant_row("destinations", payload.model_dump())

@router.put("/destinations/{id}", response_model=DestinationResponse, dependencies=[Depends(check_write_permission)])
async def update_destination(id: str, payload: DestinationRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.update_tenant_row("destinations", id, payload.model_dump())

@router.delete("/destinations/{id}", response_model=DeleteResponse, dependencies=[Depends(check_write_permission)])
async def delete_destination(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.delete_tenant_row("destinations", id)

@router.get("/connections", response_model=List[ConnectionResponse])
async def list_connections(pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_rows("connections")

@router.get("/connections/{id}", response_model=ConnectionResponse)
async def get_connection(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_row("connections", id)

@router.post("/connections", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_write_permission)])
async def save_connection(payload: ConnectionRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.upsert_tenant_row("connections", payload.model_dump())

@router.put("/connections/{id}", response_model=ConnectionResponse, dependencies=[Depends(check_write_permission)])
async def update_connection(id: str, payload: ConnectionRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.update_tenant_row("connections", id, payload.model_dump())

@router.delete("/connections/{id}", response_model=DeleteResponse, dependencies=[Depends(check_write_permission)])
async def delete_connection(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.delete_tenant_row("connections", id)

@router.get("/logs", response_model=List[LogResponse])
async def list_logs(pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_rows("logs")

@router.post("/logs", response_model=LogResponse, status_code=status.HTTP_201_CREATED)
async def save_log(payload: LogRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.save_log(payload.model_dump())

@router.get("/active", response_model=List[ActivePipelineResponse])
async def active_pipelines(pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.get_active_pipelines()

@router.post("/{id}/sync", response_model=SyncTriggerResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_pipeline_sync(
    id: str,
    pipeline_config: Optional[Dict[str, Any]] = Body(default=None),
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    return pipeline_service.trigger_pipeline_sync(id, pipeline_config)

@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.get_task_status(task_id)

@router.post("/{id}/auth-driver", response_model=AuthDriverResponse, dependencies=[Depends(check_write_permission)])
async def save_auth_driver(
    id: str,
    payload: AuthDriverRequest,
    pipeline_service: PipelineService = Depends(get_pipeline_service)
):
    return pipeline_service.save_auth_driver(id, payload.code)

@router.get("/active/schema", response_model=ActiveSchemaResponse)
async def get_active_schema(pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.get_active_schema()
