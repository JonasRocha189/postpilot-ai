from collections import defaultdict
from collections.abc import Callable, Iterable
from typing import Any

from langchain.tools import ToolRuntime, tool

from ai.agent.context import AgentContext
from services.performance import MIN_SAMPLE, TIMEZONE, PostNumbers, published_post_numbers

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


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
    async with ctx.sessions() as db:
        posts = await published_post_numbers(db, ctx.user_id, ctx.project_id)
    return summarize(posts)


@tool
async def analyze_performance(runtime: ToolRuntime[AgentContext]) -> dict[str, Any]:
    """Summarize how the project's published posts performed.

    Average impressions and engagement rate per subject, network, weekday, time
    of day and image (with or without). Groups with fewer than 5 posts have
    enough_data = false: never draw conclusions from them.
    """
    return await analyze_performance_data(runtime.context)
