from sqlalchemy import inspect, text, func
from sqlalchemy.orm import Session

from printfleet2.models.printer_type import PrinterType
from printfleet2.services.settings_service import normalize_stream_active


def ensure_printer_type_schema(session: Session) -> None:
    engine = session.get_bind()
    inspector = inspect(engine)
    try:
        tables = set(inspector.get_table_names())
    except Exception:
        return
    if "printer_types" in tables:
        try:
            columns = {column["name"] for column in inspector.get_columns("printer_types")}
        except Exception:
            return
        missing = {}
        if "manufacturer" not in columns:
            missing["manufacturer"] = "TEXT"
        if "upload_gcode_active" not in columns:
            missing["upload_gcode_active"] = "INTEGER NOT NULL DEFAULT 0"
        if "type_kind" not in columns:
            missing["type_kind"] = "TEXT"
        if missing:
            try:
                with engine.begin() as conn:
                    for name, definition in missing.items():
                        conn.execute(text(f"ALTER TABLE printer_types ADD COLUMN {name} {definition}"))
            except Exception:
                return
        return
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE printer_types ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "name VARCHAR NOT NULL UNIQUE, "
                    "bed_size VARCHAR, "
                    "active INTEGER NOT NULL DEFAULT 1, "
                    "manufacturer VARCHAR, "
                    "upload_gcode_active INTEGER NOT NULL DEFAULT 0, "
                    "type_kind VARCHAR, "
                    "notes TEXT)"
                )
            )
    except Exception:
        return


def normalize_type_name(name: str | None) -> str | None:
    if name is None:
        return None
    value = name.strip()
    return value or None


def list_printer_types(session: Session) -> list[PrinterType]:
    ensure_printer_type_schema(session)
    return session.query(PrinterType).order_by(PrinterType.name).all()


def get_printer_type(session: Session, type_id: int) -> PrinterType | None:
    ensure_printer_type_schema(session)
    return session.get(PrinterType, type_id)


def get_printer_type_by_name(session: Session, name: str) -> PrinterType | None:
    ensure_printer_type_schema(session)
    return (
        session.query(PrinterType)
        .filter(func.lower(PrinterType.name) == name.lower())
        .one_or_none()
    )


def create_printer_type(
    session: Session,
    name: str,
    bed_size: str | None = None,
    manufacturer: str | None = None,
    active: bool | None = None,
    upload_gcode_active: bool | None = None,
    type_kind: str | None = None,
    notes: str | None = None,
) -> PrinterType:
    ensure_printer_type_schema(session)
    active_value = normalize_stream_active(active, default=True)
    upload_value = normalize_stream_active(upload_gcode_active, default=False)
    printer_type = PrinterType(
        name=name,
        bed_size=bed_size,
        manufacturer=manufacturer,
        active=active_value,
        upload_gcode_active=upload_value,
        type_kind=type_kind,
        notes=notes,
    )
    session.add(printer_type)
    return printer_type


def printer_type_to_dict(printer_type: PrinterType) -> dict:
    return {
        "id": printer_type.id,
        "name": printer_type.name,
        "bed_size": printer_type.bed_size,
        "active": bool(printer_type.active),
        "manufacturer": printer_type.manufacturer,
        "upload_gcode_active": bool(printer_type.upload_gcode_active),
        "type_kind": printer_type.type_kind,
        "notes": printer_type.notes,
    }
