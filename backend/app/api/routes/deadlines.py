from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.deadline import Deadline
from app.models.user import User
from app.schemas.deadlines import DeadlineCreateRequest, DeadlineResponse, DeadlineUpdateRequest

router = APIRouter()


@router.get("", response_model=list[DeadlineResponse])
def list_deadlines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DeadlineResponse]:
    deadlines = db.scalars(
        select(Deadline)
        .where(Deadline.user_id == current_user.id)
        .order_by(Deadline.target_date.asc())
    ).all()
    return [DeadlineResponse.model_validate(deadline) for deadline in deadlines]


@router.post("", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
def create_deadline(
    payload: DeadlineCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeadlineResponse:
    deadline = Deadline(
        user_id=current_user.id,
        title=payload.title,
        target_date=payload.target_date,
        target_hours=payload.target_hours,
        notes=payload.notes,
        is_completed=False,
    )
    db.add(deadline)
    db.commit()
    db.refresh(deadline)
    return DeadlineResponse.model_validate(deadline)


@router.put("/{deadline_id}", response_model=DeadlineResponse)
def update_deadline(
    deadline_id: UUID,
    payload: DeadlineUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DeadlineResponse:
    deadline = db.scalar(
        select(Deadline).where(
            Deadline.id == deadline_id,
            Deadline.user_id == current_user.id,
        )
    )

    if deadline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline not found")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        setattr(deadline, field_name, value)

    db.commit()
    db.refresh(deadline)
    return DeadlineResponse.model_validate(deadline)


@router.delete("/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deadline(
    deadline_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    deadline = db.scalar(
        select(Deadline).where(
            Deadline.id == deadline_id,
            Deadline.user_id == current_user.id,
        )
    )

    if deadline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deadline not found")

    db.delete(deadline)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
