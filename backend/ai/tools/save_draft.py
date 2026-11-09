import uuid
from typing import Annotated, Any

from langchain.tools import ToolRuntime, tool
from pydantic import BaseModel, ValidationError
from sqlalchemy import select, update

from ai.agent.context import AgentContext
from api.v1.routers.posts import set_variations
from database.models import AgentRun, Network, Post, PostFormat, PostStatus, Subject
from schemas.posts import PostIn, VariationIn

# The agent writes text only; images are chosen by the user (Instagram has no
# text-only format, so its draft is a single-image post still without the image)
DRAFT_FORMAT: dict[Network, PostFormat] = {
    Network.LINKEDIN: PostFormat.TEXT,
    Network.INSTAGRAM: PostFormat.SINGLE,
    Network.X: PostFormat.TEXT,
}


class DraftVariation(BaseModel):
    """The text of the post for one network."""

    network: Network
    content: str


async def save_draft_data(
    ctx: AgentContext, title: str, subject_id: str, variations: list[DraftVariation]
) -> dict[str, Any]:
    """Save the post as a draft, with one variation per network, linked to the run."""
    try:
        body = PostIn(
            subject_id=uuid.UUID(subject_id),
            title=title,
            variations=[
                # Always a draft: approving and publishing is the user's job
                VariationIn(
                    network=v.network,
                    format=DRAFT_FORMAT[v.network],
                    content=v.content,
                    status=PostStatus.DRAFT,
                )
                for v in variations
            ],
        )
    except ValidationError as exc:
        # The same rules as the post form (limits per network, one per network)
        reasons = "; ".join(str(e["msg"]).removeprefix("Value error, ") for e in exc.errors())
        return {"error": f"The draft breaks a rule: {reasons}"}
    except ValueError:
        return {"error": "Invalid subject id. Use an id from list_subjects."}

    async with ctx.sessions() as db:
        subject = await db.scalar(
            select(Subject.id).where(
                Subject.id == body.subject_id,
                Subject.project_id == ctx.project_id,
                Subject.user_id == ctx.user_id,
            )
        )
        if subject is None:
            return {"error": "Subject not found in this project. Use an id from list_subjects."}
        post = Post(
            user_id=ctx.user_id, subject_id=body.subject_id, title=body.title, variations=[]
        )
        set_variations(post, body.variations)
        db.add(post)
        await db.flush()
        # The run shows a link to the draft it created
        await db.execute(update(AgentRun).where(AgentRun.id == ctx.run_id).values(post_id=post.id))
        await db.commit()
        return {
            "post_id": str(post.id),
            "title": post.title,
            "networks": [v.network.value for v in body.variations],
            "status": PostStatus.DRAFT.value,
        }


@tool
async def save_draft(
    title: Annotated[str, "short title of the post (for the user's list)"],
    subject_id: Annotated[str, "id from list_subjects"],
    variations: Annotated[list[DraftVariation], "the final text for each network"],
    runtime: ToolRuntime[AgentContext],
) -> dict[str, Any]:
    """Save the finished post as a draft for the user to review.

    One variation per network (linkedin, instagram, x), each with the final text
    already adapted to that network. Call it once, at the end. The post is always
    saved as a draft: the user approves and publishes it.
    """
    return await save_draft_data(runtime.context, title, subject_id, variations)
