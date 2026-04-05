"""add days_per_week to goals

Revision ID: 1eaa9ef5b7c1
Revises: a41f03f4a6d2
Create Date: 2026-04-05 11:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "1eaa9ef5b7c1"
down_revision = "a41f03f4a6d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "goals",
        sa.Column("days_per_week", sa.Integer(), nullable=False, server_default="5"),
    )
    op.alter_column("goals", "days_per_week", server_default=None)


def downgrade() -> None:
    op.drop_column("goals", "days_per_week")
