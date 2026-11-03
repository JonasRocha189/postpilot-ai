import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from database.db import get_db
from database.models import Post, Subject
from schemas.subjects import SubjectCreate, SubjectRead, SubjectUpdate

router = APIRouter(prefix="/subjects", tags=["subjects"])


async def get_owned_subject(subject_id: uuid.UUID, user_id: str, db: AsyncSession) -> Subject:
    """Return the subject if it belongs to the user, otherwise 404."""
    subject = await db.scalar(
        select(Subject).where(Subject.id == subject_id, Subject.user_id == user_id)
    )
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject


@router.get("", response_model=list[SubjectRead])
async def list_subjects(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Subject]:
    """List the subjects of one of the user's projects, ordered by name."""
    await get_owned_project(project_id, user_id, db)
    result = await db.scalars(
        select(Subject)
        .where(Subject.project_id == project_id, Subject.user_id == user_id)
        .order_by(Subject.name)
    )
    return list(result)


@router.post("", response_model=SubjectRead, status_code=status.HTTP_201_CREATED)
async def create_subject(
    body: SubjectCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    """Create a subject in one of the user's projects. 404 if the project is not theirs."""
    await get_owned_project(body.project_id, user_id, db)
    subject = Subject(**body.model_dump(), user_id=user_id)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.get("/{subject_id}", response_model=SubjectRead)
async def get_subject(
    subject_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    """Return one subject. 404 if it does not exist or belongs to another user."""
    return await get_owned_subject(subject_id, user_id, db)


@router.put("/{subject_id}", response_model=SubjectRead)
async def update_subject(
    subject_id: uuid.UUID,
    body: SubjectUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Subject:
    """Partially update a subject: only the fields sent in the body are changed."""
    subject = await get_owned_subject(subject_id, user_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    await db.commit()
    await db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a subject. 409 if it still has posts."""
    subject = await get_owned_subject(subject_id, user_id, db)
    has_posts = await db.scalar(select(Post.id).where(Post.subject_id == subject.id).limit(1))
    if has_posts is not None:
        raise HTTPException(status_code=409, detail="Subject has posts")
    await db.delete(subject)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
