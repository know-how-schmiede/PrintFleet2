"""add stream active flags

Revision ID: 0006_add_stream_active_flags
Revises: 0005_add_settings_theme
Create Date: 2026-01-01
"""

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision = "0006_add_stream_active_flags"
down_revision = "0005_add_settings_theme"
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

    add_column_if_missing(
        "kiosk_stream_active_1",
        sa.Column("kiosk_stream_active_1", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    add_column_if_missing(
        "kiosk_stream_active_2",
        sa.Column("kiosk_stream_active_2", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    add_column_if_missing(
        "kiosk_stream_active_3",
        sa.Column("kiosk_stream_active_3", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    add_column_if_missing(
        "kiosk_stream_active_4",
        sa.Column("kiosk_stream_active_4", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )

    for column_name in (
        "kiosk_stream_active_1",
        "kiosk_stream_active_2",
        "kiosk_stream_active_3",
        "kiosk_stream_active_4",
    ):
        if column_name in columns:
            op.execute(f"UPDATE settings SET {column_name} = 1 WHERE {column_name} IS NULL")


def downgrade() -> None:
    op.drop_column("settings", "kiosk_stream_active_4")
    op.drop_column("settings", "kiosk_stream_active_3")
    op.drop_column("settings", "kiosk_stream_active_2")
    op.drop_column("settings", "kiosk_stream_active_1")
