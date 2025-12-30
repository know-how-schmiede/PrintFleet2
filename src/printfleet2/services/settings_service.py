from sqlalchemy.orm import Session

from printfleet2.models.settings import Settings


def ensure_settings_row(session: Session) -> Settings:
    settings = session.get(Settings, 1)
    if settings is None:
        settings = Settings(
            id=1,
            poll_interval=5.0,
            db_reload_interval=30.0,
            language="en",
            kiosk_stream_layout="standard",
        )
        session.add(settings)
    return settings


def settings_to_dict(settings: Settings) -> dict:
    return {
        "id": settings.id,
        "poll_interval": settings.poll_interval,
        "db_reload_interval": settings.db_reload_interval,
        "telegram_chat_id": settings.telegram_chat_id,
        "language": settings.language,
        "imprint_markdown": settings.imprint_markdown,
        "privacy_markdown": settings.privacy_markdown,
        "kiosk_stream_url": settings.kiosk_stream_url,
        "kiosk_camera_host": settings.kiosk_camera_host,
        "kiosk_camera_user": settings.kiosk_camera_user,
        "kiosk_camera_password": settings.kiosk_camera_password,
        "kiosk_stream_layout": settings.kiosk_stream_layout,
        "kiosk_stream_url_1": settings.kiosk_stream_url_1,
        "kiosk_camera_host_1": settings.kiosk_camera_host_1,
        "kiosk_camera_user_1": settings.kiosk_camera_user_1,
        "kiosk_camera_password_1": settings.kiosk_camera_password_1,
        "kiosk_stream_url_2": settings.kiosk_stream_url_2,
        "kiosk_camera_host_2": settings.kiosk_camera_host_2,
        "kiosk_camera_user_2": settings.kiosk_camera_user_2,
        "kiosk_camera_password_2": settings.kiosk_camera_password_2,
        "kiosk_stream_url_3": settings.kiosk_stream_url_3,
        "kiosk_camera_host_3": settings.kiosk_camera_host_3,
        "kiosk_camera_user_3": settings.kiosk_camera_user_3,
        "kiosk_camera_password_3": settings.kiosk_camera_password_3,
        "kiosk_stream_url_4": settings.kiosk_stream_url_4,
        "kiosk_camera_host_4": settings.kiosk_camera_host_4,
        "kiosk_camera_user_4": settings.kiosk_camera_user_4,
        "kiosk_camera_password_4": settings.kiosk_camera_password_4,
    }


def update_settings(settings: Settings, data: dict) -> Settings:
    for field in (
        "poll_interval",
        "db_reload_interval",
        "telegram_chat_id",
        "language",
        "imprint_markdown",
        "privacy_markdown",
        "kiosk_stream_url",
        "kiosk_camera_host",
        "kiosk_camera_user",
        "kiosk_camera_password",
        "kiosk_stream_layout",
        "kiosk_stream_url_1",
        "kiosk_camera_host_1",
        "kiosk_camera_user_1",
        "kiosk_camera_password_1",
        "kiosk_stream_url_2",
        "kiosk_camera_host_2",
        "kiosk_camera_user_2",
        "kiosk_camera_password_2",
        "kiosk_stream_url_3",
        "kiosk_camera_host_3",
        "kiosk_camera_user_3",
        "kiosk_camera_password_3",
        "kiosk_stream_url_4",
        "kiosk_camera_host_4",
        "kiosk_camera_user_4",
        "kiosk_camera_password_4",
    ):
        if field in data:
            setattr(settings, field, data[field])
    if "poll_interval" in data:
        settings.poll_interval = float(settings.poll_interval) if settings.poll_interval is not None else None
    if "db_reload_interval" in data:
        settings.db_reload_interval = float(settings.db_reload_interval) if settings.db_reload_interval is not None else None
    return settings
