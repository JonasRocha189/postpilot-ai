from fastapi import FastAPI

from api.v1.routers import images, posts, projects, subjects

app = FastAPI()
app.include_router(projects.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")
app.include_router(posts.router, prefix="/api/v1")
app.include_router(images.router, prefix="/api/v1", tags=["images"])
