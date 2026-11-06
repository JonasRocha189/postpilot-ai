import uuid
from typing import Self

from pydantic import AwareDatetime, BaseModel, Field, NonNegativeInt, model_validator

from database.models import Network

# One network export rarely has more than a few hundred posts
MAX_IMPORT_ROWS = 1000


class MetricsImportRow(BaseModel):
    """One CSV line, already matched to a published variation by the browser."""

    variation_id: uuid.UUID
    published_at: AwareDatetime
    impressions: NonNegativeInt
    likes: NonNegativeInt
    comments: NonNegativeInt
    shares: NonNegativeInt
    clicks: NonNegativeInt


class MetricsImportIn(BaseModel):
    """Body of POST /metrics/import: one network's export, all rows or none."""

    network: Network
    collected_at: AwareDatetime = Field(description="When the numbers were exported.")
    rows: list[MetricsImportRow] = Field(min_length=1, max_length=MAX_IMPORT_ROWS)

    @model_validator(mode="after")
    def published_before_collected(self) -> Self:
        """A post cannot have numbers before it was published."""
        for line, row in enumerate(self.rows, start=1):
            if row.published_at > self.collected_at:
                raise ValueError(f"Row {line}: published_at is after collected_at")
        return self


class MetricsImportResult(BaseModel):
    """Response of POST /metrics/import."""

    created: int
