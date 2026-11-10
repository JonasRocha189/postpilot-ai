"""GET /reports/performance: the dashboard's data, only from the user's own project."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from database.models import (
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

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}
# 23:30 UTC on Tuesday = 20:30 in São Paulo, still Tuesday
TUESDAY_EVENING = datetime(2026, 11, 3, 23, 30, tzinfo=UTC)


@pytest.fixture
async def sessions(
    client: AsyncClient, database_url: str
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Sessions on the test database (`client` empties the tables afterwards)."""
    engine = create_async_engine(database_url, poolclass=NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


async def seed(sessions: async_sessionmaker[AsyncSession], user_id: str = "user-a") -> str:
    """A project with a published LinkedIn variation (with image, two collections)
    and a draft X variation without metrics. Returns the project id."""
    async with sessions() as db:
        project = Project(user_id=user_id, name="Acme")
        db.add(project)
        await db.flush()
        subject = Subject(user_id=user_id, project_id=project.id, name="Security")
        db.add(subject)
        await db.flush()
        linkedin = PostVariation(
            network=Network.LINKEDIN,
            format=PostFormat.SINGLE,
            content="Faça backup.",
            status=PostStatus.PUBLISHED,
        )
        x = PostVariation(
            network=Network.X, format=PostFormat.TEXT, content="Backup!", status=PostStatus.DRAFT
        )
        db.add(
            Post(user_id=user_id, subject_id=subject.id, title="Backups", variations=[linkedin, x])
        )
        image = Image(user_id=user_id, project_id=project.id, key="k", content_type="image/png")
        db.add(image)
        await db.flush()
        db.add(VariationImage(variation_id=linkedin.id, image_id=image.id, position=0))
        for days, likes in ((1, 10), (7, 80)):
            db.add(
                Metric(
                    user_id=user_id,
                    variation_id=linkedin.id,
                    published_at=TUESDAY_EVENING,
                    collected_at=TUESDAY_EVENING + timedelta(days=days),
                    impressions=2000,
                    likes=likes,
                    comments=4,
                    shares=3,
                    clicks=13,
                )
            )
        await db.commit()
        return str(project.id)


async def test_performance_report_has_the_latest_numbers_in_local_time(
    client: AsyncClient, sessions: async_sessionmaker[AsyncSession]
) -> None:
    project_id = await seed(sessions)
    await seed(sessions, user_id="user-b")  # never shows up for user-a

    response = await client.get("/api/v1/reports/performance", params={"project_id": project_id})

    assert response.status_code == 200
    body = response.json()
    assert body["timezone"] == "America/Sao_Paulo"
    assert body["min_sample"] == 5
    assert len(body["posts"]) == 1  # the draft has no metrics
    post = body["posts"][0]
    assert post["title"] == "Backups"
    assert post["subject"] == "Security"
    assert post["network"] == "linkedin"
    assert (post["weekday"], post["hour"]) == (2, 20)
    assert post["has_image"] is True
    # The latest collection (day 7) replaces the first one
    assert (post["impressions"], post["likes"], post["clicks"]) == (2000, 80, 13)


async def test_empty_project_has_no_posts(client: AsyncClient) -> None:
    project = await client.post("/api/v1/projects", json={"name": "New"})

    response = await client.get(
        "/api/v1/reports/performance", params={"project_id": project.json()["id"]}
    )

    assert response.status_code == 200
    assert response.json()["posts"] == []


async def test_another_users_project_is_not_found(
    client: AsyncClient, sessions: async_sessionmaker[AsyncSession]
) -> None:
    project_id = await seed(sessions)

    response = await client.get(
        "/api/v1/reports/performance", params={"project_id": project_id}, headers=USER_B
    )

    assert response.status_code == 404
