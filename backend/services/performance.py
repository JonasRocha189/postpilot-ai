"""The numbers of a project's published posts: read by the agent and the dashboard.

Each published variation counts once, with its latest metric collection (the
numbers are totals at collection time, so the latest one is current).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import exists, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Metric, Network, Post, PostVariation, Subject, VariationImage

# Below this many posts, a group says nothing (CLAUDE.md: minimum sample of 5)
MIN_SAMPLE = 5
# Weekday and hour as the brand's audience lives them (Postgres has the tz database)
TIMEZONE = "America/Sao_Paulo"


@dataclass(frozen=True)
class PostNumbers:
    """The latest numbers of one published variation, with what describes it."""

    variation_id: uuid.UUID
    post_id: uuid.UUID
    title: str
    subject: str
    network: Network
    published_at: datetime
    weekday: int  # ISO: 1 = Monday, in TIMEZONE
    hour: int  # 0-23, in TIMEZONE
    has_image: bool
    impressions: int
    likes: int
    comments: int
    shares: int
    clicks: int

    @property
    def engagement_rate(self) -> float:
        """Interactions ÷ impressions, the same rule as the metrics screen."""
        if self.impressions <= 0:
            return 0.0
        return (self.likes + self.comments + self.shares + self.clicks) / self.impressions


async def published_post_numbers(
    db: AsyncSession, user_id: str, project_id: uuid.UUID
) -> list[PostNumbers]:
    """Every variation of the project that has metrics, with its latest collection."""
    local_time = func.timezone(TIMEZONE, Metric.published_at)
    has_image = exists().where(VariationImage.variation_id == PostVariation.id)
    query = (
        select(
            PostVariation.id,
            Post.id,
            Post.title,
            Subject.name,
            PostVariation.network,
            Metric.published_at,
            func.extract("isodow", local_time),
            func.extract("hour", local_time),
            has_image,
            Metric.impressions,
            Metric.likes,
            Metric.comments,
            Metric.shares,
            Metric.clicks,
        )
        .join(PostVariation, PostVariation.id == Metric.variation_id)
        .join(Post, Post.id == PostVariation.post_id)
        .join(Subject, Subject.id == Post.subject_id)
        .where(
            Subject.project_id == project_id,
            Subject.user_id == user_id,
            Metric.user_id == user_id,
        )
        # The latest collection of each variation holds its current totals
        .ext(distinct_on(Metric.variation_id))
        .order_by(Metric.variation_id, Metric.collected_at.desc())
    )
    rows = (await db.execute(query)).all()
    return [
        PostNumbers(
            variation_id=row[0],
            post_id=row[1],
            title=row[2],
            subject=row[3],
            network=row[4],
            published_at=row[5],
            weekday=int(row[6]),
            hour=int(row[7]),
            has_image=bool(row[8]),
            impressions=row[9],
            likes=row[10],
            comments=row[11],
            shares=row[12],
            clicks=row[13],
        )
        for row in rows
    ]
