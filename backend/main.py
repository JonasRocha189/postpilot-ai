from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import health
from api.middleware import RequestLogMiddleware
from api.v1.routers import ideas, images, metrics, posts, projects, subjects
from core.logs import configure_logging
from database.config import settings

configure_logging(settings.log_level, settings.log_json)

# Docs under /api: in production only /api/* reaches the backend (Vercel rewrite)
app = FastAPI(
    title="PostPilot API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
# Added last = outermost: the request log also covers CORS answers
app.add_middleware(RequestLogMiddleware)

# Health check endpoints.
app.include_router(health.router, prefix="/api/v1")
# API v1 endpoints
app.include_router(projects.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(posts.router, prefix="/api/v1")
app.include_router(images.router, prefix="/api/v1")
app.include_router(ideas.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
