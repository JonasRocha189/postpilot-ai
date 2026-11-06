from typing import Any

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}


async def create_project(client: AsyncClient, headers: dict[str, str] | None = None) -> str:
    response = await client.post("/api/v1/projects", json={"name": "Brand"}, headers=headers)
    project_id: str = response.json()["id"]
    return project_id


async def create_subject(client: AsyncClient, project_id: str) -> str:
    response = await client.post(
        "/api/v1/subjects", json={"project_id": project_id, "name": "Cloud"}
    )
    subject_id: str = response.json()["id"]
    return subject_id


async def create_post(client: AsyncClient, subject_id: str) -> str:
    response = await client.post(
        "/api/v1/posts",
        json={
            "subject_id": subject_id,
            "title": "From the idea",
            "variations": [{"network": "linkedin", "format": "text"}],
        },
    )
    assert response.status_code == 201, response.text
    post_id: str = response.json()["id"]
    return post_id


async def create_idea(client: AsyncClient, project_id: str, **fields: Any) -> Any:
    response = await client.post(
        "/api/v1/ideas", json={"project_id": project_id, "title": "Kubernetes myths", **fields}
    )
    assert response.status_code == 201, response.text
    return response.json()


def body(idea: dict[str, Any], **changes: Any) -> dict[str, Any]:
    """PUT body from an idea (PUT replaces every field)."""
    fields = ("title", "notes", "subject_id", "networks", "post_id")
    return {**{key: idea[key] for key in fields}, **changes}


# --- Create, read, list -----------------------------------------------------


async def test_create_an_idea_with_defaults(client: AsyncClient) -> None:
    project_id = await create_project(client)

    idea = await create_idea(client, project_id)

    assert idea == {
        "id": idea["id"],
        "project_id": project_id,
        "title": "Kubernetes myths",
        "notes": None,
        "subject_id": None,
        "networks": [],
        "source": "manual",
        "post_id": None,
        "created_at": idea["created_at"],
        "updated_at": idea["updated_at"],
    }
    assert (await client.get(f"/api/v1/ideas/{idea['id']}")).json() == idea


async def test_networks_are_unique_and_in_order(client: AsyncClient) -> None:
    project_id = await create_project(client)
    subject_id = await create_subject(client, project_id)

    idea = await create_idea(
        client,
        project_id,
        subject_id=subject_id,
        notes="  Start with the YAML  ",
        networks=["x", "linkedin", "x"],
    )

    assert idea["networks"] == ["linkedin", "x"]
    assert idea["notes"] == "Start with the YAML"
    assert idea["subject_id"] == subject_id


@pytest.mark.parametrize(
    "fields",
    [
        pytest.param({"title": "   "}, id="blank-title"),
        pytest.param({"networks": ["tiktok"]}, id="unknown-network"),
        pytest.param({"source": "agent"}, id="source-is-ignored"),
    ],
)
async def test_create_validates_the_body(client: AsyncClient, fields: dict[str, Any]) -> None:
    project_id = await create_project(client)

    response = await client.post(
        "/api/v1/ideas", json={"project_id": project_id, "title": "Idea", **fields}
    )

    if "source" in fields:
        # Only the agent creates ideas with source "agent"; the API ignores the field
        assert response.json()["source"] == "manual"
    else:
        assert response.status_code == 422


async def test_the_subject_must_be_in_the_same_project(client: AsyncClient) -> None:
    project_id = await create_project(client)
    other_project = await create_project(client)
    other_subject = await create_subject(client, other_project)

    response = await client.post(
        "/api/v1/ideas",
        json={"project_id": project_id, "title": "Idea", "subject_id": other_subject},
    )

    assert response.status_code == 422


async def test_list_is_per_project_newest_first(client: AsyncClient) -> None:
    project_id = await create_project(client)
    other_project = await create_project(client)
    await create_idea(client, project_id, title="First")
    await create_idea(client, project_id, title="Second")
    await create_idea(client, other_project, title="Elsewhere")

    response = await client.get("/api/v1/ideas", params={"project_id": project_id})

    assert response.status_code == 200
    assert [idea["title"] for idea in response.json()] == ["Second", "First"]


# --- Update: the post created from the idea ---------------------------------


async def test_update_links_the_post_created_from_the_idea(client: AsyncClient) -> None:
    project_id = await create_project(client)
    subject_id = await create_subject(client, project_id)
    idea = await create_idea(client, project_id, networks=["linkedin"])
    post_id = await create_post(client, subject_id)

    response = await client.put(
        f"/api/v1/ideas/{idea['id']}",
        json=body(idea, title="Kubernetes myths, part 1", subject_id=subject_id, post_id=post_id),
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Kubernetes myths, part 1"
    assert updated["post_id"] == post_id
    assert updated["project_id"] == project_id


async def test_update_rejects_a_post_from_another_project(client: AsyncClient) -> None:
    project_id = await create_project(client)
    other_subject = await create_subject(client, await create_project(client))
    idea = await create_idea(client, project_id)
    post_id = await create_post(client, other_subject)

    response = await client.put(f"/api/v1/ideas/{idea['id']}", json=body(idea, post_id=post_id))

    assert response.status_code == 422


async def test_deleting_the_post_opens_the_idea_again(client: AsyncClient) -> None:
    project_id = await create_project(client)
    subject_id = await create_subject(client, project_id)
    idea = await create_idea(client, project_id, subject_id=subject_id)
    post_id = await create_post(client, subject_id)
    await client.put(f"/api/v1/ideas/{idea['id']}", json=body(idea, post_id=post_id))

    await client.delete(f"/api/v1/posts/{post_id}")

    assert (await client.get(f"/api/v1/ideas/{idea['id']}")).json()["post_id"] is None


async def test_deleting_the_subject_keeps_the_idea(client: AsyncClient) -> None:
    project_id = await create_project(client)
    subject_id = await create_subject(client, project_id)
    idea = await create_idea(client, project_id, subject_id=subject_id)

    deleted = await client.delete(f"/api/v1/subjects/{subject_id}")

    assert deleted.status_code == 204
    assert (await client.get(f"/api/v1/ideas/{idea['id']}")).json()["subject_id"] is None


async def test_deleting_the_idea_keeps_the_post(client: AsyncClient) -> None:
    project_id = await create_project(client)
    subject_id = await create_subject(client, project_id)
    idea = await create_idea(client, project_id)
    post_id = await create_post(client, subject_id)
    await client.put(f"/api/v1/ideas/{idea['id']}", json=body(idea, post_id=post_id))

    deleted = await client.delete(f"/api/v1/ideas/{idea['id']}")

    assert deleted.status_code == 204
    assert (await client.get(f"/api/v1/ideas/{idea['id']}")).status_code == 404
    assert (await client.get(f"/api/v1/posts/{post_id}")).status_code == 200


# --- Authorization -----------------------------------------------------------


async def test_another_user_cannot_see_or_change_the_ideas(client: AsyncClient) -> None:
    project_id = await create_project(client)
    idea = await create_idea(client, project_id)
    url = f"/api/v1/ideas/{idea['id']}"

    listed = await client.get("/api/v1/ideas", params={"project_id": project_id}, headers=USER_B)
    created = await client.post(
        "/api/v1/ideas", json={"project_id": project_id, "title": "Mine"}, headers=USER_B
    )

    assert listed.status_code == 404
    assert created.status_code == 404
    assert (await client.get(url, headers=USER_B)).status_code == 404
    assert (await client.put(url, json=body(idea), headers=USER_B)).status_code == 404
    assert (await client.delete(url, headers=USER_B)).status_code == 404
    assert (await client.get(url)).json() == idea
