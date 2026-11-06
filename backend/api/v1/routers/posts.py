import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from api.v1.routers.subjects import get_owned_subject
from database.db import get_db
from database.models import (
    Image,
    Network,
    Post,
    PostStatus,
    PostVariation,
    Subject,
    VariationImage,
)
from schemas.posts import PostIn, PostRead, VariationIn

router = APIRouter(prefix="/posts", tags=["posts"])


async def check_images(
    variations: list[VariationIn], subject: Subject, user_id: str, db: AsyncSession
) -> None:
    """422 unless every image of every variation is in the subject's project library."""
    image_ids = {image_id for v in variations for image_id in v.image_ids}
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


def set_images(variation: PostVariation, image_ids: list[uuid.UUID]) -> None:
    """Replace the variation's images, keeping the order given (kept rows are reused)."""
    current = {item.image_id: item for item in variation.images}
    items = []
    for position, image_id in enumerate(image_ids):
        item = current.get(image_id) or VariationImage(image_id=image_id)
        item.position = position
        items.append(item)
    variation.images = items


def set_variations(post: Post, variations: list[VariationIn]) -> None:
    """Replace the post's variations, matched by network.

    A network that stays keeps its variation (and id, which metrics point to);
    a new network gets a new variation; a network left out is deleted
    (delete-orphan cascade).
    """
    current = {v.network: v for v in post.variations}
    result = []
    for data in variations:
        variation = current.get(data.network) or PostVariation(network=data.network)
        variation.format = data.format
        variation.content = data.content
        variation.status = data.status
        variation.expected_date = data.expected_date
        set_images(variation, data.image_ids)
        result.append(variation)
    post.variations = result


async def get_owned_post(post_id: uuid.UUID, user_id: str, db: AsyncSession) -> Post:
    """Return the post if it belongs to the user, otherwise 404."""
    post = await db.scalar(select(Post).where(Post.id == post_id, Post.user_id == user_id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


async def reload(post: Post, db: AsyncSession) -> Post:
    """The saved post with fresh variations and images (ids and order from the database)."""
    result = await db.scalar(
        select(Post).where(Post.id == post.id).execution_options(populate_existing=True)
    )
    assert result is not None
    return result


@router.get("", response_model=list[PostRead])
async def list_posts(
    project_id: uuid.UUID,
    subject_id: uuid.UUID | None = None,
    status: PostStatus | None = None,
    network: Network | None = None,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Post]:
    """List the posts of one of the user's projects, ordered by title, with all variations.

    Optional filters: subject, and per variation status, network and an inclusive
    expected_date range (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, used by the calendar).
    A post is listed when one variation matches all the variation filters.
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

    # The variation filters apply to the same variation: EXISTS (... AND ...)
    conditions = []
    if status is not None:
        conditions.append(PostVariation.status == status)
    if network is not None:
        conditions.append(PostVariation.network == network)
    if date_from is not None:
        conditions.append(PostVariation.expected_date >= date_from)
    if date_to is not None:
        conditions.append(PostVariation.expected_date <= date_to)
    if conditions:
        query = query.where(
            select(PostVariation.id).where(PostVariation.post_id == Post.id, *conditions).exists()
        )
    result = await db.scalars(query)
    return list(result)


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Create a post and its variations under one of the user's subjects.

    404 if the subject is not theirs; 422 if an image is not in the project's
    library or a variation breaks its network's rules (checked in the schema).
    """
    subject = await get_owned_subject(body.subject_id, user_id, db)
    await check_images(body.variations, subject, user_id, db)
    post = Post(user_id=user_id, subject_id=body.subject_id, title=body.title, variations=[])
    set_variations(post, body.variations)
    db.add(post)
    await db.commit()
    return await reload(post, db)


@router.get("/{post_id}", response_model=PostRead)
async def get_post(
    post_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Return one post with its variations. 404 if it does not exist or is another user's."""
    return await get_owned_post(post_id, user_id, db)


@router.put("/{post_id}", response_model=PostRead)
async def update_post(
    post_id: uuid.UUID,
    body: PostIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Post:
    """Replace the post and its variations (same body and checks as the create).

    Each network that stays keeps its variation id; the others are deleted.
    """
    post = await get_owned_post(post_id, user_id, db)
    subject = await get_owned_subject(body.subject_id, user_id, db)
    await check_images(body.variations, subject, user_id, db)
    post.subject_id = body.subject_id
    post.title = body.title
    set_variations(post, body.variations)
    await db.commit()
    return await reload(post, db)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a post and its variations. The images stay in the project's library."""
    post = await get_owned_post(post_id, user_id, db)
    await db.delete(post)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
