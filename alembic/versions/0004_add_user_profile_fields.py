"""add user profile fields

Revision ID: 0004_add_user_profile_fields
Revises: 0003_add_user_role
Create Date: 2025-12-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_add_user_profile_fields"
down_revision = "0003_add_user_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(), nullable=True))
    op.add_column("users", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "notes")
    op.drop_column("users", "email")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
