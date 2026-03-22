from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_deadlines() -> dict[str, str]:
    return {"message": "TODO: List deadlines."}


@router.post("")
def create_deadline() -> dict[str, str]:
    return {"message": "TODO: Create deadline."}


@router.put("/{deadline_id}")
def update_deadline(deadline_id: str) -> dict[str, str]:
    _ = deadline_id
    return {"message": "TODO: Update deadline."}


@router.delete("/{deadline_id}")
def delete_deadline(deadline_id: str) -> dict[str, str]:
    _ = deadline_id
    return {"message": "TODO: Delete deadline."}
