from datetime import date
from typing import Iterable

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from printfleet2.models.printer import Printer


def _bool_value(value: object, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("1", "true", "yes", "on"):
            return True
        if lowered in ("0", "false", "no", "off"):
            return False
    return default


def _resolve_scanning(data: dict, default: bool) -> bool:
    if "scanning" in data:
        return _bool_value(data.get("scanning"), default)
    if "no_scanning" in data:
        return not _bool_value(data.get("no_scanning"), False)
    return default


def _normalize_check_status(value: object, default: str = "clear") -> str:
    if value is None:
        return default
    if isinstance(value, bool):
        return "check" if value else "clear"
    if isinstance(value, str):
        cleaned = value.strip().lower().replace(" ", "").replace("_", "")
        if cleaned in {"check", "checkprinter"}:
            return "check"
        if cleaned in {"clear", "ok", "ready"}:
            return "clear"
    return default


def _coerce_seconds(value: object | None) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def _normalize_job_name(value: object | None) -> str | None:
    if value is None:
        return None
    name = str(value).strip()
    return name or None


def _is_printing_label(label: str | None) -> bool:
    if not label:
        return False
    return "printing" in label.lower()


def _is_job_active_label(label: str | None) -> bool:
    if not label:
        return False
    lowered = label.lower()
    return any(token in lowered for token in ("printing", "paused", "pausing", "resuming"))


def update_print_time_totals(printers: Iterable[Printer], status_map: dict[int, dict]) -> tuple[float, float]:
    today_key = date.today().isoformat()
    total_today = 0.0
    total_total = 0.0
    for printer in printers:
        if printer.print_time_today_date != today_key:
            printer.print_time_today_date = today_key
            printer.print_time_today_seconds = 0.0
        status = status_map.get(printer.id)
        _update_printer_print_time(printer, status)
        total_today += float(printer.print_time_today_seconds or 0.0)
        total_total += float(printer.print_time_total_seconds or 0.0)
    return total_today, total_total


def _update_printer_print_time(printer: Printer, status: dict | None) -> None:
    if not status:
        return
    label = status.get("label") if isinstance(status, dict) else None
    elapsed = _coerce_seconds(status.get("elapsed") if isinstance(status, dict) else None)
    job_name = _normalize_job_name(status.get("job_name") if isinstance(status, dict) else None)
    is_printing = _is_printing_label(label)
    is_job_active = _is_job_active_label(label)

    if elapsed is not None and is_printing:
        last_elapsed = _coerce_seconds(printer.print_time_last_elapsed)
        last_job_name = _normalize_job_name(printer.print_time_last_job_name)
        delta = 0.0
        if last_elapsed is not None:
            if job_name and last_job_name and job_name == last_job_name and elapsed >= last_elapsed:
                delta = elapsed - last_elapsed
            elif not last_job_name and elapsed >= last_elapsed:
                delta = elapsed - last_elapsed
            else:
                delta = elapsed
        else:
            delta = elapsed
        if delta > 0:
            printer.print_time_total_seconds = float(printer.print_time_total_seconds or 0.0) + delta
            printer.print_time_today_seconds = float(printer.print_time_today_seconds or 0.0) + delta
        printer.print_time_last_elapsed = elapsed
        if job_name:
            printer.print_time_last_job_name = job_name
        return

    if elapsed is not None and is_job_active:
        printer.print_time_last_elapsed = elapsed
        if job_name:
            printer.print_time_last_job_name = job_name
        return

    if not is_job_active:
        printer.print_time_last_elapsed = None
        printer.print_time_last_job_name = None


def ensure_printer_schema(session: Session) -> None:
    engine = session.get_bind()
    inspector = inspect(engine)
    try:
        columns = {column["name"] for column in inspector.get_columns("printers")}
    except Exception:
        return
    try:
        with engine.begin() as conn:
            if "scanning" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN scanning BOOLEAN DEFAULT 1"))
                if "no_scanning" in columns:
                    conn.execute(
                        text("UPDATE printers SET scanning = CASE WHEN no_scanning = 1 THEN 0 ELSE 1 END")
                    )
                else:
                    conn.execute(text("UPDATE printers SET scanning = 1"))
            if "group_id" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN group_id INTEGER"))
            if "print_check_status" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN print_check_status VARCHAR"))
                conn.execute(
                    text(
                        "UPDATE printers SET print_check_status = 'clear' "
                        "WHERE print_check_status IS NULL OR print_check_status = ''"
                    )
                )
            if "print_time_total_seconds" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN print_time_total_seconds REAL"))
                conn.execute(
                    text(
                        "UPDATE printers SET print_time_total_seconds = 0 "
                        "WHERE print_time_total_seconds IS NULL"
                    )
                )
            if "print_time_today_seconds" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN print_time_today_seconds REAL"))
                conn.execute(
                    text(
                        "UPDATE printers SET print_time_today_seconds = 0 "
                        "WHERE print_time_today_seconds IS NULL"
                    )
                )
            if "print_time_today_date" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN print_time_today_date TEXT"))
            if "print_time_last_elapsed" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN print_time_last_elapsed REAL"))
            if "print_time_last_job_name" not in columns:
                conn.execute(text("ALTER TABLE printers ADD COLUMN print_time_last_job_name TEXT"))
    except Exception:
        return


def list_printers(session: Session) -> list[Printer]:
    ensure_printer_schema(session)
    return session.query(Printer).order_by(Printer.id).all()


def get_printer(session: Session, printer_id: int) -> Printer | None:
    ensure_printer_schema(session)
    return session.get(Printer, printer_id)


def create_printer(session: Session, data: dict) -> Printer:
    ensure_printer_schema(session)
    printer = Printer(
        name=data["name"],
        backend=data["backend"],
        host=data["host"],
        port=data.get("port", 80),
        https=_bool_value(data.get("https"), False),
        scanning=_resolve_scanning(data, True),
        token=data.get("token"),
        api_key=data.get("api_key"),
        error_report_interval=float(data.get("error_report_interval", 30.0)),
        tasmota_host=data.get("tasmota_host"),
        tasmota_topic=data.get("tasmota_topic"),
        location=data.get("location"),
        printer_type=data.get("printer_type"),
        notes=data.get("notes"),
        enabled=_bool_value(data.get("enabled"), True),
        group_id=data.get("group_id"),
        print_check_status=_normalize_check_status(data.get("print_check_status"), "clear"),
        print_time_total_seconds=0.0,
        print_time_today_seconds=0.0,
        print_time_today_date=date.today().isoformat(),
        print_time_last_elapsed=None,
        print_time_last_job_name=None,
    )
    session.add(printer)
    return printer


def update_printer(session: Session, printer: Printer, data: dict) -> Printer:
    if "name" in data:
        printer.name = data["name"]
    if "backend" in data:
        printer.backend = data["backend"]
    if "host" in data:
        printer.host = data["host"]
    if "port" in data:
        printer.port = int(data["port"])
    if "https" in data:
        printer.https = _bool_value(data.get("https"), printer.https)
    if "scanning" in data or "no_scanning" in data:
        printer.scanning = _resolve_scanning(data, printer.scanning)
    if "token" in data:
        printer.token = data["token"]
    if "api_key" in data:
        printer.api_key = data["api_key"]
    if "error_report_interval" in data:
        printer.error_report_interval = float(data["error_report_interval"])
    if "tasmota_host" in data:
        printer.tasmota_host = data["tasmota_host"]
    if "tasmota_topic" in data:
        printer.tasmota_topic = data["tasmota_topic"]
    if "location" in data:
        printer.location = data["location"]
    if "printer_type" in data:
        printer.printer_type = data["printer_type"]
    if "notes" in data:
        printer.notes = data["notes"]
    if "enabled" in data:
        printer.enabled = _bool_value(data.get("enabled"), printer.enabled)
    if "group_id" in data:
        printer.group_id = data.get("group_id")
    if "print_check_status" in data:
        printer.print_check_status = _normalize_check_status(
            data.get("print_check_status"),
            printer.print_check_status or "clear",
        )
    return printer


def delete_printer(session: Session, printer: Printer) -> None:
    session.delete(printer)


def printer_to_dict(printer: Printer) -> dict:
    return {
        "id": printer.id,
        "name": printer.name,
        "backend": printer.backend,
        "host": printer.host,
        "port": printer.port,
        "https": printer.https,
        "scanning": printer.scanning,
        "token": printer.token,
        "api_key": printer.api_key,
        "error_report_interval": printer.error_report_interval,
        "tasmota_host": printer.tasmota_host,
        "tasmota_topic": printer.tasmota_topic,
        "location": printer.location,
        "printer_type": printer.printer_type,
        "notes": printer.notes,
        "enabled": printer.enabled,
        "group_id": printer.group_id,
        "print_check_status": printer.print_check_status or "clear",
        "print_time_total_seconds": float(printer.print_time_total_seconds or 0.0),
        "print_time_today_seconds": float(printer.print_time_today_seconds or 0.0),
        "print_time_today_date": printer.print_time_today_date,
    }


def printers_to_dict(printers: Iterable[Printer]) -> list[dict]:
    return [printer_to_dict(printer) for printer in printers]
