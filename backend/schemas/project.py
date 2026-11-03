import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    target_audience: str | None = None
    voice_tone: str | None = None


class ProjectCreate(ProjectBase):
    """Body of POST /projects."""


class ProjectUpdate(BaseModel):
    """Body of PUT /projects/{id}. Only the fields sent are changed."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    target_audience: str | None = None
    voice_tone: str | None = None


class ProjectRead(ProjectBase):
    """Response body."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
