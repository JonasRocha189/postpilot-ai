"""Documents for the RAG: upload URL, background processing, list and delete.

S3 is simulated by moto and the embeddings by LangChain's deterministic fake
(no network, no OpenAI). The test plays the browser by putting the file in the
bucket before asking for processing. The background task finishes before the
test client returns, so its result can be checked right after.
"""

from collections.abc import Iterator
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

import boto3
import pytest
from httpx import AsyncClient
from moto import mock_aws

from api.v1.routers.documents import require_embeddings
from database.config import settings
from main import app
from storage import s3
from tests.fakes import FakeEmbeddings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

pytestmark = pytest.mark.anyio

USER_B = {"X-Test-User": "user-b"}
BUCKET = "postpilot-test"
# About 5,000 characters: several chunks
TEXT = "Checklist de segurança.\n\n" + "Faça backup todos os dias. " * 180


@pytest.fixture
def bucket(monkeypatch: pytest.MonkeyPatch) -> Iterator["S3Client"]:
    """An empty in-memory bucket; the app's S3 client is pointed at it."""
    monkeypatch.setattr(settings, "s3_endpoint_url", None)
    monkeypatch.setattr(settings, "s3_bucket", BUCKET)
    monkeypatch.setattr(settings, "s3_region", "us-east-1")
    monkeypatch.setattr(settings, "s3_access_key_id", "test")
    monkeypatch.setattr(settings, "s3_secret_access_key", "test")
    s3._client.cache_clear()
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield client
    s3._client.cache_clear()


@pytest.fixture(autouse=True)
def fake_embeddings(client: AsyncClient) -> None:
    """Deterministic vectors of the configured size instead of the OpenAI API."""
    fake = FakeEmbeddings(size=settings.embedding_dimensions)
    app.dependency_overrides[require_embeddings] = lambda: fake


async def create_project(client: AsyncClient, headers: dict[str, str] | None = None) -> str:
    response = await client.post("/api/v1/projects", json={"name": "Brand"}, headers=headers)
    project_id: str = response.json()["id"]
    return project_id


async def upload_url(client: AsyncClient, project_id: str, **fields: Any) -> Any:
    body = {"project_id": project_id, "name": "guide.txt", "type": "txt", "size_bytes": 1024}
    return await client.post("/api/v1/documents/upload-url", json={**body, **fields})


def key_of(response: Any) -> str:
    """The S3 key, read from the presigned URL (path-style: /bucket/key)."""
    url = str(response.json()["upload_url"])
    return urlparse(url).path.removeprefix(f"/{BUCKET}/")


async def upload(
    client: AsyncClient,
    bucket: "S3Client",
    project_id: str,
    body: bytes = TEXT.encode(),
    **fields: Any,
) -> dict[str, Any]:
    """Create the document and PUT the file in S3, as the browser does."""
    response = await upload_url(client, project_id, **fields)
    bucket.put_object(Bucket=BUCKET, Key=key_of(response), Body=body)
    document: dict[str, Any] = response.json()["document"]
    return document


async def get_document(client: AsyncClient, project_id: str, document_id: str) -> dict[str, Any]:
    response = await client.get("/api/v1/documents", params={"project_id": project_id})
    return next(doc for doc in response.json() if doc["id"] == document_id)


def keys(bucket: "S3Client") -> list[str]:
    return [item["Key"] for item in bucket.list_objects_v2(Bucket=BUCKET).get("Contents", [])]


# --- Upload URL ---------------------------------------------------------------


async def test_upload_url_creates_a_pending_document(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)

    response = await upload_url(client, project_id, name="  briefing.pdf ", type="pdf")

    assert response.status_code == 200
    document = response.json()["document"]
    assert document["name"] == "briefing.pdf"
    assert document["type"] == "pdf"
    assert document["status"] == "pending"
    assert document["chunk_count"] is None
    key = key_of(response)
    assert key.startswith(f"users/user-a/projects/{project_id}/documents/")
    assert key.endswith(".pdf")
    assert "X-Amz-Expires=600" in urlparse(response.json()["upload_url"]).query


@pytest.mark.parametrize(
    "fields",
    [
        pytest.param({"type": "png"}, id="unsupported-type"),
        pytest.param({"size_bytes": 10 * 1024 * 1024 + 1}, id="too-large"),
        pytest.param({"size_bytes": 0}, id="empty"),
        pytest.param({"name": " "}, id="no-name"),
    ],
)
async def test_upload_url_validates_the_file(
    client: AsyncClient, bucket: "S3Client", fields: dict[str, Any]
) -> None:
    project_id = await create_project(client)

    assert (await upload_url(client, project_id, **fields)).status_code == 422


# --- Processing ---------------------------------------------------------------


async def test_processing_indexes_the_text(client: AsyncClient, bucket: "S3Client") -> None:
    project_id = await create_project(client)
    document = await upload(client, bucket, project_id)

    response = await client.post(f"/api/v1/documents/{document['id']}/process")

    # Answers at once; the background task then finishes the job
    assert response.status_code == 202
    assert response.json()["status"] == "processing"
    processed = await get_document(client, project_id, document["id"])
    assert processed["status"] == "ready"
    assert processed["chunk_count"] > 1
    assert processed["error_message"] is None


async def test_processing_again_replaces_the_chunks(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    document = await upload(client, bucket, project_id)
    await client.post(f"/api/v1/documents/{document['id']}/process")
    first = await get_document(client, project_id, document["id"])

    await client.post(f"/api/v1/documents/{document['id']}/process")

    assert (await get_document(client, project_id, document["id"]))["chunk_count"] == first[
        "chunk_count"
    ]


async def test_a_file_without_text_ends_in_error(client: AsyncClient, bucket: "S3Client") -> None:
    project_id = await create_project(client)
    document = await upload(client, bucket, project_id, body=b"not a pdf", type="pdf")

    await client.post(f"/api/v1/documents/{document['id']}/process")

    processed = await get_document(client, project_id, document["id"])
    assert processed["status"] == "error"
    assert processed["error_message"] == "Could not read the PDF file"
    assert processed["chunk_count"] is None


async def test_processing_needs_the_uploaded_file(client: AsyncClient, bucket: "S3Client") -> None:
    project_id = await create_project(client)
    document = (await upload_url(client, project_id)).json()["document"]

    response = await client.post(f"/api/v1/documents/{document['id']}/process")

    assert response.status_code == 422
    assert response.json()["detail"] == "Document was not uploaded"
    assert (await get_document(client, project_id, document["id"]))["status"] == "pending"


async def test_a_file_larger_than_allowed_is_deleted(
    client: AsyncClient, bucket: "S3Client", monkeypatch: pytest.MonkeyPatch
) -> None:
    project_id = await create_project(client)
    document = await upload(client, bucket, project_id)
    # The browser declared 1 KB but sent more than the limit
    monkeypatch.setattr(settings, "document_max_bytes", 100)

    response = await client.post(f"/api/v1/documents/{document['id']}/process")

    assert response.status_code == 422
    assert response.json()["detail"] == "Document is too large"
    assert keys(bucket) == []


async def test_processing_without_the_openai_key_is_503(
    client: AsyncClient, bucket: "S3Client", monkeypatch: pytest.MonkeyPatch
) -> None:
    del app.dependency_overrides[require_embeddings]
    monkeypatch.setattr(settings, "openai_api_key", "")
    from ai import models

    models.get_embeddings.cache_clear()
    project_id = await create_project(client)
    document = await upload(client, bucket, project_id)

    response = await client.post(f"/api/v1/documents/{document['id']}/process")

    assert response.status_code == 503
    models.get_embeddings.cache_clear()


# --- List and delete ----------------------------------------------------------


async def test_list_is_newest_first(client: AsyncClient, bucket: "S3Client") -> None:
    project_id = await create_project(client)
    first = (await upload_url(client, project_id, name="first.txt")).json()["document"]
    second = (await upload_url(client, project_id, name="second.txt")).json()["document"]

    response = await client.get("/api/v1/documents", params={"project_id": project_id})

    assert [doc["id"] for doc in response.json()] == [second["id"], first["id"]]


async def test_delete_removes_the_document_and_the_file(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    document = await upload(client, bucket, project_id)
    await client.post(f"/api/v1/documents/{document['id']}/process")

    response = await client.delete(f"/api/v1/documents/{document['id']}")

    assert response.status_code == 204
    assert keys(bucket) == []
    listed = await client.get("/api/v1/documents", params={"project_id": project_id})
    assert listed.json() == []


async def test_a_project_with_documents_cannot_be_deleted(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    await upload_url(client, project_id)

    response = await client.delete(f"/api/v1/projects/{project_id}")

    assert response.status_code == 409
    assert response.json()["detail"] == "Project has documents"


# --- Authorization ------------------------------------------------------------


async def test_another_user_cannot_see_or_change_the_documents(
    client: AsyncClient, bucket: "S3Client"
) -> None:
    project_id = await create_project(client)
    document = await upload(client, bucket, project_id)
    doc_url = f"/api/v1/documents/{document['id']}"

    listed = await client.get(
        "/api/v1/documents", params={"project_id": project_id}, headers=USER_B
    )
    processed = await client.post(f"{doc_url}/process", headers=USER_B)
    deleted = await client.delete(doc_url, headers=USER_B)
    created = await client.post(
        "/api/v1/documents/upload-url",
        json={"project_id": project_id, "name": "x.txt", "type": "txt", "size_bytes": 10},
        headers=USER_B,
    )

    assert [listed.status_code, processed.status_code, deleted.status_code] == [404, 404, 404]
    assert created.status_code == 404
    assert (await get_document(client, project_id, document["id"]))["status"] == "pending"
