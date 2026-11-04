import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from api.v1.routers.subjects import get_owned_subject
from database.db import get_db
from database.models import Image, Network, Post, PostFormat, PostImage, PostStatus, Subject
from schemas.posts import PostCreate, PostRead, PostUpdate, post_rule_error

router = APIRouter(prefix="/posts", tags=["posts"])


async def check_images(
    image_ids: list[uuid.UUID], subject: Subject, user_id: str, db: AsyncSession
) -> None:
    """422 unless every image is in the library of the subject's project."""
    if not image_ids:
        return
    found = await db.scalar(
        select(func.count())
        .select_from(Image)
        .where(
            Image.id.in_(image_ids),
            Image.user_id == user_id,
            Image.project_id == subject.project_id,
        )
    )
    if found != len(image_ids):
        raise HTTPException(status_code=422, detail="Image is not in this project's library")


def check_rules(
    network: Network,
    post_format: PostFormat,
    image_count: int,
    content: str | None,
    post_status: PostStatus,
) -> None:
    """422 when the network, format, images and text break the network's rules."""
    error = post_rule_error(network, post_format, image_count, content, post_status)
    if error is not None:
        raise HTTPException(status_code=422, detail=error)


def set_images(post: Post, image_ids: list[uuid.UUID]) -> None:
    """Replace the post's images, keeping the order given (rows of kept images are reused)."""
    current = {item.image_id: item for item in post.images}
    items = []
    for position, image_id in enumerate(image_ids):
        item = current.get(image_id) or PostImage(image_id=image_id)
        item.position = position
        items.append(item)
    post.images = items


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
    status: PostStatus | None = None,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Post]:
    """List the posts of one of the user's projects, ordered by title.

    Optional filters: subject, status and an inclusive expected_date range
    (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, used by the calendar). With a date range,
    posts without expected_date are left out.
    """
    await get_owned_project(project_id, user_id, db)
    query = (
        select(Post)
        .join(Subject)
        .where(Subject.project_id == project_id, Post.user_id == user_id)
        .order_by(Post.title)
    )
    if subject_id is not None:
        query = query.where(Post.subject_id == subject_id)
    if status is not None:
        query = query.where(Post.status == status)
    if date_from is not None:
        query = query.where(Post.expected_date >= date_from)
    if date_to is not None:
        query = query.where(Post.expected_date <= date_to)
    result = await db.scalars(query)
    return list(result)


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Create a post under one of the user's subjects.

    404 if the subject is not theirs; 422 if an image is not in the project's
    library or the post breaks the network's rules (format, images, length).
    """
    subject = await get_owned_subject(body.subject_id, user_id, db)
    await check_images(body.image_ids, subject, user_id, db)
    check_rules(body.network, body.format, len(body.image_ids), body.content, body.status)
    post = Post(**body.model_dump(exclude={"image_ids"}), user_id=user_id)
    set_images(post, body.image_ids)
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
    """Partially update a post: only the fields sent in the body are changed.

    The result is validated as a whole (same rules as the create), so changing
    only the network can fail if the current format or text does not fit it.
    """
    post = await get_owned_post(post_id, user_id, db)
    changes = body.model_dump(exclude_unset=True)
    image_ids: list[uuid.UUID] | None = changes.pop("image_ids", None)
    final_images = image_ids if image_ids is not None else post.image_ids

    if image_ids is not None or "subject_id" in changes:
        # The images must stay in the project of the (possibly new) subject
        subject = await get_owned_subject(changes.get("subject_id", post.subject_id), user_id, db)
        await check_images(final_images, subject, user_id, db)
    check_rules(
        changes.get("network", post.network),
        changes.get("format", post.format),
        len(final_images),
        changes.get("content", post.content),
        changes.get("status", post.status),
    )

    for field, value in changes.items():
        setattr(post, field, value)
    if image_ids is not None:
        set_images(post, image_ids)
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a post. Its images stay in the project's library."""
    post = await get_owned_post(post_id, user_id, db)
    await db.delete(post)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
