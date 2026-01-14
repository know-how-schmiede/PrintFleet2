"""add print_via to print jobs

Revision ID: 0010_add_print_jobs_print_via
Revises: 0009_add_print_jobs
Create Date: 2026-01-14
"""

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision = "0010_add_print_jobs_print_via"
down_revision = "0009_add_print_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    if "print_jobs" not in tables:
        return
    columns = {column["name"] for column in inspector.get_columns("print_jobs")}
    if "print_via" not in columns:
        op.add_column(
            "print_jobs",
            sa.Column(
                "print_via",
                sa.String(),
                nullable=False,
                server_default=sa.text("'unknown'"),
            ),
        )
        op.execute(
            "UPDATE print_jobs SET print_via = 'unknown' "
            "WHERE print_via IS NULL OR print_via = ''"
        )


def downgrade() -> None:
    op.drop_column("print_jobs", "print_via")
