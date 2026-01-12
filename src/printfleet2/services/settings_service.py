from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from printfleet2.models.settings import Settings


def ensure_settings_schema(session: Session) -> None:
    engine = session.get_bind()
    inspector = inspect(engine)
    try:
        columns = {column["name"] for column in inspector.get_columns("settings")}
    except Exception:
        return
    missing = {}
    if "live_wall_printer_columns" not in columns:
        missing["live_wall_printer_columns"] = "INTEGER"
    if "live_wall_printer_data" not in columns:
        missing["live_wall_printer_data"] = "TEXT"
    if "live_wall_plug_poll_interval" not in columns:
        missing["live_wall_plug_poll_interval"] = "REAL"
    if "filename_display_length" not in columns:
        missing["filename_display_length"] = "INTEGER"
    if "kiosk_stream_active_1" not in columns:
        missing["kiosk_stream_active_1"] = "INTEGER DEFAULT 1"
    if "kiosk_stream_active_2" not in columns:
        missing["kiosk_stream_active_2"] = "INTEGER DEFAULT 1"
    if "kiosk_stream_active_3" not in columns:
        missing["kiosk_stream_active_3"] = "INTEGER DEFAULT 1"
    if "kiosk_stream_active_4" not in columns:
        missing["kiosk_stream_active_4"] = "INTEGER DEFAULT 1"
    if "kiosk_stream_title_1" not in columns:
        missing["kiosk_stream_title_1"] = "TEXT"
    if "kiosk_stream_title_2" not in columns:
        missing["kiosk_stream_title_2"] = "TEXT"
    if "kiosk_stream_title_3" not in columns:
        missing["kiosk_stream_title_3"] = "TEXT"
    if "kiosk_stream_title_4" not in columns:
        missing["kiosk_stream_title_4"] = "TEXT"
    if not missing:
        return
    try:
        with engine.begin() as conn:
            for column_name, column_type in missing.items():
                conn.execute(text(f"ALTER TABLE settings ADD COLUMN {column_name} {column_type}"))
            if "live_wall_plug_poll_interval" in missing:
                conn.execute(text("UPDATE settings SET live_wall_plug_poll_interval = 5.0"))
            if "filename_display_length" in missing:
                conn.execute(text("UPDATE settings SET filename_display_length = 32"))
            for active_column in (
                "kiosk_stream_active_1",
                "kiosk_stream_active_2",
                "kiosk_stream_active_3",
                "kiosk_stream_active_4",
            ):
                if active_column in missing:
                    conn.execute(text(f"UPDATE settings SET {active_column} = 1"))
    except Exception:
        return


def normalize_printer_columns(value: object | None) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return min(5, max(1, parsed))


def normalize_printer_data(value: object | None) -> str:
    if value is None:
        return "normal"
    candidate = str(value).strip().lower()
    if candidate in {"light", "normal", "all"}:
        return candidate
    return "normal"


def normalize_plug_poll_interval(value: object | None) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 1:
        return 1.0
    if parsed > 300:
        return 300.0
    return parsed


def normalize_filename_display_length(value: object | None) -> int:
    if value is None:
        return 32
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 32
    if parsed < 10:
        return 10
    if parsed > 120:
        return 120
    return parsed


def normalize_stream_active(value: object | None, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def ensure_settings_row(session: Session) -> Settings:
    ensure_settings_schema(session)
    settings = session.get(Settings, 1)
    if settings is None:
        settings = Settings(
            id=1,
            poll_interval=5.0,
            db_reload_interval=30.0,
            filename_display_length=32,
            language="en",
            theme="lightTheme",
            kiosk_stream_layout="standard",
            live_wall_printer_columns=3,
            live_wall_printer_data="normal",
            live_wall_plug_poll_interval=5.0,
            kiosk_stream_active_1=True,
            kiosk_stream_active_2=True,
            kiosk_stream_active_3=True,
            kiosk_stream_active_4=True,
        )
        session.add(settings)
    return settings


def settings_to_dict(settings: Settings) -> dict:
    return {
        "id": settings.id,
        "poll_interval": settings.poll_interval,
        "db_reload_interval": settings.db_reload_interval,
        "filename_display_length": settings.filename_display_length,
        "telegram_chat_id": settings.telegram_chat_id,
        "language": settings.language,
        "theme": settings.theme,
        "imprint_markdown": settings.imprint_markdown,
        "privacy_markdown": settings.privacy_markdown,
        "kiosk_stream_url": settings.kiosk_stream_url,
        "kiosk_camera_host": settings.kiosk_camera_host,
        "kiosk_camera_user": settings.kiosk_camera_user,
        "kiosk_camera_password": settings.kiosk_camera_password,
        "kiosk_stream_layout": settings.kiosk_stream_layout,
        "live_wall_printer_columns": settings.live_wall_printer_columns,
        "live_wall_printer_data": settings.live_wall_printer_data,
        "live_wall_plug_poll_interval": settings.live_wall_plug_poll_interval,
        "kiosk_stream_url_1": settings.kiosk_stream_url_1,
        "kiosk_camera_host_1": settings.kiosk_camera_host_1,
        "kiosk_camera_user_1": settings.kiosk_camera_user_1,
        "kiosk_camera_password_1": settings.kiosk_camera_password_1,
        "kiosk_stream_active_1": normalize_stream_active(settings.kiosk_stream_active_1, default=True),
        "kiosk_stream_title_1": settings.kiosk_stream_title_1,
        "kiosk_stream_url_2": settings.kiosk_stream_url_2,
        "kiosk_camera_host_2": settings.kiosk_camera_host_2,
        "kiosk_camera_user_2": settings.kiosk_camera_user_2,
        "kiosk_camera_password_2": settings.kiosk_camera_password_2,
        "kiosk_stream_active_2": normalize_stream_active(settings.kiosk_stream_active_2, default=True),
        "kiosk_stream_title_2": settings.kiosk_stream_title_2,
        "kiosk_stream_url_3": settings.kiosk_stream_url_3,
        "kiosk_camera_host_3": settings.kiosk_camera_host_3,
        "kiosk_camera_user_3": settings.kiosk_camera_user_3,
        "kiosk_camera_password_3": settings.kiosk_camera_password_3,
        "kiosk_stream_active_3": normalize_stream_active(settings.kiosk_stream_active_3, default=True),
        "kiosk_stream_title_3": settings.kiosk_stream_title_3,
        "kiosk_stream_url_4": settings.kiosk_stream_url_4,
        "kiosk_camera_host_4": settings.kiosk_camera_host_4,
        "kiosk_camera_user_4": settings.kiosk_camera_user_4,
        "kiosk_camera_password_4": settings.kiosk_camera_password_4,
        "kiosk_stream_active_4": normalize_stream_active(settings.kiosk_stream_active_4, default=True),
        "kiosk_stream_title_4": settings.kiosk_stream_title_4,
    }


def update_settings(settings: Settings, data: dict) -> Settings:
    for field in (
        "poll_interval",
        "db_reload_interval",
        "filename_display_length",
        "telegram_chat_id",
        "language",
        "theme",
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
        "kiosk_stream_active_1",
        "kiosk_stream_title_1",
        "kiosk_stream_url_2",
        "kiosk_camera_host_2",
        "kiosk_camera_user_2",
        "kiosk_camera_password_2",
        "kiosk_stream_active_2",
        "kiosk_stream_title_2",
        "kiosk_stream_url_3",
        "kiosk_camera_host_3",
        "kiosk_camera_user_3",
        "kiosk_camera_password_3",
        "kiosk_stream_active_3",
        "kiosk_stream_title_3",
        "kiosk_stream_url_4",
        "kiosk_camera_host_4",
        "kiosk_camera_user_4",
        "kiosk_camera_password_4",
        "kiosk_stream_active_4",
        "kiosk_stream_title_4",
        "live_wall_printer_columns",
        "live_wall_printer_data",
        "live_wall_plug_poll_interval",
    ):
        if field in data:
            setattr(settings, field, data[field])
    if "poll_interval" in data:
        settings.poll_interval = float(settings.poll_interval) if settings.poll_interval is not None else None
    if "db_reload_interval" in data:
        settings.db_reload_interval = float(settings.db_reload_interval) if settings.db_reload_interval is not None else None
    if "live_wall_printer_columns" in data:
        settings.live_wall_printer_columns = normalize_printer_columns(settings.live_wall_printer_columns)
    if "live_wall_printer_data" in data:
        settings.live_wall_printer_data = normalize_printer_data(settings.live_wall_printer_data)
    if "live_wall_plug_poll_interval" in data:
        settings.live_wall_plug_poll_interval = normalize_plug_poll_interval(
            settings.live_wall_plug_poll_interval
        )
    if "filename_display_length" in data:
        settings.filename_display_length = normalize_filename_display_length(settings.filename_display_length)
    for field in (
        "kiosk_stream_active_1",
        "kiosk_stream_active_2",
        "kiosk_stream_active_3",
        "kiosk_stream_active_4",
    ):
        if field in data:
            setattr(settings, field, normalize_stream_active(getattr(settings, field)))
    return settings
