import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from database.db import get_db
from database.models import Idea, Post, Subject
from schemas.ideas import IdeaCreate, IdeaRead, IdeaUpdate

router = APIRouter(prefix="/ideas", tags=["ideas"])


async def get_owned_idea(idea_id: uuid.UUID, user_id: str, db: AsyncSession) -> Idea:
    """Return the idea if it belongs to the user, otherwise 404."""
    idea = await db.scalar(select(Idea).where(Idea.id == idea_id, Idea.user_id == user_id))
    if idea is None:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea


async def check_subject(
    subject_id: uuid.UUID | None, project_id: uuid.UUID, user_id: str, db: AsyncSession
) -> None:
    """422 unless the subject (when given) is the user's and in the idea's project."""
    if subject_id is None:
        return
    found = await db.scalar(
        select(Subject.id).where(
            Subject.id == subject_id,
            Subject.user_id == user_id,
            Subject.project_id == project_id,
        )
    )
    if found is None:
        raise HTTPException(status_code=422, detail="Subject is not in this project")


async def check_post(
    post_id: uuid.UUID | None, project_id: uuid.UUID, user_id: str, db: AsyncSession
) -> None:
    """422 unless the post (when given) is the user's and in the idea's project."""
    if post_id is None:
        return
    found = await db.scalar(
        select(Post.id)
        .join(Subject)
        .where(Post.id == post_id, Post.user_id == user_id, Subject.project_id == project_id)
    )
    if found is None:
        raise HTTPException(status_code=422, detail="Post is not in this project")


@router.get("", response_model=list[IdeaRead])
async def list_ideas(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Idea]:
    """List the ideas of one of the user's projects, newest first."""
    await get_owned_project(project_id, user_id, db)
    result = await db.scalars(
        select(Idea)
        .where(Idea.project_id == project_id, Idea.user_id == user_id)
        .order_by(Idea.created_at.desc(), Idea.id)
    )
    return list(result)


@router.post("", response_model=IdeaRead, status_code=status.HTTP_201_CREATED)
async def create_idea(
    body: IdeaCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Idea:
    """Create an idea (source `manual`).

    404 if the project is not the user's; 422 if the subject is not in the project.
    """
    await get_owned_project(body.project_id, user_id, db)
    await check_subject(body.subject_id, body.project_id, user_id, db)
    idea = Idea(**body.model_dump(), user_id=user_id)
    db.add(idea)
    await db.commit()
    await db.refresh(idea)
    return idea


@router.get("/{idea_id}", response_model=IdeaRead)
async def get_idea(
    idea_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Idea:
    """Return one idea. 404 if it does not exist or belongs to another user."""
    return await get_owned_idea(idea_id, user_id, db)


@router.put("/{idea_id}", response_model=IdeaRead)
async def update_idea(
    idea_id: uuid.UUID,
    body: IdeaUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Idea:
    """Replace the idea (the project and source stay).

    422 if the subject or the post is not in the idea's project.
    """
    idea = await get_owned_idea(idea_id, user_id, db)
    await check_subject(body.subject_id, idea.project_id, user_id, db)
    await check_post(body.post_id, idea.project_id, user_id, db)
    for field, value in body.model_dump().items():
        setattr(idea, field, value)
    await db.commit()
    await db.refresh(idea)
    return idea


@router.delete("/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_idea(
    idea_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete an idea. The post created from it stays."""
    idea = await get_owned_idea(idea_id, user_id, db)
    await db.delete(idea)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
