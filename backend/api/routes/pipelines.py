from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Body, Depends, status
from backend.api.deps import get_db, get_current_user_claims, check_tenant_id
from backend.schemas import (
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
pipeline_service = PipelineService()

@router.get("/sources", response_model=List[SourceResponse])
async def list_sources(claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Lists all data sources configured in the caller's workspace.

    Args:
        claims: Caller's identity claims.
        db: Database session.

    Returns:
        list: Configuration dictionaries of sources.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.read_tenant_rows(db, "sources", tenant_id)

@router.get("/sources/{id}", response_model=SourceResponse)
async def get_source(id: str, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Retrieves a single data source by ID.

    Args:
        id: Target source identifier.
        claims: Caller's identity claims.
        db: Database session.

    Returns:
        SourceResponse: Configuration model of source.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.read_tenant_row(db, "sources", tenant_id, id)

@router.post("/sources", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def save_source(payload: SourceRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Saves or registers a data source in the workspace.

    Args:
        payload: Source parameters.
        claims: Caller's identity claims.
        db: Database session.

    Returns:
        SourceResponse: Saved source configuration.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.upsert_tenant_row(db, "sources", tenant_id, payload.model_dump())

@router.put("/sources/{id}", response_model=SourceResponse)
async def update_source(id: str, payload: SourceRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Updates parameters of an existing data source.

    Args:
        id: Target source identifier.
        payload: New source configuration.
        claims: Caller's identity claims.
        db: Database session.

    Returns:
        SourceResponse: Updated source configuration.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.update_tenant_row(db, "sources", tenant_id, id, payload.model_dump())

@router.delete("/sources/{id}", response_model=DeleteResponse)
async def delete_source(id: str, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Deletes a configured data source.

    Args:
        id: Target source identifier.
        claims: Caller's identity claims.
        db: Database session.

    Returns:
        DeleteResponse: Deleted status confirmation.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.delete_tenant_row(db, "sources", tenant_id, id)

@router.get("/destinations", response_model=List[DestinationResponse])
async def list_destinations(claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Lists database destinations.

    Args:
        claims: Identity claims.
        db: Database session.

    Returns:
        list: Configuration dictionaries of destinations.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.read_tenant_rows(db, "destinations", tenant_id)

@router.get("/destinations/{id}", response_model=DestinationResponse)
async def get_destination(id: str, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Retrieves destination config.

    Args:
        id: Destination identifier.
        claims: Identity claims.
        db: Database session.

    Returns:
        DestinationResponse: Destination parameters.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.read_tenant_row(db, "destinations", tenant_id, id)

@router.post("/destinations", response_model=DestinationResponse, status_code=status.HTTP_201_CREATED)
async def save_destination(payload: DestinationRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Registers a sync destination database.

    Args:
        payload: Destination parameters.
        claims: Identity claims.
        db: Database session.

    Returns:
        DestinationResponse: Saved config.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.upsert_tenant_row(db, "destinations", tenant_id, payload.model_dump())

@router.put("/destinations/{id}", response_model=DestinationResponse)
async def update_destination(id: str, payload: DestinationRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Updates config parameters of a destination.

    Args:
        id: Target identifier.
        payload: Updated configurations.
        claims: Identity claims.
        db: Database session.

    Returns:
        DestinationResponse: Updated config.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.update_tenant_row(db, "destinations", tenant_id, id, payload.model_dump())

@router.delete("/destinations/{id}", response_model=DeleteResponse)
async def delete_destination(id: str, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Deletes destination configurations.

    Args:
        id: Target identifier.
        claims: Identity claims.
        db: Database session.

    Returns:
        DeleteResponse: Status outcome.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.delete_tenant_row(db, "destinations", tenant_id, id)

@router.get("/connections", response_model=List[ConnectionResponse])
async def list_connections(claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Lists workspace connections.

    Args:
        claims: Identity claims.
        db: Database session.

    Returns:
        list: Configurations list.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.read_tenant_rows(db, "connections", tenant_id)

@router.get("/connections/{id}", response_model=ConnectionResponse)
async def get_connection(id: str, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Gets connection config.

    Args:
        id: Connection identifier.
        claims: Identity claims.
        db: Database session.

    Returns:
        ConnectionResponse: Configuration values.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.read_tenant_row(db, "connections", tenant_id, id)

@router.post("/connections", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def save_connection(payload: ConnectionRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Creates a sync connection.

    Args:
        payload: Connection parameters.
        claims: Identity claims.
        db: Database session.

    Returns:
        ConnectionResponse: Saved values.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.upsert_tenant_row(db, "connections", tenant_id, payload.model_dump())

@router.put("/connections/{id}", response_model=ConnectionResponse)
async def update_connection(id: str, payload: ConnectionRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Modifies connection properties.

    Args:
        id: Target identifier.
        payload: Properties dict.
        claims: Identity claims.
        db: Database session.

    Returns:
        ConnectionResponse: Modified connection.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.update_tenant_row(db, "connections", tenant_id, id, payload.model_dump())

@router.delete("/connections/{id}", response_model=DeleteResponse)
async def delete_connection(id: str, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Removes a sync connection.

    Args:
        id: Connection identifier.
        claims: Identity claims.
        db: Database session.

    Returns:
        DeleteResponse: Status verification.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.delete_tenant_row(db, "connections", tenant_id, id)

@router.get("/logs", response_model=List[LogResponse])
async def list_logs(claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Lists execution sync logs.

    Args:
        claims: Identity claims.
        db: Database session.

    Returns:
        list: Configuration dictionaries list.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.read_tenant_rows(db, "logs", tenant_id)

@router.post("/logs", response_model=LogResponse, status_code=status.HTTP_201_CREATED)
async def save_log(payload: LogRequest, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Records a pipeline sync execution log.

    Args:
        payload: Log details.
        claims: Identity claims.
        db: Database session.

    Returns:
        LogResponse: Registered log values.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.save_log(db, tenant_id, payload.model_dump())

@router.get("/active", response_model=List[ActivePipelineResponse])
async def active_pipelines(claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Lists current syncing pipelines progress metrics.

    Args:
        claims: Identity claims.
        db: Database session.

    Returns:
        list: Pipeline execution metrics list.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.get_active_pipelines(db, tenant_id)

@router.post("/{id}/sync", response_model=SyncTriggerResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_pipeline_sync(
    id: str,
    pipeline_config: Optional[Dict[str, Any]] = Body(default=None),
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db)
):
    """Triggers asynchronous pipeline synchronization.

    Args:
        id: Pipeline identifier.
        pipeline_config: Context payload values.
        claims: Identity claims.
        db: Database session.

    Returns:
        SyncTriggerResponse: Task identifier payload.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.trigger_pipeline_sync(db, tenant_id, id, pipeline_config)

@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str, claims: dict = Depends(get_current_user_claims), db: Session = Depends(get_db)):
    """Checks the status of an ongoing sync task.

    Args:
        task_id: Celery task ID.
        claims: Identity claims.
        db: Database session.

    Returns:
        TaskStatusResponse: Task execution status values.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.get_task_status(db, tenant_id, task_id)

@router.post("/{id}/auth-driver", response_model=AuthDriverResponse)
async def save_auth_driver(
    id: str,
    payload: AuthDriverRequest,
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db)
):
    """Saves custom python authentication driver script.

    Args:
        id: Pipeline identifier.
        payload: Python code block.
        claims: Identity claims.
        db: Database session.

    Returns:
        AuthDriverResponse: Execution outcome.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.save_auth_driver(db, tenant_id, id, payload.code)

@router.get("/active/schema", response_model=ActiveSchemaResponse)
async def get_active_schema(claims: dict = Depends(get_current_user_claims)):
    """Gets structure columns schema parameters.

    Args:
        claims: Identity claims.

    Returns:
        ActiveSchemaResponse: Structure maps.
    """
    tenant_id = check_tenant_id(claims.get("tenant_id"))
    return pipeline_service.get_active_schema(tenant_id)
