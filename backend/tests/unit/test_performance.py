"""The performance summary the agent reads: groups, averages and the minimum sample."""

from dataclasses import replace
from typing import Any

from ai.tools.analyze_performance import MIN_SAMPLE, PostNumbers, summarize, time_of_day

BASE = PostNumbers(
    subject="Security",
    network="linkedin",
    weekday=2,  # Tuesday
    hour=9,
    has_image=False,
    impressions=1000,
    likes=40,
    comments=5,
    shares=3,
    clicks=2,
)


def group(result: dict[str, Any], dimension: str, value: str) -> dict[str, Any]:
    return next(row for row in result["groups"][dimension] if row["value"] == value)


def test_engagement_rate_is_interactions_over_impressions() -> None:
    assert BASE.engagement_rate == 0.05
    assert replace(BASE, impressions=0).engagement_rate == 0.0


def test_time_of_day_boundaries() -> None:
    assert [time_of_day(h) for h in (0, 5, 6, 11, 12, 17, 18, 23)] == [
        "night",
        "night",
        "morning",
        "morning",
        "afternoon",
        "afternoon",
        "evening",
        "evening",
    ]


def test_too_few_posts_means_no_recommendations() -> None:
    result = summarize([BASE] * (MIN_SAMPLE - 1))

    assert result["enough_data"] is False
    assert result["posts_with_metrics"] == MIN_SAMPLE - 1
    assert "groups" not in result
    assert "not enough" in result["message"]


def test_groups_under_the_minimum_show_only_their_size() -> None:
    posts = [BASE] * 5 + [replace(BASE, network="x", impressions=500)] * 2
    result = summarize(posts)

    assert result["enough_data"] is True
    linkedin = group(result, "network", "linkedin")
    assert linkedin == {
        "value": "linkedin",
        "posts": 5,
        "enough_data": True,
        "avg_impressions": 1000,
        "avg_engagement_rate": 0.05,
    }
    assert group(result, "network", "x") == {"value": "x", "posts": 2, "enough_data": False}


def test_best_groups_come_first_and_every_dimension_is_present() -> None:
    weak = [replace(BASE, weekday=5, hour=20, likes=0)] * 5  # Friday evening, 1% engagement
    strong = [replace(BASE, has_image=True)] * 5  # Tuesday morning with image, 5%
    result = summarize(weak + strong)

    assert set(result["groups"]) == {"subject", "network", "weekday", "time_of_day", "image"}
    assert [row["value"] for row in result["groups"]["weekday"]] == ["tuesday", "friday"]
    assert [row["value"] for row in result["groups"]["time_of_day"]] == ["morning", "evening"]
    assert [row["value"] for row in result["groups"]["image"]] == ["with_image", "text_only"]
    assert result["overall"] == {"avg_impressions": 1000, "avg_engagement_rate": 0.03}
