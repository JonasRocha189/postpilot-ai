"""Health checks for Kubernetes probes (no authentication)."""

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import get_db

router = APIRouter(prefix="/health", tags=["health"])

# Fail fast instead of hanging the probe when the database is slow
DB_TIMEOUT_SECONDS = 2.0


class Health(BaseModel):
    """Result of a health check."""

    status: Literal["ok", "unavailable"]
    checks: dict[str, Literal["ok", "error"]] = {}


@router.get("", response_model=Health)
async def liveness() -> Health:
    """Liveness: the process is up. Does not touch the database."""
    return Health(status="ok")


@router.get(
    "/ready",
    response_model=Health,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": Health}},
)
async def readiness(response: Response, db: AsyncSession = Depends(get_db)) -> Health:
    """Readiness: the database answers. 503 otherwise."""
    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=DB_TIMEOUT_SECONDS)
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return Health(status="unavailable", checks={"database": "error"})
    return Health(status="ok", checks={"database": "ok"})
