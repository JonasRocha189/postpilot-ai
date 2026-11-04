import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

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


class PostBase(BaseModel):
    """Fields shared by the post create and read schemas."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)
    content: str | None = None
    status: PostStatus = PostStatus.DRAFT
    network: Network
    format: PostFormat
    expected_date: date | None = Field(
        default=None, description="The date the post is expected to be published."
    )
    image_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Images from the project's library, in carousel order.",
    )


class PostCreate(PostBase):
    """Body of POST /posts."""

    subject_id: uuid.UUID

    _unique_images = field_validator("image_ids")(_no_duplicates)


class PostUpdate(BaseModel):
    """Body of PUT /posts/{id}. Only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    subject_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    status: PostStatus | None = None
    network: Network | None = None
    format: PostFormat | None = None
    expected_date: date | None = Field(
        default=None, description="The date the post is expected to be published."
    )
    image_ids: list[uuid.UUID] | None = None

    _unique_images = field_validator("image_ids")(_no_duplicates)

    @field_validator("subject_id", "title", "status", "network", "format", "image_ids")
    @classmethod
    def not_null(cls, value: object) -> object:
        """Reject an explicit null (these fields may be omitted, but not cleared)."""
        if value is None:
            raise ValueError("field cannot be null")
        return value


class PostRead(PostBase):
    """Response body."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subject_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
