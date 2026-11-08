"""Integration tests: the real API against a real PostgreSQL (Testcontainers).

- One container for the whole test run (starting Postgres takes a few seconds).
- The schema comes from the Alembic migrations, so the migrations are tested too.
- Every test starts with empty tables.
- Auth is replaced: the `X-Test-User` header says who is calling (default "user-a").
  The JWT itself is covered by the unit tests.
"""

from collections.abc import AsyncIterator, Iterator

import pytest
from alembic.config import Config
from fastapi import Header
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.community.postgres import PostgresContainer

from alembic import command
from api.deps import get_current_user_id
from database.config import settings
from database.db import Base, get_db, get_session_factory
from main import app


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """Start Postgres + pgvector once and apply the migrations."""
    with PostgresContainer("pgvector/pgvector:pg16", driver="asyncpg") as postgres:
        url = postgres.get_connection_url()
        # alembic/env.py reads the URL from settings
        settings.database_url = url
        command.upgrade(Config("alembic.ini"), "head")
        yield url


@pytest.fixture
def anyio_backend() -> str:
    """Run the async tests and fixtures on asyncio (the loop FastAPI uses)."""
    return "asyncio"


@pytest.fixture
async def client(database_url: str) -> AsyncIterator[AsyncClient]:
    """HTTP client for the app, wired to the test database."""
    # NullPool: no connections kept between tests (each test has its own event loop)
    engine = create_async_engine(database_url, poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def test_db() -> AsyncIterator[AsyncSession]:
        async with sessions() as session:
            yield session

    async def test_user(x_test_user: str = Header(default="user-a")) -> str:
        return x_test_user

    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides[get_current_user_id] = test_user
    # Background tasks (document processing) use the test database too
    app.dependency_overrides[get_session_factory] = lambda: sessions

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http

    app.dependency_overrides.clear()
    # Empty every table so the next test starts clean
    tables = ", ".join(table.name for table in Base.metadata.sorted_tables)
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE {tables} CASCADE"))
    await engine.dispose()
