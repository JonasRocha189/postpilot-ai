"""The variations migration moves the existing posts' data (not only the schema)."""

import asyncio
import uuid
from typing import Any

import asyncpg  # type: ignore[import-untyped]
from alembic.config import Config

from alembic import command

BEFORE_VARIATIONS = "5d1b74d207ff"


def run(database_url: str, sql: str, *args: Any) -> list[Any]:
    """Runs one SQL statement with asyncpg (the only Postgres driver installed)."""

    async def go() -> list[Any]:
        conn = await asyncpg.connect(database_url.replace("+asyncpg", ""))
        try:
            return list(await conn.fetch(sql, *args))
        finally:
            await conn.close()

    return asyncio.run(go())


def test_each_post_becomes_a_variation_with_its_images(database_url: str) -> None:
    config = Config("alembic.ini")
    command.downgrade(config, BEFORE_VARIATIONS)
    try:
        project, subject, post, image = (uuid.uuid4() for _ in range(4))
        run(database_url, "INSERT INTO projects (id, user_id, name) VALUES ($1, 'u', 'P')", project)
        run(
            database_url,
            "INSERT INTO subjects (id, user_id, project_id, name) VALUES ($1, 'u', $2, 'S')",
            subject,
            project,
        )
        run(
            database_url,
            "INSERT INTO images (id, user_id, project_id, key, content_type)"
            " VALUES ($1, 'u', $2, 'k.png', 'image/png')",
            image,
            project,
        )
        run(
            database_url,
            "INSERT INTO posts (id, user_id, subject_id, title, content, status, network,"
            " format, expected_date)"
            " VALUES ($1, 'u', $2, 'Old post', 'Text', 'approved', 'instagram', 'single',"
            " '2026-11-20')",
            post,
            subject,
        )
        run(
            database_url,
            "INSERT INTO post_images (post_id, image_id, position) VALUES ($1, $2, 0)",
            post,
            image,
        )

        command.upgrade(config, "head")

        [variation] = run(database_url, "SELECT * FROM post_variations WHERE post_id = $1", post)
        assert variation["network"] == "instagram"
        assert variation["format"] == "single"
        assert variation["content"] == "Text"
        assert variation["status"] == "approved"
        assert str(variation["expected_date"]) == "2026-11-20"
        images = run(
            database_url,
            "SELECT image_id, position FROM variation_images WHERE variation_id = $1",
            variation["id"],
        )
        assert [(r["image_id"], r["position"]) for r in images] == [(image, 0)]
    finally:
        command.upgrade(config, "head")
        run(
            database_url,
            "TRUNCATE projects, subjects, posts, post_variations, variation_images, images CASCADE",
        )
