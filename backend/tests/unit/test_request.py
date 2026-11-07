"""Request log middleware: request_id, user_id and one JSON line per request (no database)."""

import io
import json
import logging
import sys
from collections.abc import Callable, Iterator
from typing import Any

import pytest
import structlog
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from api.deps import get_current_user_id
from api.middleware import RequestLogMiddleware
from core.logs import configure_logging

ReadLogs = Callable[[], list[dict[str, Any]]]


@pytest.fixture
def logs(monkeypatch: pytest.MonkeyPatch) -> Iterator[ReadLogs]:
    """JSON logging into a buffer; returns a function that reads the lines written so far.

    The handler keeps the stdout it was given, so it gets a buffer of its own
    (pytest swaps sys.stdout between the phases of a test).
    """
    buffer = io.StringIO()
    monkeypatch.setattr(sys, "stdout", buffer)
    configure_logging("INFO", json=True)

    def read() -> list[dict[str, Any]]:
        lines = [json.loads(line) for line in buffer.getvalue().splitlines()]
        # The test client (httpx) logs its own line: keep only the app's
        return [line for line in lines if not line["logger"].startswith("httpx")]

    yield read
    # Back to the defaults, so other tests are not affected
    structlog.reset_defaults()
    logging.getLogger().handlers = []


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr("api.deps.settings.auth_dev_user", "user-42")
    app = FastAPI()
    app.add_middleware(RequestLogMiddleware)

    @app.get("/me")
    async def me(user_id: str = Depends(get_current_user_id)) -> dict[str, str]:
        logging.getLogger("routers").info("inside the route", extra={"image_id": "img-1"})
        return {"user_id": user_id}

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("unexpected")

    return TestClient(app, raise_server_exceptions=False)


def test_each_request_gets_an_id_returned_in_the_header(client: TestClient) -> None:
    first = client.get("/me")
    second = client.get("/me")

    assert len(first.headers["x-request-id"]) == 32
    assert first.headers["x-request-id"] != second.headers["x-request-id"]


def test_a_valid_request_id_from_the_client_is_kept(client: TestClient) -> None:
    kept = client.get("/me", headers={"X-Request-ID": "abc-123"})
    replaced = client.get("/me", headers={"X-Request-ID": "bad id with spaces"})

    assert kept.headers["x-request-id"] == "abc-123"
    assert replaced.headers["x-request-id"] != "bad id with spaces"


def test_logs_are_json_with_request_and_user(client: TestClient, logs: ReadLogs) -> None:
    response = client.get("/me", headers={"X-Request-ID": "req-1"})

    assert response.status_code == 200
    route, request = logs()
    # A standard logging call in a route: same JSON shape, with its extra fields
    assert route["event"] == "inside the route"
    assert route["image_id"] == "img-1"
    assert route["request_id"] == "req-1"
    assert route["user_id"] == "user-42"
    # The line written when the request ends
    assert request["event"] == "request"
    assert request["level"] == "info"
    assert request["method"] == "GET"
    assert request["path"] == "/me"
    assert request["status"] == 200
    assert request["request_id"] == "req-1"
    assert request["user_id"] == "user-42"
    assert isinstance(request["duration_ms"], float)
    assert "timestamp" in request


def test_an_unhandled_error_is_logged_as_500(client: TestClient, logs: ReadLogs) -> None:
    response = client.get("/boom")

    assert response.status_code == 500
    assert any(line["event"] == "request" and line["status"] == 500 for line in logs())


def test_the_token_is_never_logged(
    client: TestClient, logs: ReadLogs, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("api.deps.settings.auth_dev_user", "")

    response = client.get("/me", headers={"Authorization": "Bearer secret-token-value"})

    assert response.status_code in (401, 503)  # invalid token (or Auth0 unreachable)
    assert "secret-token-value" not in json.dumps(logs())
