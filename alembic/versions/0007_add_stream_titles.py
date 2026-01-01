"""add stream titles

Revision ID: 0007_add_stream_titles
Revises: 0006_add_stream_active_flags
Create Date: 2026-01-01
"""

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision = "0007_add_stream_titles"
down_revision = "0006_add_stream_active_flags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    columns = {column["name"] for column in inspector.get_columns("settings")}

    def add_column_if_missing(name: str, column: sa.Column) -> None:
        nonlocal columns
        if name in columns:
            return
        op.add_column("settings", column)
        columns.add(name)

    add_column_if_missing("kiosk_stream_title_1", sa.Column("kiosk_stream_title_1", sa.String(), nullable=True))
    add_column_if_missing("kiosk_stream_title_2", sa.Column("kiosk_stream_title_2", sa.String(), nullable=True))
    add_column_if_missing("kiosk_stream_title_3", sa.Column("kiosk_stream_title_3", sa.String(), nullable=True))
    add_column_if_missing("kiosk_stream_title_4", sa.Column("kiosk_stream_title_4", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("settings", "kiosk_stream_title_4")
    op.drop_column("settings", "kiosk_stream_title_3")
    op.drop_column("settings", "kiosk_stream_title_2")
    op.drop_column("settings", "kiosk_stream_title_1")
