from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}


async def create_project(client: AsyncClient, headers: dict[str, str] | None = None) -> str:
    response = await client.post("/api/v1/projects", json={"name": "Brand"}, headers=headers)
    assert response.status_code == 201, response.text
    project_id: str = response.json()["id"]
    return project_id


async def create_subject(client: AsyncClient, project_id: str, **fields: Any) -> dict[str, Any]:
    body = {"project_id": project_id, "name": "Cloud", **fields}
    response = await client.post("/api/v1/subjects", json=body)
    assert response.status_code == 201, response.text
    subject: dict[str, Any] = response.json()
    return subject


# --- CRUD ---------------------------------------------------------------------


async def test_create_and_get_a_subject(client: AsyncClient) -> None:
    project_id = await create_project(client)

    created = await create_subject(
        client, project_id, name="  Kubernetes  ", voice_tone="Technical", target_audience=None
    )

    assert created == {
        "id": created["id"],
        "project_id": project_id,
        "name": "Kubernetes",
        "description": None,
        "target_audience": None,  # empty: the project's audience applies
        "voice_tone": "Technical",
        "created_at": created["created_at"],
        "updated_at": created["updated_at"],
    }
    assert (await client.get(f"/api/v1/subjects/{created['id']}")).json() == created


async def test_list_is_per_project_ordered_by_name(client: AsyncClient) -> None:
    project_id = await create_project(client)
    other_project = await create_project(client)
    await create_subject(client, project_id, name="Security")
    await create_subject(client, project_id, name="Backup")
    await create_subject(client, other_project, name="Elsewhere")

    response = await client.get("/api/v1/subjects", params={"project_id": project_id})

    assert response.status_code == 200
    assert [subject["name"] for subject in response.json()] == ["Backup", "Security"]


async def test_list_requires_the_project(client: AsyncClient) -> None:
    response = await client.get("/api/v1/subjects")

    assert response.status_code == 422


async def test_update_changes_only_the_fields_sent(client: AsyncClient) -> None:
    subject = await create_subject(client, await create_project(client), description="Old")

    response = await client.put(f"/api/v1/subjects/{subject['id']}", json={"voice_tone": "Fun"})

    assert response.status_code == 200
    updated = response.json()
    assert updated["voice_tone"] == "Fun"
    assert updated["name"] == "Cloud"
    assert updated["description"] == "Old"


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({"name": None}, id="null-name"),
        pytest.param({"name": "   "}, id="blank-name"),
    ],
)
async def test_update_rejects_an_empty_name(client: AsyncClient, body: dict[str, Any]) -> None:
    subject = await create_subject(client, await create_project(client))

    response = await client.put(f"/api/v1/subjects/{subject['id']}", json=body)

    assert response.status_code == 422


async def test_create_rejects_a_blank_name(client: AsyncClient) -> None:
    project_id = await create_project(client)

    response = await client.post("/api/v1/subjects", json={"project_id": project_id, "name": "  "})

    assert response.status_code == 422


async def test_delete_removes_the_subject(client: AsyncClient) -> None:
    subject = await create_subject(client, await create_project(client))

    response = await client.delete(f"/api/v1/subjects/{subject['id']}")

    assert response.status_code == 204
    assert (await client.get(f"/api/v1/subjects/{subject['id']}")).status_code == 404


async def test_delete_with_posts_returns_409(client: AsyncClient) -> None:
    subject = await create_subject(client, await create_project(client))
    post = await client.post(
        "/api/v1/posts",
        json={
            "subject_id": subject["id"],
            "title": "Post",
            "variations": [{"network": "linkedin", "format": "text"}],
        },
    )

    blocked = await client.delete(f"/api/v1/subjects/{subject['id']}")
    await client.delete(f"/api/v1/posts/{post.json()['id']}")
    allowed = await client.delete(f"/api/v1/subjects/{subject['id']}")

    assert blocked.status_code == 409
    assert allowed.status_code == 204


# --- Authorization -----------------------------------------------------------


async def test_another_user_cannot_list_or_create_in_my_project(client: AsyncClient) -> None:
    project_id = await create_project(client)

    listed = await client.get("/api/v1/subjects", params={"project_id": project_id}, headers=USER_B)
    created = await client.post(
        "/api/v1/subjects", json={"project_id": project_id, "name": "Mine"}, headers=USER_B
    )

    assert listed.status_code == 404
    assert created.status_code == 404


async def test_another_user_cannot_read_change_or_delete_the_subject(
    client: AsyncClient,
) -> None:
    subject = await create_subject(client, await create_project(client))
    url = f"/api/v1/subjects/{subject['id']}"

    assert (await client.get(url, headers=USER_B)).status_code == 404
    assert (await client.put(url, json={"name": "Hacked"}, headers=USER_B)).status_code == 404
    assert (await client.delete(url, headers=USER_B)).status_code == 404
    assert (await client.get(url)).json() == subject
