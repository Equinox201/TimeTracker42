from fastapi import APIRouter

router = APIRouter()


@router.get("/summary")
def dashboard_summary() -> dict[str, str]:
    return {"message": "TODO: Return attendance KPIs for dashboard."}
