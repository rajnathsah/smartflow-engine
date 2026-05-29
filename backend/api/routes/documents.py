from typing import List
from fastapi import APIRouter, UploadFile, File, Depends
from fastapi.responses import FileResponse
from backend.api.deps import get_tenant_uuid, check_tenant_id
from backend.schemas import (
    QueryRequest,
    QueryResponse,
    ExportRequest,
    UploadResponse,
    DocumentResponse
)
from backend.services.document_service import DocumentService

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["documents"]
)
document_service = DocumentService()

@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_uuid)
):
    """Handles uploading a new document and queues AI processing.

    Args:
        file: The uploaded file.
        tenant_id: Tenant UUID.

    Returns:
        UploadResponse: Queued status credentials.
    """
    tenant_id = check_tenant_id(tenant_id)
    result = document_service.upload_document(tenant_id, file.filename, file.file)
    return UploadResponse(**result)

@router.get("", response_model=List[DocumentResponse])
async def list_documents(tenant_id: str = Depends(get_tenant_uuid)):
    """Retrieves all files uploaded inside the workspace.

    Args:
        tenant_id: Tenant UUID.

    Returns:
        list: List of document metadata.
    """
    tenant_id = check_tenant_id(tenant_id)
    documents = document_service.get_documents(tenant_id)
    return [DocumentResponse(**doc) for doc in documents]

@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest, tenant_id: str = Depends(get_tenant_uuid)):
    """Queries semantically relative document text content.

    Args:
        request: The QueryRequest parameters.
        tenant_id: Tenant UUID.

    Returns:
        QueryResponse: AI answer and relevant chunks.
    """
    tenant_id = check_tenant_id(tenant_id)
    result = await document_service.execute_query(tenant_id, request.query, request.document_ids)
    return QueryResponse(**result)

@router.post("/export")
async def export_document(payload: ExportRequest):
    """Exports generated AI comparisons to PDF or Excel reports.

    Args:
        payload: Report export parameters.

    Returns:
        FileResponse: The generated file attachment.
    """
    result = document_service.export_document(payload.format, payload.content)
    return FileResponse(
        result["file_path"],
        media_type=result["media_type"],
        filename=result["filename"]
    )
