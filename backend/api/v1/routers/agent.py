import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from ai.agent.context import AgentContext
from ai.agent.runner import RUN_TIMEOUT_SECONDS, run_agent
from ai.models import AIConfigError, ImageGenerator, get_chat_models, get_image_generator
from ai.tools.registry import TOOLS_BY_MODE
from api.deps import get_current_user_id
from api.v1.routers.documents import require_embeddings
from api.v1.routers.projects import get_owned_project
from database.db import get_db, get_session_factory
from database.models import AgentRun, RunStatus
from schemas.agent import AgentRunCreate, AgentRunRead

router = APIRouter(prefix="/agent/runs", tags=["agent"])

# A run still "running" after this was cut off (a restart or a deploy killed it)
STALE_AFTER = timedelta(seconds=RUN_TIMEOUT_SECONDS + 60)
HISTORY_SIZE = 50


def require_chat_models() -> Sequence[BaseChatModel]:
    """The chat models, or 503 when the AI is not configured (no API key)."""
    try:
        return get_chat_models()
    except AIConfigError as exc:
        raise HTTPException(status_code=503, detail="AI is not configured") from exc


def optional_image_generator() -> ImageGenerator | None:
    """The image generator, or None: without it the agent still writes the text."""
    try:
        return get_image_generator()
    except AIConfigError:
        return None


async def expire_stale_runs(runs: Sequence[AgentRun], db: AsyncSession) -> None:
    """Close runs that will never finish, so the screen stops waiting for them."""
    now = datetime.now(UTC)
    stale = [r for r in runs if r.status == RunStatus.RUNNING and now - r.created_at > STALE_AFTER]
    for run in stale:
        run.status = RunStatus.ERROR
        run.response = "The run was interrupted. Try again."
        run.finished_at = now
    if stale:
        await db.commit()


@router.post("", response_model=AgentRunRead, status_code=status.HTTP_202_ACCEPTED)
async def start_run(
    body: AgentRunCreate,
    background: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    sessions: async_sessionmaker[AsyncSession] = Depends(get_session_factory),
    models: Sequence[BaseChatModel] = Depends(require_chat_models),
    embeddings: Embeddings = Depends(require_embeddings),
    images: ImageGenerator | None = Depends(optional_image_generator),
) -> AgentRun:
    """Start the agent on the project. Answers at once with `running`.

    The loop runs in the background; poll GET /agent/runs/{id} for the steps.
    """
    await get_owned_project(body.project_id, user_id, db)
    run = AgentRun(
        user_id=user_id,
        project_id=body.project_id,
        mode=body.mode,
        request=body.request,
        status=RunStatus.RUNNING,
        steps=[],
    )
    db.add(run)
    await db.commit()
    # Timestamps come from the database
    await db.refresh(run, attribute_names=["created_at", "updated_at"])
    # user_id and project_id come from the token and the checked project, never from the LLM
    ctx = AgentContext(
        run_id=run.id,
        user_id=user_id,
        project_id=body.project_id,
        sessions=sessions,
        embeddings=embeddings,
        images=images,
    )
    background.add_task(run_agent, ctx, body.mode, body.request, models, TOOLS_BY_MODE[body.mode])
    return run


@router.get("", response_model=list[AgentRunRead])
async def list_runs(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[AgentRun]:
    """The project's runs, newest first (the last 50)."""
    await get_owned_project(project_id, user_id, db)
    runs = list(
        await db.scalars(
            select(AgentRun)
            .options(selectinload(AgentRun.steps))
            .where(AgentRun.project_id == project_id, AgentRun.user_id == user_id)
            .order_by(AgentRun.created_at.desc())
            .limit(HISTORY_SIZE)
        )
    )
    await expire_stale_runs(runs, db)
    return runs


@router.get("/{run_id}", response_model=AgentRunRead)
async def get_run(
    run_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> AgentRun:
    """A run with the steps saved so far. 404 if it is not the user's."""
    run = await db.scalar(
        select(AgentRun)
        .options(selectinload(AgentRun.steps))
        .where(AgentRun.id == run_id, AgentRun.user_id == user_id)
        .execution_options(populate_existing=True)
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    await expire_stale_runs([run], db)
    return run
