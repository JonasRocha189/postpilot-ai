from typing import Any

from langchain.tools import ToolRuntime, tool
from sqlalchemy import select

from ai.agent.context import AgentContext
from database.models import Subject


async def list_subjects_data(ctx: AgentContext) -> list[dict[str, Any]]:
    """The project's subjects (id, name and description), by name."""
    async with ctx.sessions() as db:
        subjects = await db.scalars(
            select(Subject)
            .where(Subject.project_id == ctx.project_id, Subject.user_id == ctx.user_id)
            .order_by(Subject.name)
        )
        return [
            {"id": str(subject.id), "name": subject.name, "description": subject.description}
            for subject in subjects
        ]


@tool
async def list_subjects(runtime: ToolRuntime[AgentContext]) -> list[dict[str, Any]]:
    """List the subjects (topics) of the current project, with their ids.

    Use an id with get_subject or search_past_posts.
    """
    return await list_subjects_data(runtime.context)
