import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from database.models import PostStatus


class PostBase(BaseModel):
    """Fields shared by the post create and read schemas."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)
    content: str | None = None
    status: PostStatus = PostStatus.DRAFT
    expected_date: date | None = Field(
        default=None, description="The date the post is expected to be published."
    )


class PostCreate(PostBase):
    """Body of POST /posts."""

    subject_id: uuid.UUID


class PostUpdate(BaseModel):
    """Body of PUT /posts/{id}. Only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    subject_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    status: PostStatus | None = None
    expected_date: date | None = Field(
        default=None, description="The date the post is expected to be published."
    )

    @field_validator("subject_id", "title", "status")
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
