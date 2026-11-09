from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any

from langchain.tools import ToolRuntime, tool
from sqlalchemy import exists, func, select
from sqlalchemy.dialects.postgresql import distinct_on

from ai.agent.context import AgentContext
from database.models import Metric, Post, PostVariation, Subject, VariationImage

# Below this many posts, a group says nothing (CLAUDE.md: minimum sample of 5)
MIN_SAMPLE = 5
# Weekday and hour as the brand's audience lives them (Postgres has the tz database)
TIMEZONE = "America/Sao_Paulo"
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@dataclass(frozen=True)
class PostNumbers:
    """The latest numbers of one published variation, with what describes it."""

    subject: str
    network: str
    weekday: int  # ISO: 1 = Monday
    hour: int  # 0-23, local time
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


def time_of_day(hour: int) -> str:
    """Name of the period of the day for a local hour."""
    if hour < 6:
        return "night"
    if hour < 12:
        return "morning"
    if hour < 18:
        return "afternoon"
    return "evening"


DIMENSIONS: dict[str, Callable[[PostNumbers], str]] = {
    "subject": lambda p: p.subject,
    "network": lambda p: p.network,
    "weekday": lambda p: WEEKDAYS[p.weekday - 1],
    "time_of_day": lambda p: time_of_day(p.hour),
    "image": lambda p: "with_image" if p.has_image else "text_only",
}


def averages(posts: list[PostNumbers]) -> dict[str, Any]:
    """Average impressions and engagement rate of a group."""
    return {
        "avg_impressions": round(sum(p.impressions for p in posts) / len(posts)),
        "avg_engagement_rate": round(sum(p.engagement_rate for p in posts) / len(posts), 4),
    }


def summarize(posts: Iterable[PostNumbers]) -> dict[str, Any]:
    """Aggregates per subject, network, weekday, time of day and image.

    Groups under the minimum sample show only their size, so the agent can't
    draw conclusions from them.
    """
    posts = list(posts)
    if len(posts) < MIN_SAMPLE:
        return {
            "posts_with_metrics": len(posts),
            "enough_data": False,
            "message": f"Only {len(posts)} published posts have metrics; at least "
            f"{MIN_SAMPLE} are needed. Say the data is not enough for recommendations yet.",
        }

    groups: dict[str, list[dict[str, Any]]] = {}
    for dimension, key in DIMENSIONS.items():
        buckets: dict[str, list[PostNumbers]] = defaultdict(list)
        for post in posts:
            buckets[key(post)].append(post)
        rows = []
        for value, members in buckets.items():
            enough = len(members) >= MIN_SAMPLE
            row: dict[str, Any] = {"value": value, "posts": len(members), "enough_data": enough}
            if enough:
                row.update(averages(members))
            rows.append(row)
        # Groups with enough data first, the best engagement on top
        rows.sort(key=lambda r: (not r["enough_data"], -r.get("avg_engagement_rate", 0)))
        groups[dimension] = rows

    return {
        "posts_with_metrics": len(posts),
        "enough_data": True,
        "min_sample": MIN_SAMPLE,
        "timezone": TIMEZONE,
        "overall": averages(posts),
        "groups": groups,
    }


async def analyze_performance_data(ctx: AgentContext) -> dict[str, Any]:
    """The project's published variations with their latest metrics, summarized."""
    local_time = func.timezone(TIMEZONE, Metric.published_at)
    has_image = exists().where(VariationImage.variation_id == PostVariation.id)
    query = (
        # The latest collection of each variation holds its current totals
        select(
            Subject.name,
            PostVariation.network,
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
            Subject.project_id == ctx.project_id,
            Subject.user_id == ctx.user_id,
            Metric.user_id == ctx.user_id,
        )
        .ext(distinct_on(Metric.variation_id))
        .order_by(Metric.variation_id, Metric.collected_at.desc())
    )
    async with ctx.sessions() as db:
        rows = (await db.execute(query)).all()
    return summarize(
        PostNumbers(
            subject=row[0],
            network=row[1].value,
            weekday=int(row[2]),
            hour=int(row[3]),
            has_image=bool(row[4]),
            impressions=row[5],
            likes=row[6],
            comments=row[7],
            shares=row[8],
            clicks=row[9],
        )
        for row in rows
    )


@tool
async def analyze_performance(runtime: ToolRuntime[AgentContext]) -> dict[str, Any]:
    """Summarize how the project's published posts performed.

    Average impressions and engagement rate per subject, network, weekday, time
    of day and image (with or without). Groups with fewer than 5 posts have
    enough_data = false: never draw conclusions from them.
    """
    return await analyze_performance_data(runtime.context)
