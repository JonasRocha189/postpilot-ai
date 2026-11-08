import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from langchain_core.embeddings import Embeddings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ai.models import AIConfigError, get_embeddings
from ai.rag.ingest import process_document
from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from database.config import settings
from database.db import get_db, get_session_factory
from database.models import Document, DocumentStatus
from schemas.documents import (
    CONTENT_TYPE_BY_DOCUMENT_TYPE,
    DocumentRead,
    DocumentUploadUrlRequest,
    DocumentUploadUrlResponse,
)
from storage import s3

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


def require_embeddings() -> Embeddings:
    """The embedding model, or 503 when the AI is not configured (no API key)."""
    try:
        return get_embeddings()
    except AIConfigError as exc:
        raise HTTPException(status_code=503, detail="AI is not configured") from exc


async def get_owned_document(document_id: uuid.UUID, user_id: str, db: AsyncSession) -> Document:
    """Return the document if it belongs to the user, otherwise 404."""
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Document]:
    """List a project's documents, newest first, with their processing status."""
    await get_owned_project(project_id, user_id, db)
    result = await db.scalars(
        select(Document)
        .where(Document.project_id == project_id, Document.user_id == user_id)
        .order_by(Document.created_at.desc())
    )
    return list(result)


@router.post("/upload-url", response_model=DocumentUploadUrlResponse)
async def create_upload_url(
    body: DocumentUploadUrlRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DocumentUploadUrlResponse:
    """Create the document (pending) and a presigned PUT URL for the browser.

    Type and size are validated by the schema (PDF, DOCX or TXT, up to the limit).
    """
    await get_owned_project(body.project_id, user_id, db)
    key = f"users/{user_id}/projects/{body.project_id}/documents/{uuid.uuid4()}.{body.type}"
    document = Document(
        user_id=user_id,
        project_id=body.project_id,
        name=body.name,
        type=body.type,
        size_bytes=body.size_bytes,
        s3_key=key,
        status=DocumentStatus.PENDING,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return DocumentUploadUrlResponse(
        document=DocumentRead.model_validate(document),
        upload_url=s3.presigned_upload_url(key, CONTENT_TYPE_BY_DOCUMENT_TYPE[body.type]),
    )


@router.post(
    "/{document_id}/process", response_model=DocumentRead, status_code=status.HTTP_202_ACCEPTED
)
async def start_processing(
    document_id: uuid.UUID,
    background: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    sessions: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
    embeddings: Embeddings = Depends(require_embeddings),
) -> Document:
    """The upload finished: index the document in the background.

    Answers at once with `processing`; the list shows `ready` or `error` later.
    409 if it is already processing; 422 if the file is not in S3 or is too large.
    """
    document = await get_owned_document(document_id, user_id, db)
    if document.status == DocumentStatus.PROCESSING:
        raise HTTPException(status_code=409, detail="Document is already being processed")

    # The presigned PUT does not limit the size: check what really arrived
    size = await s3.object_size(document.s3_key)
    if size is None:
        raise HTTPException(status_code=422, detail="Document was not uploaded")
    if size > settings.document_max_bytes:
        await s3.delete_object(document.s3_key)
        raise HTTPException(status_code=422, detail="Document is too large")

    document.status = DocumentStatus.PROCESSING
    document.error_message = None
    await db.commit()
    await db.refresh(document)
    background.add_task(process_document, document.id, sessions, embeddings)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete the document, its chunks (cascade) and its S3 object."""
    document = await get_owned_document(document_id, user_id, db)
    key = document.s3_key
    await db.delete(document)
    await db.commit()
    try:
        await s3.delete_object(key)
    except Exception:
        # The row is gone; an orphan object only costs storage
        logger.exception("Failed to delete S3 object", extra={"document_id": str(document_id)})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
