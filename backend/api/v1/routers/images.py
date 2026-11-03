from fastapi import APIRouter

router = APIRouter()


@router.get("/images")
async def get_images() -> dict[str, str]:
    """Placeholder until the images CRUD is implemented."""
    return {"message": "images endpoint"}
