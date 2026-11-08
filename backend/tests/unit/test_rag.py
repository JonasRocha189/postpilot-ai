"""RAG building blocks: text extraction, chunking and the embedding model setup."""

from io import BytesIO

import docx
import pytest
from langchain_openai import OpenAIEmbeddings

from ai import models
from ai.rag.chunking import normalize, split_text
from ai.rag.extract import ExtractionError, extract_text
from database.config import settings
from database.models import DocumentType


def make_pdf(text: str) -> bytes:
    """A minimal one-page PDF with `text` (no PDF writer library needed)."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    return bytes(out)


def make_docx() -> bytes:
    document = docx.Document()
    document.add_paragraph("Security checklist")
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Backup"
    table.rows[0].cells[1].text = "daily"
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


# --- extraction --------------------------------------------------------------


def test_extracts_text_from_a_pdf() -> None:
    assert "Hello PostPilot" in extract_text(make_pdf("Hello PostPilot"), DocumentType.PDF)


def test_extracts_paragraphs_and_table_rows_from_a_docx() -> None:
    text = extract_text(make_docx(), DocumentType.DOCX)
    assert "Security checklist" in text
    assert "Backup | daily" in text


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        ("Ação rápida".encode(), "Ação rápida"),
        ("﻿Com BOM".encode(), "Com BOM"),
        ("Acentuação".encode("latin-1"), "Acentuação"),
    ],
)
def test_reads_txt_in_utf8_with_or_without_bom_and_latin1(data: bytes, expected: str) -> None:
    assert extract_text(data, DocumentType.TXT) == expected


@pytest.mark.parametrize("doc_type", [DocumentType.PDF, DocumentType.DOCX])
def test_a_corrupted_file_raises_extraction_error(doc_type: DocumentType) -> None:
    with pytest.raises(ExtractionError, match="Could not read"):
        extract_text(b"this is not a real file", doc_type)


def test_a_file_without_text_raises_extraction_error() -> None:
    with pytest.raises(ExtractionError, match="no text"):
        extract_text(b"  \n\n ", DocumentType.TXT)


# --- chunking ----------------------------------------------------------------


def test_normalize_collapses_spaces_and_blank_lines() -> None:
    assert normalize("  a \t b\r\n\n\n\n c \x00") == "a b\n\nc"


def test_short_text_is_one_chunk() -> None:
    assert split_text("One short paragraph.") == ["One short paragraph."]


def test_empty_text_has_no_chunks() -> None:
    assert split_text(" \n ") == []


def test_chunks_respect_the_size_and_cover_all_the_text() -> None:
    paragraphs = [f"Paragraph {n}. " + "word " * 40 for n in range(30)]
    chunks = split_text("\n\n".join(paragraphs), size=300, overlap=50)
    assert len(chunks) > 1
    assert all(0 < len(chunk) <= 300 for chunk in chunks)
    for n in range(30):
        assert any(f"Paragraph {n}." in chunk for chunk in chunks)


def test_each_chunk_starts_with_the_end_of_the_previous_one() -> None:
    text = " ".join(f"w{n}" for n in range(400))
    chunks = split_text(text, size=200, overlap=40)
    for previous, current in zip(chunks, chunks[1:], strict=False):
        first_word = current.split()[0]
        assert first_word in previous.split()[-10:]


def test_a_very_long_word_is_cut() -> None:
    chunks = split_text("x" * 1000, size=300, overlap=50)
    assert all(len(chunk) <= 300 for chunk in chunks)
    assert "".join(chunks).count("x") >= 1000


def test_overlap_must_be_smaller_than_size() -> None:
    with pytest.raises(ValueError):
        split_text("text", size=100, overlap=100)


# --- embedding model ---------------------------------------------------------


def test_embeddings_need_the_openai_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "")
    models.get_embeddings.cache_clear()
    with pytest.raises(models.AIConfigError, match="OPENAI_API_KEY"):
        models.get_embeddings()
    models.get_embeddings.cache_clear()


def test_embeddings_use_the_configured_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    models.get_embeddings.cache_clear()
    embeddings = models.get_embeddings()
    assert isinstance(embeddings, OpenAIEmbeddings)
    assert embeddings.model == settings.embedding_model
    assert embeddings.dimensions == settings.embedding_dimensions
    models.get_embeddings.cache_clear()
