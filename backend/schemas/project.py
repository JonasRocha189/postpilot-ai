import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProjectBase(BaseModel):
    """Fields shared by the project create and read schemas."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    target_audience: str | None = None
    voice_tone: str | None = None


class ProjectCreate(ProjectBase):
    """Body of POST /projects."""


class ProjectUpdate(BaseModel):
    """Body of PUT /projects/{id}. Only the fields sent are changed."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    target_audience: str | None = None
    voice_tone: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_null(cls, value: str | None) -> str:
        """Reject an explicit null name (the field may be omitted, but not cleared)."""
        if value is None:
            raise ValueError("name cannot be null")
        return value


class ProjectRead(ProjectBase):
    """Response body."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
