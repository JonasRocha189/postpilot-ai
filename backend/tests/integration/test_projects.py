from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}


async def create_project(client: AsyncClient, **fields: Any) -> dict[str, Any]:
    body = {"name": "Cloud Consulting", "target_audience": "IT managers", **fields}
    response = await client.post("/api/v1/projects", json=body)
    assert response.status_code == 201, response.text
    project: dict[str, Any] = response.json()
    return project


# --- CRUD ---------------------------------------------------------------------


async def test_create_and_get_a_project(client: AsyncClient) -> None:
    created = await create_project(client, voice_tone="Professional")

    response = await client.get(f"/api/v1/projects/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created
    assert created["name"] == "Cloud Consulting"
    assert created["voice_tone"] == "Professional"


async def test_list_returns_the_projects_ordered_by_name(client: AsyncClient) -> None:
    await create_project(client, name="Zeta")
    await create_project(client, name="Alpha")

    response = await client.get("/api/v1/projects")

    assert [project["name"] for project in response.json()] == ["Alpha", "Zeta"]


async def test_update_changes_only_the_fields_sent(client: AsyncClient) -> None:
    created = await create_project(client)

    response = await client.put(f"/api/v1/projects/{created['id']}", json={"name": "New name"})

    assert response.status_code == 200
    assert response.json()["name"] == "New name"
    assert response.json()["target_audience"] == "IT managers"  # untouched


async def test_delete_removes_the_project(client: AsyncClient) -> None:
    created = await create_project(client)

    response = await client.delete(f"/api/v1/projects/{created['id']}")

    assert response.status_code == 204
    assert (await client.get(f"/api/v1/projects/{created['id']}")).status_code == 404


async def test_delete_with_subjects_returns_409(client: AsyncClient) -> None:
    project = await create_project(client)
    await client.post("/api/v1/subjects", json={"project_id": project["id"], "name": "Costs"})

    response = await client.delete(f"/api/v1/projects/{project['id']}")

    assert response.status_code == 409
    assert response.json() == {"detail": "Project has subjects"}


@pytest.mark.parametrize(
    "body", [{"name": ""}, {"name": "   "}, {}], ids=["empty", "blank", "missing"]
)
async def test_create_rejects_an_invalid_name(client: AsyncClient, body: dict[str, str]) -> None:
    response = await client.post("/api/v1/projects", json=body)

    assert response.status_code == 422


# --- Authorization: one user never sees another user's data -----------------


async def test_another_user_cannot_see_the_project(client: AsyncClient) -> None:
    project = await create_project(client)  # created by user-a

    listed = await client.get("/api/v1/projects", headers=USER_B)
    fetched = await client.get(f"/api/v1/projects/{project['id']}", headers=USER_B)

    assert listed.json() == []
    assert fetched.status_code == 404  # 404, not 403: don't reveal that it exists


async def test_another_user_cannot_change_or_delete_the_project(client: AsyncClient) -> None:
    project = await create_project(client)
    url = f"/api/v1/projects/{project['id']}"

    updated = await client.put(url, json={"name": "Hacked"}, headers=USER_B)
    deleted = await client.delete(url, headers=USER_B)

    assert updated.status_code == 404
    assert deleted.status_code == 404
    # The owner still sees it unchanged
    assert (await client.get(url)).json()["name"] == "Cloud Consulting"


async def test_another_user_cannot_create_a_subject_in_the_project(client: AsyncClient) -> None:
    project = await create_project(client)

    response = await client.post(
        "/api/v1/subjects", json={"project_id": project["id"], "name": "Intruder"}, headers=USER_B
    )

    assert response.status_code == 404
