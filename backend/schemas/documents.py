from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class QueryRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None

class QueryResponse(BaseModel):
    answer: str
    chunks: List[Dict[str, Any]]

class ExportRequest(BaseModel):
    format: str
    content: str

class UploadResponse(BaseModel):
    status: str
    task_id: str
    document_name: str

class DocumentResponse(BaseModel):
    filename: str
    size: int
    created_at: float
