import uuid
from typing import Annotated, Any

from langchain.tools import ToolRuntime, tool
from sqlalchemy import select

from ai.agent.context import AgentContext
from database.models import Post, PostStatus, PostVariation, Subject

# Examples of the brand's voice: enough for the style, few enough for the prompt
MAX_EXAMPLES = 5


async def search_past_posts_data(
    ctx: AgentContext, subject_id: str | None = None
) -> list[dict[str, Any]] | dict[str, str]:
    """Approved or published variations of the project (optionally of one subject)."""
    query = (
        select(Post.title, PostVariation.network, PostVariation.format, PostVariation.content)
        .join(PostVariation, PostVariation.post_id == Post.id)
        .join(Subject, Post.subject_id == Subject.id)
        .where(
            Subject.project_id == ctx.project_id,
            Post.user_id == ctx.user_id,
            # Only what the user approved shows the brand's voice
            PostVariation.status.in_([PostStatus.APPROVED, PostStatus.PUBLISHED]),
            PostVariation.content.is_not(None),
        )
        .order_by(PostVariation.updated_at.desc())
        .limit(MAX_EXAMPLES)
    )
    if subject_id:
        try:
            query = query.where(Post.subject_id == uuid.UUID(subject_id))
        except ValueError:
            return {"error": "Invalid subject id. Use an id from list_subjects."}
    async with ctx.sessions() as db:
        rows = await db.execute(query)
        return [
            {
                "title": row.title,
                "network": row.network.value,
                "format": row.format.value,
                "content": row.content,
            }
            for row in rows
        ]


@tool
async def search_past_posts(
    runtime: ToolRuntime[AgentContext],
    subject_id: Annotated[
        str | None, "optional id from list_subjects, for one subject only"
    ] = None,
) -> list[dict[str, Any]] | dict[str, str]:
    """Get recent approved or published posts of the current project.

    Use them to imitate the brand's style and voice. An empty list means there are
    none yet.
    """
    return await search_past_posts_data(runtime.context, subject_id)
