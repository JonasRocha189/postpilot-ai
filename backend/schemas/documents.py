import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from database.config import settings
from database.models import DocumentStatus, DocumentType

# The presigned PUT requires this exact Content-Type from the browser
CONTENT_TYPE_BY_DOCUMENT_TYPE: dict[DocumentType, str] = {
    DocumentType.PDF: "application/pdf",
    DocumentType.DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    DocumentType.TXT: "text/plain",
}


class DocumentUploadUrlRequest(BaseModel):
    """Body of POST /documents/upload-url."""

    model_config = ConfigDict(str_strip_whitespace=True)

    project_id: uuid.UUID
    # Original file name, shown in the list
    name: str = Field(min_length=1, max_length=255)
    type: DocumentType
    size_bytes: int = Field(gt=0, le=settings.document_max_bytes)


class DocumentRead(BaseModel):
    """Response body: the document and where its processing is."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    type: DocumentType
    size_bytes: int
    status: DocumentStatus
    error_message: str | None
    chunk_count: int | None
    created_at: datetime
    updated_at: datetime


class DocumentUploadUrlResponse(BaseModel):
    """The new document (pending) and the presigned URL for the browser's PUT."""

    document: DocumentRead
    upload_url: str
