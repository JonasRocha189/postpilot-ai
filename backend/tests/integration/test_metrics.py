from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from database.models import Metric

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}
COLLECTED_AT = "2026-11-06T12:00:00Z"


async def published_post(
    client: AsyncClient, headers: dict[str, str] | None = None, **linkedin: Any
) -> dict[str, str]:
    """A post with a LinkedIn and an X variation; returns {network: variation_id}."""
    project = await client.post("/api/v1/projects", json={"name": "Brand"}, headers=headers)
    subject = await client.post(
        "/api/v1/subjects",
        json={"project_id": project.json()["id"], "name": "Cloud"},
        headers=headers,
    )
    post = await client.post(
        "/api/v1/posts",
        json={
            "subject_id": subject.json()["id"],
            "title": "5 cloud mistakes",
            "variations": [
                {"network": "linkedin", "format": "text", "status": "published", **linkedin},
                {"network": "x", "format": "text", "status": "published"},
            ],
        },
        headers=headers,
    )
    assert post.status_code == 201, post.text
    return {v["network"]: v["id"] for v in post.json()["variations"]}


def row(variation_id: str, **fields: Any) -> dict[str, Any]:
    return {
        "variation_id": variation_id,
        "published_at": "2026-11-02T12:00:00Z",
        "impressions": 2720,
        "likes": 65,
        "comments": 13,
        "shares": 9,
        "clicks": 22,
        **fields,
    }


async def import_rows(
    client: AsyncClient,
    *rows: dict[str, Any],
    network: str = "linkedin",
    headers: dict[str, str] | None = None,
) -> Any:
    return await client.post(
        "/api/v1/metrics/import",
        json={"network": network, "collected_at": COLLECTED_AT, "rows": list(rows)},
        headers=headers,
    )


@pytest.fixture
async def saved_metrics(database_url: str) -> AsyncIterator[Callable[[], Awaitable[list[Metric]]]]:
    """Reads the metrics table directly (there is no GET for metrics yet)."""
    engine = create_async_engine(database_url, poolclass=NullPool)

    async def read() -> list[Metric]:
        async with AsyncSession(engine) as db:
            return list(await db.scalars(select(Metric).order_by(Metric.impressions)))

    yield read
    await engine.dispose()


SavedMetrics = Callable[[], Awaitable[list[Metric]]]


async def test_import_saves_one_metric_per_row(
    client: AsyncClient, saved_metrics: SavedMetrics
) -> None:
    linkedin = (await published_post(client))["linkedin"]
    other = (await published_post(client))["linkedin"]

    response = await import_rows(client, row(linkedin), row(other, impressions=100))

    assert response.status_code == 201
    assert response.json() == {"created": 2}
    first, second = await saved_metrics()
    assert str(first.variation_id) == other
    assert first.impressions == 100
    assert str(second.variation_id) == linkedin
    assert (second.likes, second.comments, second.shares, second.clicks) == (65, 13, 9, 22)
    assert second.user_id == "user-a"
    assert second.collected_at.isoformat() == "2026-11-06T12:00:00+00:00"
    assert second.published_at.isoformat() == "2026-11-02T12:00:00+00:00"


@pytest.mark.parametrize(
    ("fields", "message"),
    [
        pytest.param({"likes": -1}, "greater than or equal to 0", id="negative-number"),
        pytest.param(
            {"published_at": "2026-11-07T12:00:00Z"},
            "published_at is after collected_at",
            id="published-after-collected",
        ),
        pytest.param({"published_at": "2026-11-02T12:00:00"}, "timezone", id="no-timezone"),
    ],
)
async def test_import_validates_the_rows(
    client: AsyncClient, fields: dict[str, Any], message: str
) -> None:
    linkedin = (await published_post(client))["linkedin"]

    response = await import_rows(client, row(linkedin, **fields))

    assert response.status_code == 422
    assert message in response.text


async def test_import_needs_at_least_one_row(client: AsyncClient) -> None:
    response = await import_rows(client)

    assert response.status_code == 422


async def test_rows_must_be_published_variations_of_the_network(
    client: AsyncClient,
) -> None:
    variations = await published_post(client)
    draft = (await published_post(client, status="draft"))["linkedin"]

    wrong_network = await import_rows(client, row(variations["x"]))
    not_published = await import_rows(client, row(draft))

    assert wrong_network.status_code == 422
    assert "Row 1" in wrong_network.text
    assert not_published.status_code == 422


async def test_import_is_all_or_nothing(client: AsyncClient, saved_metrics: SavedMetrics) -> None:
    variations = await published_post(client)

    response = await import_rows(client, row(variations["linkedin"]), row(variations["x"]))

    assert response.status_code == 422
    assert "Row 2" in response.text
    assert await saved_metrics() == []


async def test_deleting_the_post_deletes_its_metrics(
    client: AsyncClient, saved_metrics: SavedMetrics
) -> None:
    project = await client.post("/api/v1/projects", json={"name": "Brand"})
    subject = await client.post(
        "/api/v1/subjects", json={"project_id": project.json()["id"], "name": "Cloud"}
    )
    post = await client.post(
        "/api/v1/posts",
        json={
            "subject_id": subject.json()["id"],
            "title": "Post",
            "variations": [{"network": "linkedin", "format": "text", "status": "published"}],
        },
    )
    await import_rows(client, row(post.json()["variations"][0]["id"]))

    await client.delete(f"/api/v1/posts/{post.json()['id']}")

    assert await saved_metrics() == []


async def test_another_user_cannot_import_metrics_for_my_posts(
    client: AsyncClient, saved_metrics: SavedMetrics
) -> None:
    mine = (await published_post(client))["linkedin"]

    response = await import_rows(client, row(mine), headers=USER_B)

    assert response.status_code == 422
    assert await saved_metrics() == []
