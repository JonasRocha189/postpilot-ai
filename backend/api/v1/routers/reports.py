import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from api.v1.routers.projects import get_owned_project
from database.db import get_db
from schemas.reports import PerformanceReport, PostPerformance
from services.performance import MIN_SAMPLE, TIMEZONE, published_post_numbers

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/performance", response_model=PerformanceReport)
async def performance_report(
    project_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PerformanceReport:
    """The project's published variations with their latest metrics (the dashboard)."""
    await get_owned_project(project_id, user_id, db)
    posts = await published_post_numbers(db, user_id, project_id)
    return PerformanceReport(
        timezone=TIMEZONE,
        min_sample=MIN_SAMPLE,
        posts=[PostPerformance.model_validate(post) for post in posts],
    )
