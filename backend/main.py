from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import health
from api.v1.routers import ideas, images, metrics, posts, projects, subjects
from database.config import settings

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoints.
app.include_router(health.router, prefix="/api/v1")
# API v1 endpoints
app.include_router(projects.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(posts.router, prefix="/api/v1")
app.include_router(images.router, prefix="/api/v1")
app.include_router(ideas.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
