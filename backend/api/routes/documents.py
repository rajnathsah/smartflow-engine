from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from backend.api.routes.auth import get_tenant_uuid
from backend.services import document_service

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["documents"]
)

class QueryRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None

class ExportRequest(BaseModel):
    format: str
    content: str

def _check_tenant_id(tenant_id: str) -> str:
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: tenant_id is missing."
        )
    return tenant_id

@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_uuid)
):
    tenant_id = _check_tenant_id(tenant_id)
    return document_service.upload_document(tenant_id, file.filename, file.file)

@router.get("")
async def list_documents(tenant_id: str = Depends(get_tenant_uuid)):
    tenant_id = _check_tenant_id(tenant_id)
    return document_service.get_documents(tenant_id)

@router.post("/query")
async def query_documents(request: QueryRequest, tenant_id: str = Depends(get_tenant_uuid)):
    tenant_id = _check_tenant_id(tenant_id)
    return await document_service.execute_query(tenant_id, request.query, request.document_ids)

@router.post("/export")
async def export_document(payload: ExportRequest):
    result = document_service.export_document(payload.format, payload.content)
    return FileResponse(
        result["file_path"],
        media_type=result["media_type"],
        filename=result["filename"]
    )
