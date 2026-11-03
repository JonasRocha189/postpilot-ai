from fastapi import APIRouter

router = APIRouter()

@router.get("/subjects")
async def get_subjects():
    return {"message": "subjects endpoint"}
  
  

