"""add is_admin to users

Revision ID: 0002_add_is_admin
Revises: 0001_initial
Create Date: 2025-12-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_add_is_admin"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("users", "is_admin")
