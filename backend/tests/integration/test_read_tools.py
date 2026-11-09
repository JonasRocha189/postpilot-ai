"""The agent's read tools against a real database, always inside the context's
user and project."""

import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ai.agent.context import AgentContext
from ai.tools.get_project import get_project_data
from ai.tools.get_subject import get_subject_data
from ai.tools.list_subjects import list_subjects_data
from ai.tools.search_documents import search_documents_data
from ai.tools.search_past_posts import search_past_posts_data
from database.config import settings
from database.models import (
    Chunk,
    Document,
    DocumentStatus,
    DocumentType,
    Network,
    Post,
    PostFormat,
    PostStatus,
    PostVariation,
    Project,
    Subject,
)
from tests.fakes import FakeEmbeddings

pytestmark = pytest.mark.anyio

EMBEDDINGS = FakeEmbeddings(size=settings.embedding_dimensions)


@pytest.fixture
async def sessions(
    client: AsyncClient, database_url: str
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Sessions on the test database (`client` empties the tables afterwards)."""
    engine = create_async_engine(database_url, poolclass=NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


async def add_project(
    sessions: async_sessionmaker[AsyncSession], user_id: str = "user-a", **fields: str
) -> uuid.UUID:
    async with sessions() as db:
        project = Project(user_id=user_id, name=fields.pop("name", "Brand"), **fields)
        db.add(project)
        await db.commit()
        return project.id


async def add_subject(
    sessions: async_sessionmaker[AsyncSession],
    project_id: uuid.UUID,
    name: str,
    user_id: str = "user-a",
    **fields: str,
) -> uuid.UUID:
    async with sessions() as db:
        subject = Subject(user_id=user_id, project_id=project_id, name=name, **fields)
        db.add(subject)
        await db.commit()
        return subject.id


async def add_post(
    sessions: async_sessionmaker[AsyncSession],
    subject_id: uuid.UUID,
    content: str,
    status: PostStatus,
    user_id: str = "user-a",
) -> None:
    async with sessions() as db:
        post = Post(user_id=user_id, subject_id=subject_id, title=f"Post {content}")
        post.variations = [
            PostVariation(
                network=Network.LINKEDIN, format=PostFormat.TEXT, content=content, status=status
            )
        ]
        db.add(post)
        await db.commit()


def context(
    sessions: async_sessionmaker[AsyncSession], project_id: uuid.UUID, user_id: str = "user-a"
) -> AgentContext:
    return AgentContext(
        user_id=user_id, project_id=project_id, sessions=sessions, embeddings=EMBEDDINGS
    )


# --- get_project / list_subjects / get_subject --------------------------------


async def test_get_project(sessions: async_sessionmaker[AsyncSession]) -> None:
    project_id = await add_project(sessions, name="Acme", voice_tone="Direto")

    data = await get_project_data(context(sessions, project_id))

    assert data["name"] == "Acme"
    assert data["voice_tone"] == "Direto"


async def test_get_project_of_another_user_is_not_found(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    project_id = await add_project(sessions)

    assert await get_project_data(context(sessions, project_id, user_id="user-b")) == {
        "error": "Project not found"
    }


async def test_list_subjects_only_of_this_project(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    project_id = await add_project(sessions)
    other_project = await add_project(sessions)
    await add_subject(sessions, project_id, "Segurança")
    await add_subject(sessions, project_id, "Backup")
    await add_subject(sessions, other_project, "De outro projeto")

    subjects = await list_subjects_data(context(sessions, project_id))

    assert [subject["name"] for subject in subjects] == ["Backup", "Segurança"]


async def test_get_subject_falls_back_to_the_project_voice(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    project_id = await add_project(sessions, target_audience="CTOs", voice_tone="Formal")
    own = await add_subject(sessions, project_id, "Próprio", voice_tone="Leve")
    empty = await add_subject(sessions, project_id, "Vazio")
    ctx = context(sessions, project_id)

    with_own = await get_subject_data(ctx, str(own))
    with_default = await get_subject_data(ctx, str(empty))

    assert (with_own["voice_tone"], with_own["target_audience"]) == ("Leve", "CTOs")
    assert (with_default["voice_tone"], with_default["target_audience"]) == ("Formal", "CTOs")


@pytest.mark.parametrize("subject_id", ["not-a-uuid", str(uuid.uuid4())])
async def test_get_subject_with_a_bad_id_explains_the_error(
    sessions: async_sessionmaker[AsyncSession], subject_id: str
) -> None:
    project_id = await add_project(sessions)

    data = await get_subject_data(context(sessions, project_id), subject_id)

    assert "list_subjects" in data["error"]


async def test_get_subject_of_another_project_is_not_found(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    project_id = await add_project(sessions)
    other_project = await add_project(sessions)
    subject_id = await add_subject(sessions, other_project, "De outro projeto")

    data = await get_subject_data(context(sessions, project_id), str(subject_id))

    assert "error" in data


# --- search_documents ---------------------------------------------------------


async def test_search_documents_returns_passages_with_the_document_name(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    project_id = await add_project(sessions)
    async with sessions() as db:
        document = Document(
            user_id="user-a",
            project_id=project_id,
            name="auditoria.pdf",
            type=DocumentType.PDF,
            size_bytes=10,
            s3_key="key",
            status=DocumentStatus.READY,
        )
        db.add(document)
        await db.flush()
        text = "Faça backup diário dos servidores."
        db.add(
            Chunk(
                document_id=document.id,
                position=0,
                content=text,
                embedding=EMBEDDINGS.embed_query(text),
            )
        )
        await db.commit()

    results = await search_documents_data(context(sessions, project_id), "backup")

    assert results == [{"document": "auditoria.pdf", "content": text}]


# --- search_past_posts --------------------------------------------------------


async def test_past_posts_are_only_approved_or_published(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    project_id = await add_project(sessions)
    subject_id = await add_subject(sessions, project_id, "Segurança")
    for status in PostStatus:
        await add_post(sessions, subject_id, status.value, status)

    posts = await search_past_posts_data(context(sessions, project_id))

    assert isinstance(posts, list)
    assert sorted(post["content"] for post in posts) == ["approved", "published"]
    assert posts[0]["network"] == "linkedin"


async def test_past_posts_of_one_subject(sessions: async_sessionmaker[AsyncSession]) -> None:
    project_id = await add_project(sessions)
    security = await add_subject(sessions, project_id, "Segurança")
    backup = await add_subject(sessions, project_id, "Backup")
    await add_post(sessions, security, "sobre segurança", PostStatus.APPROVED)
    await add_post(sessions, backup, "sobre backup", PostStatus.APPROVED)

    posts = await search_past_posts_data(context(sessions, project_id), str(backup))

    assert isinstance(posts, list)
    assert [post["content"] for post in posts] == ["sobre backup"]


async def test_past_posts_never_come_from_another_project_or_user(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    project_id = await add_project(sessions)
    other_user_project = await add_project(sessions, user_id="user-b")
    other_subject = await add_subject(sessions, other_user_project, "X", user_id="user-b")
    await add_post(sessions, other_subject, "de outro usuário", PostStatus.PUBLISHED, "user-b")

    assert await search_past_posts_data(context(sessions, project_id)) == []
