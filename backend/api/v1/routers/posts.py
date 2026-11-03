from fastapi import APIRouter

router = APIRouter()

@router.get("/posts")
async def get_posts():
    return {"message": "posts endpoint"}
  
  

