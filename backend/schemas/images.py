import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB

ImageContentType = Literal["image/png", "image/jpeg", "image/webp"]

EXTENSION_BY_CONTENT_TYPE: dict[str, str] = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}


class ImageUploadUrlRequest(BaseModel):
    """Body of POST /images/upload-url."""

    project_id: uuid.UUID
    content_type: ImageContentType
    size_bytes: int = Field(gt=0, le=MAX_IMAGE_BYTES)


class ImageUploadUrlResponse(BaseModel):
    """Presigned URL for the browser to PUT the file straight to S3."""

    key: str
    upload_url: str


class ImageCreate(BaseModel):
    """Body of POST /images, sent after the file is in S3."""

    model_config = ConfigDict(str_strip_whitespace=True)

    project_id: uuid.UUID
    key: str = Field(min_length=1, max_length=500)
    content_type: ImageContentType
    description: str | None = None


class ImageRead(BaseModel):
    """Response body. `url` is a temporary presigned read URL."""

    id: uuid.UUID
    project_id: uuid.UUID
    content_type: str
    description: str | None
    url: str
    created_at: datetime
    updated_at: datetime
