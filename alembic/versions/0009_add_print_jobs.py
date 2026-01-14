"""add print jobs table

Revision ID: 0009_add_print_jobs
Revises: 0008_add_printer_groups
Create Date: 2026-01-14
"""

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision = "0009_add_print_jobs"
down_revision = "0008_add_printer_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())

    if "print_jobs" not in tables:
        op.create_table(
            "print_jobs",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "job_date",
                sa.String(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("gcode_filename", sa.String(), nullable=False),
            sa.Column("printer_name", sa.String(), nullable=False),
            sa.Column("username", sa.String(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table("print_jobs")
