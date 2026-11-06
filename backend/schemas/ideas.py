import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from database.models import IdeaSource, Network


class IdeaBase(BaseModel):
    """Fields shared by the idea input and read schemas."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)
    notes: str | None = None
    subject_id: uuid.UUID | None = None
    networks: list[Network] = Field(
        default_factory=list, description="Networks suggested for the post (may be empty)."
    )

    @field_validator("networks")
    @classmethod
    def unique_and_ordered(cls, value: list[Network]) -> list[Network]:
        """Each network once, in the usual order (LinkedIn, Instagram, X)."""
        order = list(Network)
        return sorted(set(value), key=order.index)


class IdeaCreate(IdeaBase):
    """Body of POST /ideas. The source is always `manual` here (the agent writes `agent`)."""

    project_id: uuid.UUID


class IdeaUpdate(IdeaBase):
    """Body of PUT /ideas/{id}: replaces the idea. The project and source do not change."""

    post_id: uuid.UUID | None = Field(
        default=None, description="The post created from this idea; null = open."
    )


class IdeaRead(IdeaBase):
    """Response body."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    source: IdeaSource
    post_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
