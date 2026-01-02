from sqlalchemy import inspect, text, func
from sqlalchemy.orm import Session

from printfleet2.models.printer_group import PrinterGroup


def ensure_printer_group_schema(session: Session) -> None:
    engine = session.get_bind()
    inspector = inspect(engine)
    try:
        tables = set(inspector.get_table_names())
    except Exception:
        return
    if "printer_groups" in tables:
        return
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE TABLE printer_groups ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "name VARCHAR NOT NULL UNIQUE, "
                    "description TEXT)"
                )
            )
    except Exception:
        return


def normalize_group_name(name: str | None) -> str | None:
    if name is None:
        return None
    value = name.strip()
    return value or None


def list_printer_groups(session: Session) -> list[PrinterGroup]:
    ensure_printer_group_schema(session)
    return session.query(PrinterGroup).order_by(PrinterGroup.name).all()


def get_printer_group(session: Session, group_id: int) -> PrinterGroup | None:
    ensure_printer_group_schema(session)
    return session.get(PrinterGroup, group_id)


def get_printer_group_by_name(session: Session, name: str) -> PrinterGroup | None:
    ensure_printer_group_schema(session)
    return (
        session.query(PrinterGroup)
        .filter(func.lower(PrinterGroup.name) == name.lower())
        .one_or_none()
    )


def create_printer_group(session: Session, name: str, description: str | None = None) -> PrinterGroup:
    ensure_printer_group_schema(session)
    group = PrinterGroup(name=name, description=description)
    session.add(group)
    return group


def printer_group_to_dict(group: PrinterGroup) -> dict:
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
    }
