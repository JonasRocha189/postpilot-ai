"""Document ingestion for the RAG: S3 -> text -> chunks -> embeddings -> database.

Runs in the background after POST /documents/{id}/process, with its own
database session: the request's session is already closed by then.
"""

import logging
import uuid

from langchain_core.embeddings import Embeddings
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ai.rag.chunking import split_text
from ai.rag.extract import ExtractionError, extract_text
from database.models import Chunk, Document, DocumentStatus
from storage import s3

logger = logging.getLogger(__name__)


async def process_document(
    document_id: uuid.UUID,
    sessions: async_sessionmaker[AsyncSession],
    embeddings: Embeddings,
) -> None:
    """Index a document's text; the document ends `ready` or `error`."""
    async with sessions() as db:
        document = await db.get(Document, document_id)
        if document is None:  # deleted before the task started
            return
        try:
            data = await s3.download_object(document.s3_key)
            pieces = split_text(extract_text(data, document.type))
            vectors = await embeddings.aembed_documents(pieces)
            # Processing again replaces the old chunks
            await db.execute(delete(Chunk).where(Chunk.document_id == document.id))
            db.add_all(
                Chunk(document_id=document.id, position=n, content=content, embedding=vector)
                for n, (content, vector) in enumerate(zip(pieces, vectors, strict=True))
            )
            document.status = DocumentStatus.READY
            document.chunk_count = len(pieces)
            document.error_message = None
            await db.commit()
            # Never log the document's content, only its size
            logger.info(
                "Document processed",
                extra={"document_id": str(document_id), "chunks": len(pieces)},
            )
        except Exception as exc:
            await db.rollback()
            if isinstance(exc, ExtractionError):
                message = str(exc)  # written for the user
                logger.warning(
                    "Document has no readable text", extra={"document_id": str(document_id)}
                )
            else:
                message = "Processing failed. Try again later."
                logger.exception(
                    "Document processing failed", extra={"document_id": str(document_id)}
                )
            await db.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(status=DocumentStatus.ERROR, error_message=message, chunk_count=None)
            )
            await db.commit()
