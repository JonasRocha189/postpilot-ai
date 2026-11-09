"""The agent engine with scripted models: answers, steps, limit, errors, fallback.

The model is a script (no network, no OpenAI): each item is what it "answers"
at one call, either text or a request for tools. The tools are real and read
the test database, so the steps saved are the real ones.
"""

import uuid
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import AIMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from ai.agent.context import AgentContext
from ai.agent.runner import PROMPTS, run_agent, summarize
from ai.tools.registry import READ_TOOLS
from database.config import settings
from database.models import AgentMode, AgentRun, AgentStep, Project, RunStatus, Subject
from tests.fakes import BrokenChatModel, FakeEmbeddings, calls, scripted

pytestmark = pytest.mark.anyio


@tool
async def failing_tool(runtime: ToolRuntime[AgentContext]) -> str:
    """A tool that always fails (to test errors)."""
    raise ValueError("the tool broke")


@pytest.fixture
async def sessions(
    client: AsyncClient, database_url: str
) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Sessions on the test database (`client` empties the tables afterwards)."""
    engine = create_async_engine(database_url, poolclass=NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest.fixture
async def ctx(sessions: async_sessionmaker[AsyncSession]) -> AgentContext:
    """A project with one subject and a run waiting to start."""
    async with sessions() as db:
        project = Project(user_id="user-a", name="Acme", voice_tone="Direto")
        db.add(project)
        await db.flush()
        db.add(Subject(user_id="user-a", project_id=project.id, name="Segurança"))
        run = AgentRun(
            user_id="user-a", project_id=project.id, mode=AgentMode.CREATION, request="Um post"
        )
        db.add(run)
        await db.commit()
        return AgentContext(
            run_id=run.id,
            user_id="user-a",
            project_id=project.id,
            sessions=sessions,
            embeddings=FakeEmbeddings(size=settings.embedding_dimensions),
        )


async def load(ctx: AgentContext) -> tuple[AgentRun, list[AgentStep]]:
    async with ctx.sessions() as db:
        run = await db.get_one(AgentRun, ctx.run_id)
        steps = list(
            await db.scalars(
                select(AgentStep)
                .where(AgentStep.run_id == ctx.run_id)
                .order_by(AgentStep.step_number)
            )
        )
        return run, steps


async def test_an_answer_without_tools(ctx: AgentContext) -> None:
    await run_agent(ctx, AgentMode.IDEATION, "Oi", [scripted(AIMessage("Olá!"))], READ_TOOLS)

    run, steps = await load(ctx)
    assert run.status == RunStatus.COMPLETED
    assert run.response == "Olá!"
    assert run.iterations == 1
    assert run.finished_at is not None
    assert steps == []


async def test_each_tool_call_becomes_a_step(ctx: AgentContext) -> None:
    model = scripted(
        calls(("get_project", {})),
        calls(("list_subjects", {}), ("search_documents", {"query": "backup"})),
        AIMessage("Pronto."),
    )

    await run_agent(ctx, AgentMode.CREATION, "Um post", [model], READ_TOOLS)

    run, steps = await load(ctx)
    assert run.status == RunStatus.COMPLETED
    # Two tools asked together count as one iteration
    assert run.iterations == 3
    assert [(step.step_number, step.tool) for step in steps] == [
        (1, "get_project"),
        (2, "list_subjects"),
        (3, "search_documents"),
    ]
    project_step, subjects_step, search_step = steps
    assert isinstance(project_step.result, dict)
    assert project_step.result["name"] == "Acme"
    assert subjects_step.result_summary == "1 result(s)"
    assert search_step.arguments == {"query": "backup"}
    assert all(step.duration_ms is not None and step.error is None for step in steps)


async def test_the_iteration_limit_stops_the_run(
    ctx: AgentContext, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "agent_max_iterations", 3)
    endless = scripted(*(calls(("get_project", {})) for _ in range(10)))

    await run_agent(ctx, AgentMode.CREATION, "Um post", [endless], READ_TOOLS)

    run, steps = await load(ctx)
    assert run.status == RunStatus.LIMIT_REACHED
    assert run.iterations == 3
    assert len(steps) == 3
    assert "3 steps" in (run.response or "")


async def test_an_answer_at_the_last_allowed_call_is_not_the_limit(
    ctx: AgentContext, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "agent_max_iterations", 2)
    model = scripted(calls(("get_project", {})), AIMessage("Feito."))

    await run_agent(ctx, AgentMode.CREATION, "Um post", [model], READ_TOOLS)

    run, _ = await load(ctx)
    assert (run.status, run.response) == (RunStatus.COMPLETED, "Feito.")


async def test_a_failing_tool_ends_the_run_in_error(ctx: AgentContext) -> None:
    model = scripted(calls(("failing_tool", {})), AIMessage("never reached"))

    await run_agent(ctx, AgentMode.CREATION, "Um post", [model], [*READ_TOOLS, failing_tool])

    run, steps = await load(ctx)
    assert run.status == RunStatus.ERROR
    assert run.response and "went wrong" in run.response
    assert [step.tool for step in steps] == ["failing_tool"]
    assert steps[0].error == "ValueError: the tool broke"


async def test_the_fallback_model_answers_when_the_first_one_fails(ctx: AgentContext) -> None:
    fallback = scripted(AIMessage("Resposta do Groq."))

    await run_agent(
        ctx, AgentMode.IDEATION, "Oi", [BrokenChatModel(messages=iter([])), fallback], READ_TOOLS
    )

    run, _ = await load(ctx)
    assert (run.status, run.response) == (RunStatus.COMPLETED, "Resposta do Groq.")


async def test_without_a_fallback_a_failing_model_ends_in_error(ctx: AgentContext) -> None:
    await run_agent(ctx, AgentMode.IDEATION, "Oi", [BrokenChatModel(messages=iter([]))], READ_TOOLS)

    run, _ = await load(ctx)
    assert run.status == RunStatus.ERROR


async def test_tools_only_see_the_run_context(ctx: AgentContext) -> None:
    """A subject id from another project (made up by the model) is not found."""
    model = scripted(calls(("get_subject", {"subject_id": str(uuid.uuid4())})), AIMessage("Ok."))

    await run_agent(ctx, AgentMode.CREATION, "Um post", [model], READ_TOOLS)

    _, steps = await load(ctx)
    assert isinstance(steps[0].result, dict)
    assert "error" in steps[0].result


# --- pure helpers -------------------------------------------------------------


def test_every_mode_has_a_prompt() -> None:
    assert set(PROMPTS) == set(AgentMode)
    assert all(
        "Never invent" in prompt or "never invent" in prompt.lower() for prompt in PROMPTS.values()
    )


@pytest.mark.parametrize(
    ("content", "summary"),
    [
        ([1, 2, 3], "3 result(s)"),
        ({"error": "Subject not found"}, "Subject not found"),
        ({"name": "Acme"}, '{"name": "Acme"}'),
        ("x" * 300, "x" * 199 + "…"),
    ],
)
def test_summaries_are_short(content: object, summary: str) -> None:
    assert summarize(content) == summary
