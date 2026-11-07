"""Image library: presigned URLs, the S3 checks and the cleanup.

S3 is simulated in memory by moto (no network, no AWS account): the test plays
the browser by putting the object in the bucket before registering it.
"""

from collections.abc import Iterator
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

import boto3
import pytest
from httpx import AsyncClient
from moto import mock_aws

from database.config import settings
from schemas.images import MAX_IMAGE_BYTES
from storage import s3

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}
BUCKET = "postpilot-test"


@pytest.fixture
def bucket(monkeypatch: pytest.MonkeyPatch) -> Iterator["S3Client"]:
    """An empty in-memory bucket; the app's S3 client is pointed at it."""
    # Real AWS endpoints (not LocalStack from .env) are what moto intercepts
    monkeypatch.setattr(settings, "s3_endpoint_url", None)
    monkeypatch.setattr(settings, "s3_bucket", BUCKET)
    monkeypatch.setattr(settings, "s3_region", "us-east-1")
    monkeypatch.setattr(settings, "s3_access_key_id", "test")
    monkeypatch.setattr(settings, "s3_secret_access_key", "test")
    # The client is cached: build it again with the settings above
    s3._client.cache_clear()
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield client
    s3._client.cache_clear()


async def create_project(client: AsyncClient, headers: dict[str, str] | None = None) -> str:
    response = await client.post("/api/v1/projects", json={"name": "Brand"}, headers=headers)
    project_id: str = response.json()["id"]
    return project_id


async def upload_url(
    client: AsyncClient,
    project_id: str,
    content_type: str = "image/png",
    headers: dict[str, str] | None = None,
) -> Any:
    return await client.post(
        "/api/v1/images/upload-url",
        json={"project_id": project_id, "content_type": content_type, "size_bytes": 1024},
        headers=headers,
    )


async def upload_image(
    client: AsyncClient,
    bucket: "S3Client",
    project_id: str,
    body: bytes = b"png",
    **fields: Any,
) -> Any:
    """The whole flow: presigned URL, the browser's PUT, then the registration."""
    key = (await upload_url(client, project_id)).json()["key"]
    bucket.put_object(Bucket=BUCKET, Key=key, Body=body)
    return await client.post(
        "/api/v1/images",
        json={"project_id": project_id, "key": key, "content_type": "image/png", **fields},
    )


def keys(bucket: "S3Client") -> list[str]:
    return [item["Key"] for item in bucket.list_objects_v2(Bucket=BUCKET).get("Contents", [])]


# --- Upload URL ---------------------------------------------------------------


async def test_upload_url_is_in_the_project_folder(client: AsyncClient, bucket: "S3Client") -> None:
    project_id = await create_project(client)

    response = await upload_url(client, project_id, content_type="image/jpeg")

    assert response.status_code == 200
    key = response.json()["key"]
    assert key.startswith(f"users/user-a/projects/{project_id}/images/")
    assert key.endswith(".jpg")
    # A presigned PUT for that key, in the bucket, with an expiry
    url = urlparse(response.json()["upload_url"])
    assert url.path == f"/{BUCKET}/{key}"
    assert "X-Amz-Expires=600" in url.query


@pytest.mark.parametrize(
    "fields",
    [
        pytest.param({"content_type": "image/gif"}, id="unsupported-type"),
        pytest.param({"size_bytes": MAX_IMAGE_BYTES + 1}, id="too-large"),
        pytest.param({"size_bytes": 0}, id="empty"),
    ],
)
async def test_upload_url_validates_type_and_size(
    client: AsyncClient, bucket: "S3Client", fields: dict[str, Any]
) -> None:
    project_id = await create_project(client)
    body = {"project_id": project_id, "content_type": "image/png", "size_bytes": 1024}

    response = await client.post("/api/v1/images/upload-url", json={**body, **fields})

    assert response.status_code == 422


# --- Register -----------------------------------------------------------------


async def test_register_an_uploaded_image(client: AsyncClient, bucket: "S3Client") -> None:
    project_id = await create_project(client)

    response = await upload_image(client, bucket, project_id, description="Data center")

    assert response.status_code == 201
    image = response.json()
    assert image["project_id"] == project_id
    assert image["description"] == "Data center"
    assert image["content_type"] == "image/png"
    # The key never leaves the API; a temporary read URL goes instead
    assert "key" not in image
    assert "X-Amz-Expires=900" in image["url"]


async def test_list_is_per_project_newest_first(client: AsyncClient, bucket: "S3Client") -> None:
    project_id = await create_project(client)
    other_project = await create_project(client)
    await upload_image(client, bucket, project_id, description="First")
    await upload_image(client, bucket, project_id, description="Second")
    await upload_image(client, bucket, other_project, description="Elsewhere")

    response = await client.get("/api/v1/images", params={"project_id": project_id})

    assert response.status_code == 200
    assert {image["description"] for image in response.json()} == {"First", "Second"}


async def test_register_fails_when_the_file_was_not_uploaded(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    key = (await upload_url(client, project_id)).json()["key"]

    response = await client.post(
        "/api/v1/images", json={"project_id": project_id, "key": key, "content_type": "image/png"}
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Image was not uploaded"


async def test_a_file_larger_than_allowed_is_refused_and_deleted(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)

    response = await upload_image(client, bucket, project_id, body=b"x" * (MAX_IMAGE_BYTES + 1))

    assert response.status_code == 422
    assert response.json()["detail"] == "Image is too large"
    assert keys(bucket) == []


async def test_a_key_outside_the_project_folder_is_refused(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    other_project = await create_project(client)
    # Uploaded to another project's folder (it exists in S3)
    key = (await upload_url(client, other_project)).json()["key"]
    bucket.put_object(Bucket=BUCKET, Key=key, Body=b"png")

    response = await client.post(
        "/api/v1/images", json={"project_id": project_id, "key": key, "content_type": "image/png"}
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid image key"


# --- Delete -------------------------------------------------------------------


async def test_delete_removes_the_row_and_the_s3_object(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    image = (await upload_image(client, bucket, project_id)).json()
    assert len(keys(bucket)) == 1

    response = await client.delete(f"/api/v1/images/{image['id']}")

    assert response.status_code == 204
    assert keys(bucket) == []
    listed = await client.get("/api/v1/images", params={"project_id": project_id})
    assert listed.json() == []


async def test_a_project_with_images_cannot_be_deleted(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    await upload_image(client, bucket, project_id)

    response = await client.delete(f"/api/v1/projects/{project_id}")

    assert response.status_code == 409
    assert response.json()["detail"] == "Project has images"


# --- Authorization -----------------------------------------------------------


async def test_another_user_cannot_use_my_project_library(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    image = (await upload_image(client, bucket, project_id)).json()

    listed = await client.get("/api/v1/images", params={"project_id": project_id}, headers=USER_B)
    url = await upload_url(client, project_id, headers=USER_B)
    deleted = await client.delete(f"/api/v1/images/{image['id']}", headers=USER_B)

    assert listed.status_code == 404
    assert url.status_code == 404
    assert deleted.status_code == 404
    assert len(keys(bucket)) == 1  # my file is still there


async def test_another_user_cannot_register_a_file_from_my_folder(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    my_project = await create_project(client)
    my_key = (await upload_url(client, my_project)).json()["key"]
    bucket.put_object(Bucket=BUCKET, Key=my_key, Body=b"png")
    their_project = await create_project(client, headers=USER_B)

    response = await client.post(
        "/api/v1/images",
        json={"project_id": their_project, "key": my_key, "content_type": "image/png"},
        headers=USER_B,
    )

    assert response.status_code == 422
