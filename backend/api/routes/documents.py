import os
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, Request, HTTPException
from fastapi.responses import FileResponse
from backend.api.deps import get_db
from backend.schemas.documents import (
    QueryRequest,
    QueryResponse,
    ExportRequest,
    UploadResponse,
    DocumentResponse
)
from backend.services.document_service import DocumentService
from sqlalchemy.orm import Session

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["documents"]
)

def get_document_service(request: Request, db: Session = Depends(get_db)) -> DocumentService:
    return DocumentService(db, request.state.tenant_id)

@router.post("/upload", response_model=UploadResponse, status_code=202)
async def upload_document(
    file: UploadFile = File(...),
    doc_service: DocumentService = Depends(get_document_service)
):
    allowed_content_types = {"application/pdf", "text/plain", "text/csv", "application/vnd.ms-excel"}
    allowed_extensions = {".pdf", ".txt", ".csv"}
    filename = file.filename or ""
    ext = os.path.splitext(filename.lower())[1]
    if ext not in allowed_extensions or file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only PDF, TXT, and CSV files are allowed."
        )
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds the maximum limit of 10MB."
        )
    result = doc_service.upload_document(filename, file.file)
    return UploadResponse(**result)

@router.get("", response_model=List[DocumentResponse])
async def list_documents(doc_service: DocumentService = Depends(get_document_service)):
    documents = doc_service.get_documents()
    return [DocumentResponse(**doc) for doc in documents]

@router.post("/query", response_model=QueryResponse)
async def query_documents(
    query_request: QueryRequest,
    doc_service: DocumentService = Depends(get_document_service)
):
    result = await doc_service.execute_query(query_request.query, query_request.document_ids)
    return QueryResponse(**result)

@router.post("/export")
async def export_document(payload: ExportRequest, doc_service: DocumentService = Depends(get_document_service)):
    result = doc_service.export_document(payload.format, payload.content)
    return FileResponse(
        result["file_path"],
        media_type=result["media_type"],
        filename=result["filename"]
    )
