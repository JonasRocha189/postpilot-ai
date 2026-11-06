from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from database.db import get_db
from main import app


class FakeSession:
    """Stands in for AsyncSession: `execute` succeeds, or raises `error`."""

    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    async def execute(self, *_: Any) -> None:
        if self.error:
            raise self.error


@pytest.fixture
def client() -> Iterator[TestClient]:
    yield TestClient(app)
    app.dependency_overrides.clear()  # don't leak the fake session into other tests


def use_session(session: FakeSession) -> None:
    """Make the endpoints receive `session` instead of a real database session."""

    async def override() -> AsyncIterator[FakeSession]:
        yield session

    app.dependency_overrides[get_db] = override


def test_liveness_does_not_touch_the_database(client: TestClient) -> None:
    use_session(FakeSession(error=ConnectionError("db down")))

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {}}


def test_readiness_is_ok_when_the_database_answers(client: TestClient) -> None:
    use_session(FakeSession())

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": "ok"}}


def test_readiness_returns_503_when_the_database_fails(client: TestClient) -> None:
    use_session(FakeSession(error=ConnectionError("db down")))

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "checks": {"database": "error"}}
