"""Network rules of a post variation and of the metrics import (pure validation, no API)."""

from typing import Any

import pytest
from pydantic import ValidationError

from database.models import Network, PostFormat, PostStatus
from schemas.metrics import MetricsImportIn
from schemas.posts import PostIn, VariationIn, post_rule_error

SUBJECT_ID = "6f1c2a8e-4b1e-4c6a-9d3e-2f7a1b0c9d8e"
IMAGE_IDS = [
    "0b6b6c2e-1f2a-4c1b-8a3e-5d4c3b2a1f00",
    "0b6b6c2e-1f2a-4c1b-8a3e-5d4c3b2a1f01",
    "0b6b6c2e-1f2a-4c1b-8a3e-5d4c3b2a1f02",
    "0b6b6c2e-1f2a-4c1b-8a3e-5d4c3b2a1f03",
    "0b6b6c2e-1f2a-4c1b-8a3e-5d4c3b2a1f04",
]


@pytest.mark.parametrize(
    ("network", "post_format", "images", "content", "status", "error"),
    [
        # Valid combinations
        (Network.LINKEDIN, PostFormat.TEXT, 0, "a" * 3000, PostStatus.PUBLISHED, None),
        (Network.X, PostFormat.TEXT, 0, "a" * 280, PostStatus.DRAFT, None),
        (Network.INSTAGRAM, PostFormat.SINGLE, 0, None, PostStatus.DRAFT, None),
        (Network.X, PostFormat.CAROUSEL, 4, None, PostStatus.APPROVED, None),
        # Format not offered by the network
        (Network.INSTAGRAM, PostFormat.TEXT, 0, None, PostStatus.DRAFT, "not available"),
        # Text limit per network
        (Network.X, PostFormat.TEXT, 0, "a" * 281, PostStatus.DRAFT, "longer than 280"),
        (Network.INSTAGRAM, PostFormat.SINGLE, 0, "a" * 2201, PostStatus.DRAFT, "2200"),
        (Network.LINKEDIN, PostFormat.TEXT, 0, "a" * 3001, PostStatus.DRAFT, "3000"),
        # Images per format and per network
        (Network.LINKEDIN, PostFormat.TEXT, 1, None, PostStatus.DRAFT, "no images"),
        (Network.LINKEDIN, PostFormat.SINGLE, 2, None, PostStatus.DRAFT, "one image"),
        (Network.X, PostFormat.CAROUSEL, 5, None, PostStatus.DRAFT, "at most 4"),
        # A draft may be incomplete; approved or published may not
        (Network.LINKEDIN, PostFormat.CAROUSEL, 1, None, PostStatus.DRAFT, None),
        (Network.LINKEDIN, PostFormat.CAROUSEL, 1, None, PostStatus.APPROVED, "two images"),
        (Network.INSTAGRAM, PostFormat.SINGLE, 0, None, PostStatus.PUBLISHED, "needs one"),
    ],
)
def test_post_rule_error(
    network: Network,
    post_format: PostFormat,
    images: int,
    content: str | None,
    status: PostStatus,
    error: str | None,
) -> None:
    result = post_rule_error(network, post_format, images, content, status)

    if error is None:
        assert result is None
    else:
        assert result is not None
        assert error in result


def test_a_variation_checks_its_own_network_rules() -> None:
    with pytest.raises(ValidationError, match="longer than 280"):
        VariationIn(network=Network.X, format=PostFormat.TEXT, content="a" * 281)


def test_a_variation_cannot_repeat_an_image() -> None:
    with pytest.raises(ValidationError, match="only once"):
        VariationIn.model_validate(
            {"network": "x", "format": "carousel", "image_ids": [IMAGE_IDS[0], IMAGE_IDS[0]]}
        )


def test_content_is_trimmed_before_the_limit_is_checked() -> None:
    variation = VariationIn(network=Network.X, format=PostFormat.TEXT, content=f"  {'a' * 280}  ")

    assert variation.content == "a" * 280


def post(**fields: Any) -> dict[str, Any]:
    return {"subject_id": SUBJECT_ID, "title": "Post", **fields}


def test_a_post_needs_at_least_one_variation() -> None:
    with pytest.raises(ValidationError, match="at least 1"):
        PostIn.model_validate(post(variations=[]))


def test_a_post_has_at_most_one_variation_per_network() -> None:
    same = {"network": "linkedin", "format": "text"}

    with pytest.raises(ValidationError, match="one variation per network"):
        PostIn.model_validate(post(variations=[same, same]))


def test_the_status_defaults_to_draft() -> None:
    created = PostIn.model_validate(post(variations=[{"network": "x", "format": "text"}]))

    assert created.variations[0].status == PostStatus.DRAFT
    assert created.variations[0].image_ids == []


# --- Metrics import -------------------------------------------------------------


def metrics_row(**fields: Any) -> dict[str, Any]:
    return {
        "variation_id": IMAGE_IDS[0],
        "published_at": "2026-11-02T12:00:00Z",
        "impressions": 100,
        "likes": 1,
        "comments": 0,
        "shares": 0,
        "clicks": 0,
        **fields,
    }


def metrics(*rows: dict[str, Any], collected_at: str = "2026-11-06T12:00:00Z") -> Any:
    return {"network": "linkedin", "collected_at": collected_at, "rows": list(rows)}


def test_metrics_published_on_the_collection_day_are_valid() -> None:
    body = MetricsImportIn.model_validate(metrics(metrics_row(published_at="2026-11-06T12:00:00Z")))

    assert len(body.rows) == 1


def test_metrics_name_the_row_published_after_the_collection() -> None:
    with pytest.raises(ValidationError, match="Row 2: published_at is after collected_at"):
        MetricsImportIn.model_validate(
            metrics(metrics_row(), metrics_row(published_at="2026-11-07T12:00:00Z"))
        )


@pytest.mark.parametrize(
    "fields",
    [
        pytest.param({"shares": -1}, id="negative"),
        pytest.param({"published_at": "2026-11-02T12:00:00"}, id="no-timezone"),
        pytest.param({"clicks": 1.5}, id="not-an-integer"),
    ],
)
def test_metrics_reject_invalid_numbers_and_dates(fields: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        MetricsImportIn.model_validate(metrics(metrics_row(**fields)))


def test_metrics_limit_the_rows_per_import() -> None:
    with pytest.raises(ValidationError):
        MetricsImportIn.model_validate(metrics(*[metrics_row()] * 1001))
