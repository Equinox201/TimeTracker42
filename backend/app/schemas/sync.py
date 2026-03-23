from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ManualSyncResponse(BaseModel):
    sync_run_id: UUID
    status: str
    inserted_days: int
    updated_days: int
    unchanged_days: int
    started_at: datetime
    finished_at: datetime
