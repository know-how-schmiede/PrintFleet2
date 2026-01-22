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
    if "printer_groups" not in tables:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "CREATE TABLE printer_groups ("
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                        "name VARCHAR NOT NULL UNIQUE, "
                        "description TEXT, "
                        "printer_type TEXT, "
                        "print_check_status TEXT)"
                    )
                )
        except Exception:
            return
    columns = _get_printer_group_columns(session)
    missing = {}
    if "printer_type" not in columns:
        missing["printer_type"] = "TEXT"
    if "print_check_status" not in columns:
        missing["print_check_status"] = "TEXT"
    if not missing:
        return
    try:
        with engine.begin() as conn:
            for name, definition in missing.items():
                conn.execute(text(f"ALTER TABLE printer_groups ADD COLUMN {name} {definition}"))
            if "print_check_status" in missing:
                conn.execute(
                    text(
                        "UPDATE printer_groups "
                        "SET print_check_status = 'clear' "
                        "WHERE print_check_status IS NULL OR print_check_status = ''"
                    )
                )
    except Exception:
        return


def _get_printer_group_columns(session: Session) -> set[str]:
    engine = session.get_bind()
    inspector = inspect(engine)
    try:
        return {column["name"] for column in inspector.get_columns("printer_groups")}
    except Exception:
        return set()


def normalize_group_name(name: str | None) -> str | None:
    if name is None:
        return None
    value = name.strip()
    return value or None


def normalize_group_check_status(value: object, default: str = "clear") -> str:
    if value is None:
        return default
    if isinstance(value, bool):
        return "check" if value else "clear"
    if isinstance(value, str):
        cleaned = value.strip().lower().replace(" ", "").replace("_", "")
        if cleaned in {"check", "checkgroup"}:
            return "check"
        if cleaned in {"clear", "ok", "ready"}:
            return "clear"
    return default


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


def create_printer_group(
    session: Session,
    name: str,
    description: str | None = None,
    printer_type: str | None = None,
    print_check_status: str | None = None,
) -> PrinterGroup:
    ensure_printer_group_schema(session)
    group = PrinterGroup(
        name=name,
        description=description,
        printer_type=printer_type,
        print_check_status=normalize_group_check_status(print_check_status, "clear"),
    )
    session.add(group)
    return group


def printer_group_to_dict(group: PrinterGroup) -> dict:
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "printer_type": group.printer_type,
        "print_check_status": group.print_check_status or "clear",
    }
