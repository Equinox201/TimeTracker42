from fastapi import APIRouter

router = APIRouter()


@router.get("/current")
def get_goals() -> dict[str, str]:
    return {"message": "TODO: Return current goals."}


@router.put("/current")
def upsert_goals() -> dict[str, str]:
    return {"message": "TODO: Create or update goals."}
