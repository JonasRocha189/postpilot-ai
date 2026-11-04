import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from database.db import get_db
from database.models import Image, Post
from schemas.images import (
    EXTENSION_BY_CONTENT_TYPE,
    MAX_IMAGE_BYTES,
    ImageCreate,
    ImageRead,
    ImageUploadUrlRequest,
    ImageUploadUrlResponse,
)
from storage import s3

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["images"])


def key_prefix(user_id: str, project_id: uuid.UUID) -> str:
    """S3 folder of a project's image library (the user is part of the key)."""
    return f"users/{user_id}/projects/{project_id}/images/"


def to_read(image: Image) -> ImageRead:
    """Response body with a fresh presigned read URL."""
    return ImageRead(
        id=image.id,
        project_id=image.project_id,
        content_type=image.content_type,
        description=image.description,
        url=s3.presigned_download_url(image.key),
        created_at=image.created_at,
        updated_at=image.updated_at,
    )


async def get_owned_image(image_id: uuid.UUID, user_id: str, db: AsyncSession) -> Image:
    """Return the image if it belongs to the user, otherwise 404."""
    image = await db.scalar(select(Image).where(Image.id == image_id, Image.user_id == user_id))
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.get("", response_model=list[ImageRead])
async def list_images(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ImageRead]:
    """List a project's image library, newest first."""
    await get_owned_project(project_id, user_id, db)
    result = await db.scalars(
        select(Image)
        .where(Image.project_id == project_id, Image.user_id == user_id)
        .order_by(Image.created_at.desc())
    )
    return [to_read(image) for image in result]


@router.post("/upload-url", response_model=ImageUploadUrlResponse)
async def create_upload_url(
    body: ImageUploadUrlRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ImageUploadUrlResponse:
    """Presigned PUT URL for the browser. Type and size are validated by the schema."""
    await get_owned_project(body.project_id, user_id, db)
    extension = EXTENSION_BY_CONTENT_TYPE[body.content_type]
    key = f"{key_prefix(user_id, body.project_id)}{uuid.uuid4()}.{extension}"
    return ImageUploadUrlResponse(
        key=key, upload_url=s3.presigned_upload_url(key, body.content_type)
    )


@router.post("", response_model=ImageRead, status_code=status.HTTP_201_CREATED)
async def create_image(
    body: ImageCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ImageRead:
    """Register an uploaded file in the project's library.

    422 if the key is not from this user's project library, if the file was not
    uploaded, or if it is larger than allowed (the object is then deleted).
    """
    await get_owned_project(body.project_id, user_id, db)
    if not body.key.startswith(key_prefix(user_id, body.project_id)):
        raise HTTPException(status_code=422, detail="Invalid image key")

    size = await s3.object_size(body.key)
    if size is None:
        raise HTTPException(status_code=422, detail="Image was not uploaded")
    if size > MAX_IMAGE_BYTES:
        await s3.delete_object(body.key)
        raise HTTPException(status_code=422, detail="Image is too large")

    image = Image(**body.model_dump(), user_id=user_id)
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return to_read(image)


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete an image and its S3 object. 409 if a post still uses it."""
    image = await get_owned_image(image_id, user_id, db)
    in_use = await db.scalar(select(Post.id).where(Post.image_id == image.id).limit(1))
    if in_use is not None:
        raise HTTPException(status_code=409, detail="Image is used by posts")
    key = image.key
    await db.delete(image)
    await db.commit()
    try:
        await s3.delete_object(key)
    except Exception:
        # The row is gone; an orphan object only costs storage
        logger.exception("Failed to delete S3 object", extra={"image_id": str(image_id)})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
