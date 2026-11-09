"""S3 access: presigned URLs for the browser and object checks for the API.

The database stores only object keys; URLs are generated on demand and expire.
boto3 is synchronous, so calls that hit the network run in a worker thread.
"""

import asyncio
from functools import lru_cache
from typing import TYPE_CHECKING

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from database.config import settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

UPLOAD_URL_EXPIRES = 600  # seconds the browser has to start the PUT
DOWNLOAD_URL_EXPIRES = 900  # the frontend refetches lists before this


@lru_cache
def _client() -> "S3Client":
    return boto3.client(
        "s3",
        region_name=settings.s3_region,
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        # Path-style URLs work with LocalStack and with AWS
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def presigned_upload_url(key: str, content_type: str) -> str:
    """URL for the browser to PUT the file directly (Content-Type must match)."""
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=UPLOAD_URL_EXPIRES,
    )


def presigned_download_url(key: str) -> str:
    """Temporary read URL for a private object."""
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=DOWNLOAD_URL_EXPIRES,
    )


async def object_size(key: str) -> int | None:
    """Size in bytes of the object, or None if it does not exist."""
    try:
        head = await asyncio.to_thread(_client().head_object, Bucket=settings.s3_bucket, Key=key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            return None
        raise
    return head["ContentLength"]


async def download_object(key: str) -> bytes:
    """The object's content (documents are at most a few MB)."""
    response = await asyncio.to_thread(_client().get_object, Bucket=settings.s3_bucket, Key=key)
    return await asyncio.to_thread(response["Body"].read)


async def upload_object(key: str, data: bytes, content_type: str) -> None:
    """Write an object from the backend (the images the agent generates)."""
    await asyncio.to_thread(
        _client().put_object,
        Bucket=settings.s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


async def delete_object(key: str) -> None:
    """Delete the object (S3 does not fail if it is already gone)."""
    await asyncio.to_thread(_client().delete_object, Bucket=settings.s3_bucket, Key=key)
