import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from database.models import AgentMode, RunStatus


class AgentRunCreate(BaseModel):
    """Body of POST /agent/runs."""

    model_config = ConfigDict(str_strip_whitespace=True)

    project_id: uuid.UUID
    mode: AgentMode
    request: str = Field(min_length=1, max_length=2000)


class AgentStepRead(BaseModel):
    """One tool call: the full result stays in the database and the logs."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step_number: int
    tool: str
    arguments: dict[str, Any]
    result_summary: str | None
    duration_ms: int | None
    error: str | None


class AgentRunRead(BaseModel):
    """A run and the steps saved so far (the screen polls it while running)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    mode: AgentMode
    request: str
    status: RunStatus
    response: str | None
    post_id: uuid.UUID | None
    iterations: int
    # The run starts when it is created
    started_at: datetime = Field(validation_alias="created_at")
    finished_at: datetime | None
    steps: list[AgentStepRead]
