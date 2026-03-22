from datetime import date

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/history")
def attendance_history(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
) -> dict[str, str]:
    _ = (from_date, to_date)
    return {"message": "TODO: Return normalized attendance history."}
