"""add printer groups

Revision ID: 0008_add_printer_groups
Revises: 0007_add_stream_titles
Create Date: 2026-01-02
"""

from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa


revision = "0008_add_printer_groups"
down_revision = "0007_add_stream_titles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())

    if "printer_groups" not in tables:
        op.create_table(
            "printer_groups",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.UniqueConstraint("name", name="uq_printer_groups_name"),
        )

    printer_columns = {column["name"] for column in inspector.get_columns("printers")}
    if "group_id" not in printer_columns:
        op.add_column("printers", sa.Column("group_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("printers", "group_id")
    op.drop_table("printer_groups")
