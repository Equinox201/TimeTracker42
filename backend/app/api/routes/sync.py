from fastapi import APIRouter

router = APIRouter()


@router.post("/manual")
def manual_sync() -> dict[str, str]:
    return {"message": "TODO: Trigger attendance sync for current user."}
