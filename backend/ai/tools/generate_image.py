import logging
import uuid
from typing import Annotated, Any, Literal

from langchain.tools import ToolRuntime, tool
from sqlalchemy import func, select

from ai.agent.context import AgentContext
from ai.models import ImageSize
from api.v1.routers.images import key_prefix
from database.models import AgentStep, Image
from storage import s3

logger = logging.getLogger(__name__)

ImageFormat = Literal["square", "portrait", "landscape"]

SIZE_BY_FORMAT: dict[ImageFormat, ImageSize] = {
    "square": "1024x1024",  # every network
    "portrait": "1024x1536",  # Instagram feed and stories
    "landscape": "1536x1024",  # LinkedIn and X
}
# Image models write text badly (and the post already has the text)
NO_TEXT = " Do not include any text, letters, numbers, logos or watermarks in the image."
# Each image costs money: one per run is enough for a post
MAX_IMAGES_PER_RUN = 1
DESCRIPTION_LENGTH = 500


async def images_made_in_run(ctx: AgentContext) -> int:
    """How many images this run already generated (from its recorded steps)."""
    async with ctx.sessions() as db:
        count = await db.scalar(
            select(func.count())
            .select_from(AgentStep)
            .where(
                AgentStep.run_id == ctx.run_id,
                AgentStep.tool == "generate_image",
                AgentStep.result.op("?")("image_id"),
            )
        )
    return count or 0


async def generate_image_data(
    ctx: AgentContext, prompt: str, image_format: ImageFormat
) -> dict[str, Any]:
    """Generate the image and add it to the project's library (S3 + images table)."""
    if ctx.images is None:
        return {"error": "Image generation is not configured. Save the draft without an image."}
    if await images_made_in_run(ctx) >= MAX_IMAGES_PER_RUN:
        return {"error": "This run already generated its image. Use that image_id."}

    try:
        png = await ctx.images(prompt + NO_TEXT, SIZE_BY_FORMAT[image_format])
    except Exception as exc:  # any provider failure: the post goes on without it
        logger.warning("Image generation failed", extra={"error_type": type(exc).__name__})
        return {
            "error": "The image could not be generated (the provider failed or refused "
            "the prompt). Save the draft without an image."
        }

    key = f"{key_prefix(ctx.user_id, ctx.project_id)}{uuid.uuid4()}.png"
    await s3.upload_object(key, png, "image/png")
    async with ctx.sessions() as db:
        image = Image(
            user_id=ctx.user_id,
            project_id=ctx.project_id,
            key=key,
            content_type="image/png",
            description=prompt[:DESCRIPTION_LENGTH],
        )
        db.add(image)
        await db.commit()
        return {"image_id": str(image.id), "format": image_format, "saved_to": "image library"}


@tool
async def generate_image(
    prompt: Annotated[str, "the scene: subject, setting, style, colors and mood (in English)"],
    format: Annotated[ImageFormat, "square (any network), portrait (Instagram), landscape"],
    runtime: ToolRuntime[AgentContext],
) -> dict[str, Any]:
    """Create one illustration for the post and add it to the project's image library.

    Call it at most once, after the text is ready, then pass the returned image_id
    to save_draft. Describe a picture, never text: the image has no words in it.
    """
    return await generate_image_data(runtime.context, prompt, format)
