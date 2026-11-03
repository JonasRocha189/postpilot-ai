from fastapi import APIRouter

router = APIRouter()

@router.get("/images")
async def get_images():
    return {"message": "images endpoint"}
  
  

