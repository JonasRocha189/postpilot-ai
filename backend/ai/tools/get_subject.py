import uuid
from typing import Annotated, Any

from langchain.tools import ToolRuntime, tool
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from ai.agent.context import AgentContext
from database.models import Subject


async def get_subject_data(ctx: AgentContext, subject_id: str) -> dict[str, Any]:
    """A subject with its audience and tone resolved (the subject's or the project's)."""
    try:
        parsed_id = uuid.UUID(subject_id)
    except ValueError:
        return {"error": "Invalid subject id. Use an id from list_subjects."}
    async with ctx.sessions() as db:
        subject = await db.scalar(
            select(Subject)
            .options(joinedload(Subject.project))
            .where(
                Subject.id == parsed_id,
                Subject.project_id == ctx.project_id,
                Subject.user_id == ctx.user_id,
            )
        )
    if subject is None:
        return {"error": "Subject not found in this project. Use an id from list_subjects."}
    return {
        "id": str(subject.id),
        "name": subject.name,
        "description": subject.description,
        # Empty on the subject = the project's default
        "target_audience": subject.target_audience or subject.project.target_audience,
        "voice_tone": subject.voice_tone or subject.project.voice_tone,
    }


@tool
async def get_subject(
    subject_id: Annotated[str, "id from list_subjects"],
    runtime: ToolRuntime[AgentContext],
) -> dict[str, Any]:
    """Get a subject of the current project and the audience and tone to write for.

    The target audience and voice tone are the subject's own, or the project's
    when the subject has none.
    """
    return await get_subject_data(runtime.context, subject_id)
