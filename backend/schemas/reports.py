import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from database.models import Network


class PostPerformance(BaseModel):
    """The latest numbers of one published variation."""

    model_config = ConfigDict(from_attributes=True)

    variation_id: uuid.UUID
    post_id: uuid.UUID
    title: str
    subject: str
    network: Network
    published_at: datetime
    # In the report's time zone: ISO weekday (1 = Monday) and hour (0-23)
    weekday: int
    hour: int
    has_image: bool
    impressions: int
    likes: int
    comments: int
    shares: int
    clicks: int


class PerformanceReport(BaseModel):
    """Body of GET /reports/performance: the frontend groups the posts per chart."""

    timezone: str
    # Groups with fewer posts than this support no conclusion
    min_sample: int
    posts: list[PostPerformance]
