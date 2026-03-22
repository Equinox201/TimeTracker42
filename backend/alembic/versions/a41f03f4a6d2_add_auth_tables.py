"""add auth tables

Revision ID: a41f03f4a6d2
Revises: 4ed5e1310708
Create Date: 2026-03-22 20:10:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a41f03f4a6d2"
down_revision = "4ed5e1310708"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mobile_auth_codes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_index(
        op.f("ix_mobile_auth_codes_code_hash"),
        "mobile_auth_codes",
        ["code_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_mobile_auth_codes_user_id"),
        "mobile_auth_codes",
        ["user_id"],
        unique=False,
    )

    op.create_table(
        "oauth_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scopes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "provider", name="uq_oauth_tokens_user_provider"),
    )
    op.create_index(op.f("ix_oauth_tokens_user_id"), "oauth_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_oauth_tokens_user_id"), table_name="oauth_tokens")
    op.drop_table("oauth_tokens")

    op.drop_index(op.f("ix_mobile_auth_codes_user_id"), table_name="mobile_auth_codes")
    op.drop_index(op.f("ix_mobile_auth_codes_code_hash"), table_name="mobile_auth_codes")
    op.drop_table("mobile_auth_codes")
