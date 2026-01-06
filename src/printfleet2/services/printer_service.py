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
    }


def printers_to_dict(printers: Iterable[Printer]) -> list[dict]:
    return [printer_to_dict(printer) for printer in printers]
