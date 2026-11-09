"""generate_image, save_draft with the image and analyze_performance against a real
database and an in-memory S3, always inside the context's user and project."""

import uuid
from collections.abc import AsyncIterator, Iterator
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import boto3
import pytest
from httpx import AsyncClient
from moto import mock_aws
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload
from sqlalchemy.pool import NullPool

from ai.agent.context import AgentContext
from ai.models import ImageSize
from ai.tools.analyze_performance import analyze_performance_data
from ai.tools.generate_image import NO_TEXT, generate_image_data
from ai.tools.save_draft import DraftVariation, save_draft_data
from database.config import settings
from database.models import (
    AgentMode,
    AgentRun,
    AgentStep,
    Image,
    Metric,
    Network,
    Post,
    PostFormat,
    PostStatus,
    PostVariation,
    Project,
    Subject,
    VariationImage,
)
from storage import s3
from tests.fakes import FakeEmbeddings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

pytestmark = pytest.mark.anyio

BUCKET = "postpilot-test"
PNG = b"\x89PNG\r\n\x1a\nfake"


class FakeImages:
    """Records the prompts and returns a tiny PNG, like the real generator."""

    def __init__(self, fail: bool = False) -> None:
        self.calls: list[tuple[str, ImageSize]] = []
        self.fail = fail

    async def __call__(self, prompt: str, size: ImageSize) -> bytes:
        self.calls.append((prompt, size))
        if self.fail:
            raise RuntimeError("content policy")
        return PNG


@pytest.fixture
def bucket(monkeypatch: pytest.MonkeyPatch) -> Iterator["S3Client"]:
    """An empty in-memory bucket; the app's S3 client is pointed at it."""
    monkeypatch.setattr(settings, "s3_endpoint_url", None)
    monkeypatch.setattr(settings, "s3_bucket", BUCKET)
    monkeypatch.setattr(settings, "s3_region", "us-east-1")
    monkeypatch.setattr(settings, "s3_access_key_id", "test")
    monkeypatch.setattr(settings, "s3_secret_access_key", "test")
    s3._client.cache_clear()
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield client
    s3._client.cache_clear()


@pytest.fixture
async def sessions(
    client: AsyncClient, database_url: str
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Sessions on the test database (`client` empties the tables afterwards)."""
    engine = create_async_engine(database_url, poolclass=NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


async def make_ctx(
    sessions: async_sessionmaker[AsyncSession], user_id: str = "user-a"
) -> tuple[AgentContext, uuid.UUID]:
    """A project with one subject and a run; returns the context and the subject id."""
    async with sessions() as db:
        project = Project(user_id=user_id, name="Acme")
        db.add(project)
        await db.flush()
        subject = Subject(user_id=user_id, project_id=project.id, name="Security")
        run = AgentRun(
            user_id=user_id, project_id=project.id, mode=AgentMode.CREATION, request="A post"
        )
        db.add_all([subject, run])
        await db.commit()
    ctx = AgentContext(
        run_id=run.id,
        user_id=user_id,
        project_id=project.id,
        sessions=sessions,
        embeddings=FakeEmbeddings(size=settings.embedding_dimensions),
    )
    return ctx, subject.id


# --- generate_image ---------------------------------------------------------


async def test_generate_image_saves_to_the_project_library(
    sessions: async_sessionmaker[AsyncSession], bucket: "S3Client"
) -> None:
    ctx, _ = await make_ctx(sessions)
    images = FakeImages()
    ctx = replace(ctx, images=images)

    result = await generate_image_data(ctx, "A shield over a laptop, flat style", "portrait")

    assert images.calls == [("A shield over a laptop, flat style" + NO_TEXT, "1024x1536")]
    async with sessions() as db:
        image = await db.get(Image, uuid.UUID(result["image_id"]))
    assert image is not None
    assert (image.user_id, image.project_id) == ("user-a", ctx.project_id)
    assert image.key.startswith(f"users/user-a/projects/{ctx.project_id}/images/")
    assert image.description == "A shield over a laptop, flat style"
    stored = bucket.get_object(Bucket=BUCKET, Key=image.key)
    assert stored["Body"].read() == PNG
    assert stored["ContentType"] == "image/png"


async def test_one_image_per_run(sessions: async_sessionmaker[AsyncSession]) -> None:
    ctx, _ = await make_ctx(sessions)
    images = FakeImages()
    ctx = replace(ctx, images=images)
    async with sessions() as db:
        # The step the recorder saved for the first call
        db.add(
            AgentStep(
                run_id=ctx.run_id,
                step_number=1,
                tool="generate_image",
                arguments={},
                result={"image_id": str(uuid.uuid4())},
            )
        )
        await db.commit()

    result = await generate_image_data(ctx, "Another one", "square")

    assert "already generated" in result["error"]
    assert images.calls == []


async def test_without_a_generator_or_when_it_fails_the_post_goes_on(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    ctx, _ = await make_ctx(sessions)

    not_configured = await generate_image_data(ctx, "A shield", "square")
    failed = await generate_image_data(replace(ctx, images=FakeImages(fail=True)), "A", "square")

    assert "not configured" in not_configured["error"]
    assert "could not be generated" in failed["error"]
    async with sessions() as db:
        assert await db.scalar(select(Image.id)) is None


# --- save_draft with the image ----------------------------------------------


async def test_save_draft_attaches_the_image_to_every_network(
    sessions: async_sessionmaker[AsyncSession], bucket: "S3Client"
) -> None:
    ctx, subject_id = await make_ctx(sessions)
    image = await generate_image_data(replace(ctx, images=FakeImages()), "A shield", "square")

    result = await save_draft_data(
        ctx,
        "Backups",
        str(subject_id),
        [
            DraftVariation(network=Network.LINKEDIN, content="Faça backup."),
            DraftVariation(network=Network.INSTAGRAM, content="Backup 💾"),
        ],
        image_id=image["image_id"],
    )

    assert result["image_id"] == image["image_id"]
    async with sessions() as db:
        post = await db.scalar(
            select(Post)
            .where(Post.id == uuid.UUID(result["post_id"]))
            .options(selectinload(Post.variations).selectinload(PostVariation.images))
        )
    assert post is not None
    for variation in post.variations:
        assert variation.format == PostFormat.SINGLE
        assert variation.status == PostStatus.DRAFT
        assert [i.image_id for i in variation.images] == [uuid.UUID(image["image_id"])]


async def test_save_draft_refuses_an_image_from_another_project(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    ctx, subject_id = await make_ctx(sessions)
    other, _ = await make_ctx(sessions, user_id="user-b")
    async with sessions() as db:
        foreign = Image(user_id="user-b", project_id=other.project_id, key="k", content_type="x")
        db.add(foreign)
        await db.commit()
    variations = [DraftVariation(network=Network.LINKEDIN, content="Texto")]

    refused = await save_draft_data(ctx, "T", str(subject_id), variations, str(foreign.id))
    invalid = await save_draft_data(ctx, "T", str(subject_id), variations, "not-an-id")

    assert "not found" in refused["error"]
    assert "Invalid image id" in invalid["error"]
    async with sessions() as db:
        assert await db.scalar(select(Post.id)) is None


# --- analyze_performance ----------------------------------------------------

# 12:30 UTC = 09:30 in São Paulo, on a Tuesday
TUESDAY_MORNING = datetime(2026, 11, 3, 12, 30, tzinfo=UTC)


async def add_published(
    sessions: async_sessionmaker[AsyncSession],
    ctx: AgentContext,
    subject_id: uuid.UUID,
    impressions: int,
    likes: int,
    published_at: datetime = TUESDAY_MORNING,
    with_image: bool = False,
) -> uuid.UUID:
    """A published LinkedIn variation with one metric collection."""
    async with sessions() as db:
        variation = PostVariation(
            network=Network.LINKEDIN,
            format=PostFormat.SINGLE if with_image else PostFormat.TEXT,
            content="Texto",
            status=PostStatus.PUBLISHED,
        )
        db.add(Post(user_id=ctx.user_id, subject_id=subject_id, title="P", variations=[variation]))
        await db.flush()
        if with_image:
            image = Image(user_id=ctx.user_id, project_id=ctx.project_id, key="k", content_type="x")
            db.add(image)
            await db.flush()
            db.add(VariationImage(variation_id=variation.id, image_id=image.id, position=0))
        db.add(
            Metric(
                user_id=ctx.user_id,
                variation_id=variation.id,
                published_at=published_at,
                collected_at=published_at + timedelta(days=1),
                impressions=impressions,
                likes=likes,
                comments=0,
                shares=0,
                clicks=0,
            )
        )
        await db.commit()
        return variation.id


async def test_analyze_performance_needs_five_posts(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    ctx, subject_id = await make_ctx(sessions)
    for _ in range(4):
        await add_published(sessions, ctx, subject_id, 1000, 50)

    result = await analyze_performance_data(ctx)

    assert result["enough_data"] is False
    assert result["posts_with_metrics"] == 4


async def test_analyze_performance_uses_the_latest_metric_and_local_time(
    sessions: async_sessionmaker[AsyncSession],
) -> None:
    ctx, subject_id = await make_ctx(sessions)
    variation_ids = [
        await add_published(sessions, ctx, subject_id, 1000, 10, with_image=True) for _ in range(5)
    ]
    # A later collection of the first post: its totals replace the old ones
    async with sessions() as db:
        db.add(
            Metric(
                user_id="user-a",
                variation_id=variation_ids[0],
                published_at=TUESDAY_MORNING,
                collected_at=TUESDAY_MORNING + timedelta(days=7),
                impressions=1000,
                likes=60,
                comments=0,
                shares=0,
                clicks=0,
            )
        )
        await db.commit()
    # Another user's posts never count
    other, other_subject = await make_ctx(sessions, user_id="user-b")
    for _ in range(5):
        await add_published(sessions, other, other_subject, 10, 10)

    result = await analyze_performance_data(ctx)

    assert result["posts_with_metrics"] == 5
    # (60 + 10 * 4) / 1000 / 5 posts
    assert result["overall"] == {"avg_impressions": 1000, "avg_engagement_rate": 0.02}
    assert [r["value"] for r in result["groups"]["weekday"]] == ["tuesday"]
    assert [r["value"] for r in result["groups"]["time_of_day"]] == ["morning"]
    assert [r["value"] for r in result["groups"]["image"]] == ["with_image"]
    assert [r["value"] for r in result["groups"]["subject"]] == ["Security"]
