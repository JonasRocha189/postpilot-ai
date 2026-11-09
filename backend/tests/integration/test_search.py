"""Hybrid search on a real pgvector: ranking, scope by user/project and status.

The chunks are written straight to the database with the fake embeddings
(the same text always gets the same vector), so the vector side can be
tested by searching for a chunk's exact text.
"""

import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ai.rag.search import search_chunks
from database.config import settings
from database.models import Chunk, Document, DocumentStatus, DocumentType, Project
from tests.fakes import FakeEmbeddings

pytestmark = pytest.mark.anyio

EMBEDDINGS = FakeEmbeddings(size=settings.embedding_dimensions)


@pytest.fixture
async def db(client: AsyncClient, database_url: str) -> AsyncIterator[AsyncSession]:
    """A session on the test database (`client` empties the tables afterwards)."""
    engine = create_async_engine(database_url, poolclass=NullPool)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


async def add_project(db: AsyncSession, user_id: str = "user-a") -> uuid.UUID:
    project = Project(user_id=user_id, name="Brand")
    db.add(project)
    await db.commit()
    return project.id


async def add_document(
    db: AsyncSession,
    project_id: uuid.UUID,
    texts: list[str],
    user_id: str = "user-a",
    status: DocumentStatus = DocumentStatus.READY,
    name: str = "guide.pdf",
) -> None:
    document = Document(
        user_id=user_id,
        project_id=project_id,
        name=name,
        type=DocumentType.PDF,
        size_bytes=100,
        s3_key="key",
        status=status,
    )
    db.add(document)
    await db.flush()
    vectors = EMBEDDINGS.embed_documents(texts)
    db.add_all(
        Chunk(document_id=document.id, position=n, content=text, embedding=vector)
        for n, (text, vector) in enumerate(zip(texts, vectors, strict=True))
    )
    await db.commit()


async def search(db: AsyncSession, project_id: uuid.UUID, query: str, **kwargs: str) -> list[str]:
    results = await search_chunks(
        db, EMBEDDINGS, kwargs.get("user_id", "user-a"), project_id, query
    )
    return [result.content for result in results]


async def test_finds_the_chunk_with_the_terms(db: AsyncSession) -> None:
    project_id = await add_project(db)
    await add_document(
        db,
        project_id,
        ["Política de backup diário dos servidores.", "Horário de atendimento ao cliente."],
    )

    results = await search(db, project_id, "backups")

    # Full-text in Portuguese: "backups" matches "backup" (stemming)
    assert results[0] == "Política de backup diário dos servidores."


async def test_finds_the_chunk_with_the_same_meaning(db: AsyncSession) -> None:
    project_id = await add_project(db)
    texts = ["Primeiro trecho.", "Segundo trecho.", "Terceiro trecho."]
    await add_document(db, project_id, texts)

    # Same text = same fake vector: the vector side puts it first
    assert (await search(db, project_id, "Segundo trecho."))[0] == "Segundo trecho."


async def test_returns_the_document_name_and_a_score(db: AsyncSession) -> None:
    project_id = await add_project(db)
    await add_document(db, project_id, ["Checklist de segurança."], name="auditoria.pdf")

    [result] = await search_chunks(db, EMBEDDINGS, "user-a", project_id, "segurança")

    assert result.document_name == "auditoria.pdf"
    assert result.score > 0


async def test_only_searches_ready_documents_of_this_project(db: AsyncSession) -> None:
    project_id = await add_project(db)
    other_project = await add_project(db)
    other_user_project = await add_project(db, user_id="user-b")
    await add_document(db, project_id, ["Backup do projeto certo."])
    await add_document(db, other_project, ["Backup de outro projeto."])
    await add_document(db, other_user_project, ["Backup de outro usuário."], user_id="user-b")
    await add_document(
        db, project_id, ["Backup ainda processando."], status=DocumentStatus.PROCESSING
    )

    assert await search(db, project_id, "backup") == ["Backup do projeto certo."]


async def test_another_user_finds_nothing_in_the_project(db: AsyncSession) -> None:
    project_id = await add_project(db)
    await add_document(db, project_id, ["Backup diário."])

    assert await search(db, project_id, "backup", user_id="user-b") == []


async def test_a_project_without_documents_returns_nothing(db: AsyncSession) -> None:
    assert await search(db, await add_project(db), "qualquer coisa") == []
