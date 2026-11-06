import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from database.models import Image, Subject

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}


async def create_subject(client: AsyncClient, headers: dict[str, str] | None = None) -> str:
    project = await client.post("/api/v1/projects", json={"name": "Brand"}, headers=headers)
    subject = await client.post(
        "/api/v1/subjects",
        json={"project_id": project.json()["id"], "name": "Cloud"},
        headers=headers,
    )
    subject_id: str = subject.json()["id"]
    return subject_id


@pytest.fixture
async def new_image(database_url: str) -> AsyncIterator[Callable[[str], Awaitable[str]]]:
    """Inserts an image row in a subject's project library (S3 isn't needed here)."""
    engine = create_async_engine(database_url, poolclass=NullPool)

    async def make(subject_id: str) -> str:
        # expire_on_commit=False: read image.id after the commit without a new query
        async with AsyncSession(engine, expire_on_commit=False) as db:
            subject = await db.get(Subject, uuid.UUID(subject_id))
            assert subject is not None
            image = Image(
                user_id=subject.user_id,
                project_id=subject.project_id,
                key=f"users/{subject.user_id}/images/{uuid.uuid4()}.png",
                content_type="image/png",
            )
            db.add(image)
            await db.commit()
            return str(image.id)

    yield make
    await engine.dispose()


NewImage = Callable[[str], Awaitable[str]]


def variation(network: str, **fields: Any) -> dict[str, Any]:
    defaults = {"format": "text" if network != "instagram" else "single"}
    return {"network": network, **defaults, **fields}


async def create_post(client: AsyncClient, subject_id: str, *variations: dict[str, Any]) -> Any:
    response = await client.post(
        "/api/v1/posts",
        json={
            "subject_id": subject_id,
            "title": "5 cloud mistakes",
            "variations": list(variations) or [variation("linkedin")],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


# --- Create, read, list -----------------------------------------------------


async def test_create_a_post_with_variations(client: AsyncClient, new_image: NewImage) -> None:
    subject_id = await create_subject(client)
    image_id = await new_image(subject_id)

    post = await create_post(
        client,
        subject_id,
        variation("x", content="Short version", expected_date="2026-11-21"),
        variation(
            "linkedin",
            content="Long version",
            status="approved",
            expected_date="2026-11-20",
        ),
        variation("instagram", image_ids=[image_id]),
    )

    # Returned in network order (LinkedIn, Instagram, X), each with its own id
    assert [v["network"] for v in post["variations"]] == ["linkedin", "instagram", "x"]
    linkedin, instagram, x = post["variations"]
    assert linkedin["status"] == "approved"
    assert linkedin["expected_date"] == "2026-11-20"
    assert instagram["image_ids"] == [image_id]
    assert x == {
        "id": x["id"],
        "network": "x",
        "format": "text",
        "content": "Short version",
        "status": "draft",
        "expected_date": "2026-11-21",
        "image_ids": [],
    }
    fetched = await client.get(f"/api/v1/posts/{post['id']}")
    assert fetched.json() == post


@pytest.mark.parametrize(
    ("variations", "message"),
    [
        pytest.param([], "at least 1", id="no-variations"),
        pytest.param(
            [variation("linkedin"), variation("linkedin")],
            "one variation per network",
            id="repeated-network",
        ),
        pytest.param([variation("instagram", format="text")], "not available", id="format"),
        pytest.param([variation("x", content="a" * 281)], "longer than 280", id="x-text-limit"),
        pytest.param(
            [variation("instagram", status="published")],
            "needs one image",
            id="published-without-image",
        ),
    ],
)
async def test_create_rejects_invalid_variations(
    client: AsyncClient, variations: list[dict[str, Any]], message: str
) -> None:
    subject_id = await create_subject(client)

    response = await client.post(
        "/api/v1/posts",
        json={"subject_id": subject_id, "title": "Post", "variations": variations},
    )

    assert response.status_code == 422
    assert message in response.text


async def test_the_same_text_can_be_valid_on_linkedin_and_too_long_on_x(
    client: AsyncClient,
) -> None:
    subject_id = await create_subject(client)
    text = "a" * 500

    response = await client.post(
        "/api/v1/posts",
        json={
            "subject_id": subject_id,
            "title": "Post",
            "variations": [variation("linkedin", content=text), variation("x", content=text)],
        },
    )

    assert response.status_code == 422
    assert "longer than 280" in response.text


async def test_list_filters_by_variation(client: AsyncClient) -> None:
    subject_id = await create_subject(client)
    project_id = (await client.get(f"/api/v1/subjects/{subject_id}")).json()["project_id"]
    await create_post(
        client,
        subject_id,
        variation("linkedin", status="published", expected_date="2026-11-02"),
        variation("x", status="draft", expected_date="2026-11-20"),
    )

    async def titles(**params: str) -> int:
        response = await client.get("/api/v1/posts", params={"project_id": project_id, **params})
        assert response.status_code == 200
        return len(response.json())

    assert await titles() == 1
    assert await titles(network="x") == 1
    assert await titles(network="instagram") == 0
    assert await titles(status="published", network="linkedin") == 1
    # Both filters must match the SAME variation: X is not published
    assert await titles(status="published", network="x") == 0
    assert await titles(**{"from": "2026-11-15", "to": "2026-11-30"}) == 1
    assert await titles(**{"from": "2026-11-15", "to": "2026-11-30"}, network="linkedin") == 0


# --- Update (PUT replaces the variations) -----------------------------------


async def test_update_keeps_the_variation_id_per_network(client: AsyncClient) -> None:
    subject_id = await create_subject(client)
    post = await create_post(
        client, subject_id, variation("linkedin", content="v1"), variation("x")
    )
    linkedin_id = post["variations"][0]["id"]

    response = await client.put(
        f"/api/v1/posts/{post['id']}",
        json={
            "subject_id": subject_id,
            "title": "New title",
            # X removed, Instagram added, LinkedIn changed
            "variations": [
                variation("instagram"),
                variation("linkedin", content="v2", status="review"),
            ],
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "New title"
    assert [v["network"] for v in updated["variations"]] == ["linkedin", "instagram"]
    linkedin = updated["variations"][0]
    assert linkedin["id"] == linkedin_id  # metrics point to this id
    assert linkedin["content"] == "v2"
    assert linkedin["status"] == "review"


async def test_update_replaces_the_images_in_the_new_order(
    client: AsyncClient, new_image: NewImage
) -> None:
    subject_id = await create_subject(client)
    first = await new_image(subject_id)
    second = await new_image(subject_id)
    post = await create_post(
        client, subject_id, variation("instagram", format="carousel", image_ids=[first, second])
    )

    response = await client.put(
        f"/api/v1/posts/{post['id']}",
        json={
            "subject_id": subject_id,
            "title": post["title"],
            "variations": [variation("instagram", format="carousel", image_ids=[second, first])],
        },
    )

    assert response.json()["variations"][0]["image_ids"] == [second, first]


async def test_an_image_used_by_a_variation_cannot_be_deleted(
    client: AsyncClient, new_image: NewImage
) -> None:
    subject_id = await create_subject(client)
    image_id = await new_image(subject_id)
    post = await create_post(client, subject_id, variation("instagram", image_ids=[image_id]))

    in_use = await client.delete(f"/api/v1/images/{image_id}")
    await client.delete(f"/api/v1/posts/{post['id']}")

    assert in_use.status_code == 409


# --- Authorization -----------------------------------------------------------


async def test_another_user_cannot_read_change_or_delete_the_post(client: AsyncClient) -> None:
    subject_id = await create_subject(client)
    post = await create_post(client, subject_id)
    url = f"/api/v1/posts/{post['id']}"
    body = {"subject_id": subject_id, "title": "Hacked", "variations": [variation("x")]}

    assert (await client.get(url, headers=USER_B)).status_code == 404
    assert (await client.put(url, json=body, headers=USER_B)).status_code == 404
    assert (await client.delete(url, headers=USER_B)).status_code == 404
    assert (await client.get(url)).json()["title"] == "5 cloud mistakes"


async def test_another_user_cannot_use_my_images(client: AsyncClient, new_image: NewImage) -> None:
    my_subject = await create_subject(client)
    my_image = await new_image(my_subject)
    their_subject = await create_subject(client, headers=USER_B)

    response = await client.post(
        "/api/v1/posts",
        json={
            "subject_id": their_subject,
            "title": "Post",
            "variations": [variation("instagram", image_ids=[my_image])],
        },
        headers=USER_B,
    )

    assert response.status_code == 422
