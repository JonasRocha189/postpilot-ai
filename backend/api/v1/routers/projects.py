from fastapi import APIRouter

router = APIRouter()

@router.get("/projects")
async def get_projects():
    return {"message": "Projects endpoint"}
  
  

