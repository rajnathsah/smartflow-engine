import asyncio
import json as _json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Body, Depends, status, Request
from fastapi.responses import StreamingResponse
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
    DeleteResponse,
    PipelineRequest,
    PipelineResponse,
    FieldMapping,
    SchemaMappingConfig,
    MappingsResponse,
    PipelineRunLogEntry,
    PipelineRunLogsResponse,
)
from backend.services.pipeline_service import PipelineService
from backend.services.log_service import LogService
from sqlalchemy.orm import Session

router = APIRouter()

def get_pipeline_service(request: Request, db: Session = Depends(get_db)) -> PipelineService:
    return PipelineService(db, request.state.tenant_id)

def get_log_service(request: Request, db: Session = Depends(get_db)) -> LogService:
    return LogService(db, request.state.tenant_id)

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

@router.get("/pipelines", response_model=List[PipelineResponse])
async def list_pipelines(pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_rows("pipelines")

@router.get("/pipelines/{id}", response_model=PipelineResponse)
async def get_pipeline(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.read_tenant_row("pipelines", id)

@router.post("/pipelines", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_write_permission)])
async def save_pipeline(payload: PipelineRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.create_pipeline(payload.model_dump())

@router.put("/pipelines/{id}", response_model=PipelineResponse, dependencies=[Depends(check_write_permission)])
async def update_pipeline(id: str, payload: PipelineRequest, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.update_tenant_row("pipelines", id, payload.model_dump())

@router.delete("/pipelines/{id}", response_model=DeleteResponse, dependencies=[Depends(check_write_permission)])
async def delete_pipeline(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return pipeline_service.delete_tenant_row("pipelines", id)

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

@router.post("/connections/{id}/test")
async def test_connection(id: str, pipeline_service: PipelineService = Depends(get_pipeline_service)):
    return await pipeline_service.test_connection(id)


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


# ── Pipeline Run Log Endpoints ────────────────────────────────────────────────

@router.get("/runs/{run_id}/logs", response_model=PipelineRunLogsResponse)
async def get_run_logs(
    run_id: str,
    log_service: LogService = Depends(get_log_service),
):
    """Return the complete, ordered log history for a completed or failed pipeline run."""
    logs = log_service.get_logs(run_id)
    entries = [
        PipelineRunLogEntry(
            id=log.id,
            run_id=log.run_id,
            level=log.level,
            message=log.message,
            timestamp=log.timestamp,
            sequence=log.sequence,
            extra=log.extra,
        )
        for log in logs
    ]
    pipeline_id = logs[0].pipeline_id if logs else None
    return PipelineRunLogsResponse(
        run_id=run_id,
        pipeline_id=pipeline_id,
        total=len(entries),
        logs=entries,
    )


@router.get("/runs/{run_id}/logs/stream")
async def stream_run_logs(
    run_id: str,
    after: int = 0,
    request: Request = None,
    log_service: LogService = Depends(get_log_service),
):
    """
    SSE endpoint — streams new log lines for an in-progress pipeline run.
    The client should pass `after=<last_sequence>` to resume without duplicates.
    The stream closes automatically once [SUCCESS] or [TRACEBACK] is detected,
    or after ~45 seconds of idle time.
    """

    async def event_generator():
        last_sequence = after
        consecutive_empty = 0
        max_empty_polls = 90  # 90 × 0.5s = 45s idle timeout

        while True:
            if request and await request.is_disconnected():
                break

            new_logs = log_service.get_logs_after_sequence(run_id, last_sequence)

            if new_logs:
                consecutive_empty = 0
                is_done = False
                for log in new_logs:
                    entry = {
                        "id": log.id,
                        "run_id": log.run_id,
                        "level": log.level,
                        "message": log.message,
                        "timestamp": log.timestamp,
                        "sequence": log.sequence,
                        "extra": log.extra,
                    }
                    last_sequence = log.sequence
                    yield f"data: {_json.dumps(entry)}\n\n"
                    # Detect terminal log lines
                    if "[SUCCESS]" in log.message or "[TRACEBACK]" in log.message:
                        is_done = True
                if is_done:
                    yield 'data: {"__done__": true}\n\n'
                    break
            else:
                consecutive_empty += 1
                if consecutive_empty >= max_empty_polls:
                    yield 'data: {"__done__": true, "__timeout__": true}\n\n'
                    break
                # Heartbeat every 5 seconds to keep the connection alive
                if consecutive_empty % 10 == 0:
                    yield 'data: {"__heartbeat__": true}\n\n'

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
