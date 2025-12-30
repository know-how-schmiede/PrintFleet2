from typing import Iterable

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


def list_printers(session: Session) -> list[Printer]:
    return session.query(Printer).order_by(Printer.id).all()


def get_printer(session: Session, printer_id: int) -> Printer | None:
    return session.get(Printer, printer_id)


def create_printer(session: Session, data: dict) -> Printer:
    printer = Printer(
        name=data["name"],
        backend=data["backend"],
        host=data["host"],
        port=data.get("port", 80),
        https=_bool_value(data.get("https"), False),
        no_scanning=_bool_value(data.get("no_scanning"), False),
        token=data.get("token"),
        api_key=data.get("api_key"),
        error_report_interval=float(data.get("error_report_interval", 30.0)),
        tasmota_host=data.get("tasmota_host"),
        tasmota_topic=data.get("tasmota_topic"),
        location=data.get("location"),
        printer_type=data.get("printer_type"),
        notes=data.get("notes"),
        enabled=_bool_value(data.get("enabled"), True),
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
    if "no_scanning" in data:
        printer.no_scanning = _bool_value(data.get("no_scanning"), printer.no_scanning)
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
        "no_scanning": printer.no_scanning,
        "token": printer.token,
        "api_key": printer.api_key,
        "error_report_interval": printer.error_report_interval,
        "tasmota_host": printer.tasmota_host,
        "tasmota_topic": printer.tasmota_topic,
        "location": printer.location,
        "printer_type": printer.printer_type,
        "notes": printer.notes,
        "enabled": printer.enabled,
    }


def printers_to_dict(printers: Iterable[Printer]) -> list[dict]:
    return [printer_to_dict(printer) for printer in printers]
