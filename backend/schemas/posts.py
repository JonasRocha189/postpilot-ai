import uuid
from datetime import date, datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from database.models import Network, PostFormat, PostStatus

# Rules per network (the frontend mirrors them in features/posts/redes.ts).
CHAR_LIMIT: dict[Network, int] = {
    Network.INSTAGRAM: 2200,
    Network.LINKEDIN: 3000,
    Network.X: 280,
}
FORMATS: dict[Network, tuple[PostFormat, ...]] = {
    Network.INSTAGRAM: (PostFormat.SINGLE, PostFormat.CAROUSEL),
    Network.LINKEDIN: (PostFormat.TEXT, PostFormat.SINGLE, PostFormat.CAROUSEL),
    Network.X: (PostFormat.TEXT, PostFormat.SINGLE, PostFormat.CAROUSEL),
}
MAX_IMAGES: dict[Network, int] = {
    Network.INSTAGRAM: 20,
    Network.LINKEDIN: 20,
    Network.X: 4,
}
# Statuses where the post must be complete (drafts may lack images)
READY_STATUSES = (PostStatus.APPROVED, PostStatus.PUBLISHED)


def post_rule_error(
    network: Network,
    post_format: PostFormat,
    image_count: int,
    content: str | None,
    status: PostStatus,
) -> str | None:
    """Why this combination is invalid, or None when it follows the network's rules."""
    if post_format not in FORMATS[network]:
        return f"Format '{post_format}' is not available on {network}"
    if content is not None and len(content) > CHAR_LIMIT[network]:
        return f"Content is longer than {CHAR_LIMIT[network]} characters for {network}"
    if post_format == PostFormat.TEXT and image_count > 0:
        return "A text post has no images"
    if post_format == PostFormat.SINGLE and image_count > 1:
        return "A single post has one image"
    if image_count > MAX_IMAGES[network]:
        return f"{network} allows at most {MAX_IMAGES[network]} images"
    if status in READY_STATUSES:
        if post_format == PostFormat.SINGLE and image_count != 1:
            return "An approved or published single post needs one image"
        if post_format == PostFormat.CAROUSEL and image_count < 2:
            return "An approved or published carousel needs at least two images"
    return None


def _no_duplicates(value: list[uuid.UUID] | None) -> list[uuid.UUID] | None:
    if value is not None and len(set(value)) != len(value):
        raise ValueError("an image can appear only once")
    return value


class VariationBase(BaseModel):
    """Fields shared by the variation input and read schemas."""

    model_config = ConfigDict(str_strip_whitespace=True)

    network: Network
    format: PostFormat
    content: str | None = None
    status: PostStatus = PostStatus.DRAFT
    expected_date: date | None = Field(
        default=None, description="The date this variation is expected to be published."
    )
    image_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Images from the project's library, in carousel order.",
    )


class VariationIn(VariationBase):
    """A variation in the body of POST and PUT /posts (matched by network)."""

    @field_validator("image_ids")
    @classmethod
    def no_duplicates(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        """An image appears at most once in a variation."""
        if len(set(value)) != len(value):
            raise ValueError("an image can appear only once")
        return value

    @model_validator(mode="after")
    def network_rules(self) -> Self:
        """The format, text and images follow the network's rules."""
        error = post_rule_error(
            self.network, self.format, len(self.image_ids), self.content, self.status
        )
        if error is not None:
            raise ValueError(error)
        return self


class VariationRead(VariationBase):
    """A variation in the response."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class PostIn(BaseModel):
    """Body of POST /posts and PUT /posts/{id}: the post and all its variations.

    PUT replaces the whole post: networks missing from `variations` have their
    variation deleted; networks that stay keep the variation id.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    subject_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    variations: list[VariationIn] = Field(min_length=1)

    @field_validator("variations")
    @classmethod
    def one_per_network(cls, value: list[VariationIn]) -> list[VariationIn]:
        """At most one variation per network."""
        networks = [v.network for v in value]
        if len(set(networks)) != len(networks):
            raise ValueError("only one variation per network")
        return value


class PostRead(BaseModel):
    """Response body: the post with its variations (LinkedIn, Instagram, X)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subject_id: uuid.UUID
    title: str
    variations: list[VariationRead]
    created_at: datetime
    updated_at: datetime
