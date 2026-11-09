from typing import Any

from langchain.tools import ToolRuntime, tool
from sqlalchemy import select

from ai.agent.context import AgentContext
from database.models import Project


async def get_project_data(ctx: AgentContext) -> dict[str, Any]:
    """The current project: the brand or client the posts are written for."""
    async with ctx.sessions() as db:
        project = await db.scalar(
            select(Project).where(Project.id == ctx.project_id, Project.user_id == ctx.user_id)
        )
    if project is None:
        return {"error": "Project not found"}
    return {
        "name": project.name,
        "description": project.description,
        "target_audience": project.target_audience,
        "voice_tone": project.voice_tone,
    }


@tool
async def get_project(runtime: ToolRuntime[AgentContext]) -> dict[str, Any]:
    """Get the current project (the brand or client the posts are for).

    Returns its name, description, default target audience and default voice tone.
    """
    return await get_project_data(runtime.context)
