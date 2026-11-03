import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SubjectBase(BaseModel):
    """Fields shared by the subject create and read schemas."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    target_audience: str | None = None
    voice_tone: str | None = None


class SubjectCreate(SubjectBase):
    """Body of POST /subjects."""

    project_id: uuid.UUID


class SubjectUpdate(BaseModel):
    """Body of PUT /subjects/{id}. Only the fields sent are changed."""

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


class SubjectRead(SubjectBase):
    """Response body."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
