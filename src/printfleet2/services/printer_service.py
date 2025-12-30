from typing import Iterable

from sqlalchemy.orm import Session

from printfleet2.models.printer import Printer


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
        https=bool(data.get("https", False)),
        no_scanning=bool(data.get("no_scanning", False)),
        token=data.get("token"),
        api_key=data.get("api_key"),
        error_report_interval=float(data.get("error_report_interval", 30.0)),
        tasmota_host=data.get("tasmota_host"),
        tasmota_topic=data.get("tasmota_topic"),
        location=data.get("location"),
        printer_type=data.get("printer_type"),
        notes=data.get("notes"),
        enabled=bool(data.get("enabled", True)),
    )
    session.add(printer)
    return printer


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
