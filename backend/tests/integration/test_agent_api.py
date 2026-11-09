"""The agent API end to end with a scripted model: start, poll, history, drafts.

The background run finishes before the test client returns, so the final state
can be read right after POST. The model is scripted (no network); the tools,
the database and the API are real.
"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage
from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from api.v1.routers.agent import require_chat_models
from api.v1.routers.documents import require_embeddings
from database.config import settings
from database.models import AgentRun
from main import app
from tests.fakes import FakeEmbeddings, calls, scripted

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}


def use_model(*messages: AIMessage) -> None:
    """The next run talks to a model that answers `messages`, in order."""
    models: Sequence[BaseChatModel] = (scripted(*messages),)
    app.dependency_overrides[require_chat_models] = lambda: models


@pytest.fixture(autouse=True)
def fake_embeddings(client: AsyncClient) -> None:
    fake = FakeEmbeddings(size=settings.embedding_dimensions)
    app.dependency_overrides[require_embeddings] = lambda: fake


async def create_project(client: AsyncClient, headers: dict[str, str] | None = None) -> str:
    response = await client.post("/api/v1/projects", json={"name": "Acme"}, headers=headers)
    project_id: str = response.json()["id"]
    return project_id


async def create_subject(client: AsyncClient, project_id: str) -> str:
    response = await client.post(
        "/api/v1/subjects", json={"project_id": project_id, "name": "Segurança"}
    )
    subject_id: str = response.json()["id"]
    return subject_id


async def start(client: AsyncClient, project_id: str, mode: str = "creation", **kwargs: Any) -> Any:
    return await client.post(
        "/api/v1/agent/runs",
        json={"project_id": project_id, "mode": mode, "request": "Um post sobre backup"},
        **kwargs,
    )


async def test_a_run_answers_at_once_and_finishes_in_the_background(client: AsyncClient) -> None:
    project_id = await create_project(client)
    use_model(calls(("get_project", {})), AIMessage("Aqui está a ideia."))

    response = await start(client, project_id, mode="ideation")

    assert response.status_code == 202
    started = response.json()
    assert (started["status"], started["steps"], started["mode"]) == ("running", [], "ideation")
    run = (await client.get(f"/api/v1/agent/runs/{started['id']}")).json()
    assert run["status"] == "completed"
    assert run["response"] == "Aqui está a ideia."
    assert run["iterations"] == 2
    assert run["finished_at"] is not None
    assert [(s["step_number"], s["tool"]) for s in run["steps"]] == [(1, "get_project")]
    # The full result stays in the database: the screen gets a summary
    assert "result" not in run["steps"][0]
    assert '"name": "Acme"' in run["steps"][0]["result_summary"]


async def test_creation_saves_a_draft_linked_to_the_run(client: AsyncClient) -> None:
    project_id = await create_project(client)
    subject_id = await create_subject(client, project_id)
    variations = [
        {"network": "linkedin", "content": "Faça backup todo dia. #seguranca"},
        {"network": "instagram", "content": "Backup salva vidas 💾"},
    ]
    use_model(
        calls(("adapt_for_network", {"text": variations[0]["content"], "network": "linkedin"})),
        calls(
            (
                "save_draft",
                {"title": "Backup diário", "subject_id": subject_id, "variations": variations},
            )
        ),
        AIMessage("Rascunho salvo."),
    )

    run_id = (await start(client, project_id)).json()["id"]

    run = (await client.get(f"/api/v1/agent/runs/{run_id}")).json()
    assert run["status"] == "completed"
    assert run["post_id"] is not None
    post = (await client.get(f"/api/v1/posts/{run['post_id']}")).json()
    assert post["title"] == "Backup diário"
    assert {(v["network"], v["format"], v["status"]) for v in post["variations"]} == {
        ("linkedin", "text", "draft"),
        ("instagram", "single", "draft"),
    }


async def test_a_draft_that_breaks_a_rule_is_explained_to_the_model(client: AsyncClient) -> None:
    project_id = await create_project(client)
    subject_id = await create_subject(client, project_id)
    too_long = [{"network": "x", "content": "a" * 300}]
    use_model(
        calls(("save_draft", {"title": "T", "subject_id": subject_id, "variations": too_long})),
        AIMessage("Vou encurtar."),
    )

    run_id = (await start(client, project_id)).json()["id"]

    run = (await client.get(f"/api/v1/agent/runs/{run_id}")).json()
    assert run["post_id"] is None
    assert "280 characters" in run["steps"][0]["result_summary"]


async def test_history_is_newest_first(client: AsyncClient) -> None:
    project_id = await create_project(client)
    use_model(AIMessage("Primeira."))
    first = (await start(client, project_id)).json()["id"]
    use_model(AIMessage("Segunda."))
    second = (await start(client, project_id)).json()["id"]

    response = await client.get("/api/v1/agent/runs", params={"project_id": project_id})

    assert [run["id"] for run in response.json()] == [second, first]


async def test_a_run_left_running_for_too_long_is_closed(
    client: AsyncClient, database_url: str
) -> None:
    project_id = await create_project(client)
    use_model(AIMessage("Ok."))
    run_id = (await start(client, project_id)).json()["id"]
    # Simulate a run cut off by a restart: still "running", started long ago
    engine = create_async_engine(database_url, poolclass=NullPool)
    async with async_sessionmaker(engine)() as db:
        await db.execute(
            update(AgentRun)
            .where(AgentRun.id == run_id)
            .values(
                status="running",
                finished_at=None,
                created_at=datetime.now(UTC) - timedelta(hours=1),
            )
        )
        await db.commit()
    await engine.dispose()

    run = (await client.get(f"/api/v1/agent/runs/{run_id}")).json()

    assert run["status"] == "error"
    assert "interrupted" in run["response"]


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({"mode": "chat"}, id="unknown-mode"),
        pytest.param({"request": " "}, id="empty-request"),
        pytest.param({"request": "x" * 2001}, id="too-long"),
    ],
)
async def test_the_request_is_validated(client: AsyncClient, body: dict[str, str]) -> None:
    project_id = await create_project(client)
    payload = {"project_id": project_id, "mode": "creation", "request": "Um post", **body}

    assert (await client.post("/api/v1/agent/runs", json=payload)).status_code == 422


async def test_without_ai_keys_the_agent_is_503(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from ai import models

    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")
    models.get_chat_models.cache_clear()
    project_id = await create_project(client)

    response = await start(client, project_id)

    assert response.status_code == 503
    models.get_chat_models.cache_clear()


async def test_another_user_cannot_start_or_see_runs(client: AsyncClient) -> None:
    project_id = await create_project(client)
    use_model(AIMessage("Ok."))
    run_id = (await start(client, project_id)).json()["id"]

    started = await start(client, project_id, headers=USER_B)
    listed = await client.get(
        "/api/v1/agent/runs", params={"project_id": project_id}, headers=USER_B
    )
    fetched = await client.get(f"/api/v1/agent/runs/{run_id}", headers=USER_B)

    assert [started.status_code, listed.status_code, fetched.status_code] == [404, 404, 404]
