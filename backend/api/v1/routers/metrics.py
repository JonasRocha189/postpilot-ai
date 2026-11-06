from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user_id
from database.db import get_db
from database.models import Metric, Post, PostStatus, PostVariation
from schemas.metrics import MetricsImportIn, MetricsImportResult

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("/import", response_model=MetricsImportResult, status_code=status.HTTP_201_CREATED)
async def import_metrics(
    body: MetricsImportIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> MetricsImportResult:
    """Save one network's export: one metric per row, all with the body's collected_at.

    All or nothing: 422 (and nothing saved) if any row points to a variation that
    is not the user's, not on this network or not published.
    """
    variation_ids = {row.variation_id for row in body.rows}
    # One query for every row: only the user's published variations on this network
    valid = set(
        await db.scalars(
            select(PostVariation.id)
            .join(Post)
            .where(
                PostVariation.id.in_(variation_ids),
                Post.user_id == user_id,
                PostVariation.network == body.network,
                PostVariation.status == PostStatus.PUBLISHED,
            )
        )
    )
    for line, row in enumerate(body.rows, start=1):
        if row.variation_id not in valid:
            raise HTTPException(
                status_code=422,
                detail=f"Row {line}: variation is not a published {body.network} post",
            )

    db.add_all(
        Metric(user_id=user_id, collected_at=body.collected_at, **row.model_dump())
        for row in body.rows
    )
    await db.commit()
    return MetricsImportResult(created=len(body.rows))
