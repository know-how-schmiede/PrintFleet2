"""create core tables

Revision ID: 0001_initial
Revises: 
Create Date: 2025-12-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "printers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("backend", sa.String(), nullable=False),
        sa.Column("host", sa.String(), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("https", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("no_scanning", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("token", sa.String(), nullable=True),
        sa.Column("api_key", sa.String(), nullable=True),
        sa.Column("error_report_interval", sa.Float(), nullable=False, server_default=sa.text("30.0")),
        sa.Column("tasmota_host", sa.String(), nullable=True),
        sa.Column("tasmota_topic", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("printer_type", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )

    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("poll_interval", sa.Float(), nullable=True),
        sa.Column("db_reload_interval", sa.Float(), nullable=True),
        sa.Column("telegram_chat_id", sa.String(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("imprint_markdown", sa.Text(), nullable=True),
        sa.Column("privacy_markdown", sa.Text(), nullable=True),
        sa.Column("kiosk_stream_url", sa.String(), nullable=True),
        sa.Column("kiosk_camera_host", sa.String(), nullable=True),
        sa.Column("kiosk_camera_user", sa.String(), nullable=True),
        sa.Column("kiosk_camera_password", sa.String(), nullable=True),
        sa.Column("kiosk_stream_layout", sa.String(), nullable=True),
        sa.Column("kiosk_stream_url_1", sa.String(), nullable=True),
        sa.Column("kiosk_camera_host_1", sa.String(), nullable=True),
        sa.Column("kiosk_camera_user_1", sa.String(), nullable=True),
        sa.Column("kiosk_camera_password_1", sa.String(), nullable=True),
        sa.Column("kiosk_stream_url_2", sa.String(), nullable=True),
        sa.Column("kiosk_camera_host_2", sa.String(), nullable=True),
        sa.Column("kiosk_camera_user_2", sa.String(), nullable=True),
        sa.Column("kiosk_camera_password_2", sa.String(), nullable=True),
        sa.Column("kiosk_stream_url_3", sa.String(), nullable=True),
        sa.Column("kiosk_camera_host_3", sa.String(), nullable=True),
        sa.Column("kiosk_camera_user_3", sa.String(), nullable=True),
        sa.Column("kiosk_camera_password_3", sa.String(), nullable=True),
        sa.Column("kiosk_stream_url_4", sa.String(), nullable=True),
        sa.Column("kiosk_camera_host_4", sa.String(), nullable=True),
        sa.Column("kiosk_camera_user_4", sa.String(), nullable=True),
        sa.Column("kiosk_camera_password_4", sa.String(), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_settings_singleton"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.String(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("settings")
    op.drop_table("printers")
