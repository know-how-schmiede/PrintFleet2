from sqlalchemy import CheckConstraint, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from printfleet2.db.base import Base


class Settings(Base):
    __tablename__ = "settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_settings_singleton"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    poll_interval: Mapped[float | None] = mapped_column(Float, nullable=True)
    db_reload_interval: Mapped[float | None] = mapped_column(Float, nullable=True)
    telegram_chat_id: Mapped[str | None] = mapped_column(String, nullable=True)
    language: Mapped[str | None] = mapped_column(String, nullable=True)
    imprint_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    privacy_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    kiosk_stream_url: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_host: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_user: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_password: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_stream_layout: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_stream_url_1: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_host_1: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_user_1: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_password_1: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_stream_url_2: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_host_2: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_user_2: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_password_2: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_stream_url_3: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_host_3: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_user_3: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_password_3: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_stream_url_4: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_host_4: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_user_4: Mapped[str | None] = mapped_column(String, nullable=True)
    kiosk_camera_password_4: Mapped[str | None] = mapped_column(String, nullable=True)
