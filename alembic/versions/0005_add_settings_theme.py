"""add theme to settings

Revision ID: 0005_add_settings_theme
Revises: 0004_add_user_profile_fields
Create Date: 2025-12-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_add_settings_theme"
down_revision = "0004_add_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("settings", sa.Column("theme", sa.String(), nullable=True))
    op.execute("UPDATE settings SET theme = 'lightTheme' WHERE theme IS NULL")


def downgrade() -> None:
    op.drop_column("settings", "theme")
