"""Extract plain text from the uploaded files (PDF, DOCX, TXT)."""

from collections.abc import Callable
from io import BytesIO

import docx
from pypdf import PdfReader

from database.models import DocumentType


class ExtractionError(ValueError):
    """The file can't be read or has no text. The message is shown to the user."""


def _pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    return "\n\n".join(page.extract_text() or "" for page in reader.pages)


def _docx(data: bytes) -> str:
    document = docx.Document(BytesIO(data))
    parts = [paragraph.text for paragraph in document.paragraphs]
    # Tables are common in briefings and price lists: one line per row
    for table in document.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def _txt(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")  # also removes the BOM some editors add
    except UnicodeDecodeError:
        return data.decode("latin-1")  # older Windows files; never fails


_READERS: dict[DocumentType, Callable[[bytes], str]] = {
    DocumentType.PDF: _pdf,
    DocumentType.DOCX: _docx,
    DocumentType.TXT: _txt,
}


def extract_text(data: bytes, doc_type: DocumentType) -> str:
    """Return the file's text, or raise ExtractionError."""
    try:
        text = _READERS[doc_type](data)
    except Exception as exc:
        # Corrupted, encrypted or not really this type
        raise ExtractionError(f"Could not read the {doc_type.value.upper()} file") from exc
    if not text.strip():
        raise ExtractionError("The file has no text (scanned PDFs are not supported)")
    return text
