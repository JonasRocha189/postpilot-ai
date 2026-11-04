import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from database.db import get_db
from database.models import Image, Project, Subject
from schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


async def get_owned_project(project_id: uuid.UUID, user_id: str, db: AsyncSession) -> Project:
    """Return the project if it belongs to the user, otherwise 404."""
    project = await db.scalar(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Project]:
    """List the current user's projects, ordered by name."""
    result = await db.scalars(
        select(Project).where(Project.user_id == user_id).order_by(Project.name)
    )
    return list(result)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Create a project owned by the current user."""
    project = Project(**body.model_dump(), user_id=user_id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Return one project. 404 if it does not exist or belongs to another user."""
    return await get_owned_project(project_id, user_id, db)


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """Partially update a project: only the fields sent in the body are changed."""
    project = await get_owned_project(project_id, user_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a project. 409 if it still has subjects or images."""
    project = await get_owned_project(project_id, user_id, db)
    has_subjects = await db.scalar(
        select(Subject.id).where(Subject.project_id == project.id).limit(1)
    )
    if has_subjects is not None:
        raise HTTPException(status_code=409, detail="Project has subjects")
    has_images = await db.scalar(select(Image.id).where(Image.project_id == project.id).limit(1))
    if has_images is not None:
        raise HTTPException(status_code=409, detail="Project has images")
    await db.delete(project)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
