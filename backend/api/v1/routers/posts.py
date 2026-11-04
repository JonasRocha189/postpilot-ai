import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from api.v1.routers.subjects import get_owned_subject
from database.db import get_db
from database.models import Image, Post, Subject
from schemas.posts import PostCreate, PostRead, PostUpdate

router = APIRouter(prefix="/posts", tags=["posts"])


async def check_image(
    image_id: uuid.UUID | None, subject: Subject, user_id: str, db: AsyncSession
) -> None:
    """422 unless the image is in the library of the subject's project."""
    if image_id is None:
        return
    image = await db.scalar(
        select(Image).where(
            Image.id == image_id,
            Image.user_id == user_id,
            Image.project_id == subject.project_id,
        )
    )
    if image is None:
        raise HTTPException(status_code=422, detail="Image is not in this project's library")


async def get_owned_post(post_id: uuid.UUID, user_id: str, db: AsyncSession) -> Post:
    """Return the post if it belongs to the user, otherwise 404."""
    post = await db.scalar(select(Post).where(Post.id == post_id, Post.user_id == user_id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.get("", response_model=list[PostRead])
async def list_posts(
    project_id: uuid.UUID,
    subject_id: uuid.UUID | None = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Post]:
    """List the posts of one of the user's projects, optionally filtered by subject."""
    await get_owned_project(project_id, user_id, db)
    query = (
        select(Post)
        .join(Subject)
        .where(Subject.project_id == project_id, Post.user_id == user_id)
        .order_by(Post.title)
    )
    if subject_id is not None:
        query = query.where(Post.subject_id == subject_id)
    result = await db.scalars(query)
    return list(result)


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Create a post under one of the user's subjects. 404 if the subject is not theirs."""
    subject = await get_owned_subject(body.subject_id, user_id, db)
    await check_image(body.image_id, subject, user_id, db)
    post = Post(**body.model_dump(), user_id=user_id)
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.get("/{post_id}", response_model=PostRead)
async def get_post(
    post_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Return one post. 404 if it does not exist or belongs to another user."""
    return await get_owned_post(post_id, user_id, db)


@router.put("/{post_id}", response_model=PostRead)
async def update_post(
    post_id: uuid.UUID,
    body: PostUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Partially update a post: only the fields sent in the body are changed."""
    post = await get_owned_post(post_id, user_id, db)
    changes = body.model_dump(exclude_unset=True)
    if "subject_id" in changes or changes.get("image_id") is not None:
        # The image must stay in the project of the (possibly new) subject
        subject = await get_owned_subject(changes.get("subject_id", post.subject_id), user_id, db)
        await check_image(changes.get("image_id", post.image_id), subject, user_id, db)
    for field, value in changes.items():
        setattr(post, field, value)
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a post. Its image stays in the project's library."""
    post = await get_owned_post(post_id, user_id, db)
    await db.delete(post)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
