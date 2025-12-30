"""add role to users

Revision ID: 0003_add_user_role
Revises: 0002_add_is_admin
Create Date: 2025-12-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_add_user_role"
down_revision = "0002_add_is_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("role", sa.String(), nullable=False, server_default=sa.text("'user'")),
        )
    op.execute("UPDATE users SET role = CASE WHEN is_admin = 1 THEN 'admin' ELSE 'user' END")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("is_admin")


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
    op.execute(
        "UPDATE users SET is_admin = CASE WHEN role IN ('admin', 'superadmin') THEN 1 ELSE 0 END",
    )
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("role")
