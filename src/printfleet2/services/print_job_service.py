from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from printfleet2.models.print_job import PrintJob


PRINT_VIA_DEFAULT = "unknown"
PRINT_VIA_MAP = {
    "justprinting": "JustPrinting",
    "justgroupprinting": "JustGroupPrinting",
    "webui": "Web UI",
}


def normalize_print_via(value: str | None, default: str = PRINT_VIA_DEFAULT) -> str:
    if value is None:
        return default
    cleaned = value.strip()
    if not cleaned:
        return default
    simplified = cleaned.lower().replace(" ", "").replace("-", "").replace("_", "")
    return PRINT_VIA_MAP.get(simplified, cleaned)


def _get_print_job_columns(session: Session) -> set[str]:
    engine = session.get_bind()
    inspector = inspect(engine)
    try:
        return {column["name"] for column in inspector.get_columns("print_jobs")}
    except Exception:
        return set()


def ensure_print_job_schema(session: Session) -> None:
    engine = session.get_bind()
    inspector = inspect(engine)
    try:
        tables = set(inspector.get_table_names())
    except Exception:
        return
    if "print_jobs" not in tables:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "CREATE TABLE print_jobs ("
                        "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                        "job_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, "
                        "gcode_filename VARCHAR NOT NULL, "
                        "printer_name VARCHAR NOT NULL, "
                        "username VARCHAR NOT NULL, "
                        "print_via VARCHAR NOT NULL DEFAULT 'unknown'"
                        ")"
                    )
                )
        except Exception:
            return
        return
    columns = _get_print_job_columns(session)
    missing = {}
    if "print_via" not in columns:
        missing["print_via"] = "TEXT NOT NULL DEFAULT 'unknown'"
    if not missing:
        return
    try:
        with engine.begin() as conn:
            for name, definition in missing.items():
                conn.execute(text(f"ALTER TABLE print_jobs ADD COLUMN {name} {definition}"))
            if "print_via" in missing:
                conn.execute(
                    text(
                        "UPDATE print_jobs "
                        "SET print_via = 'unknown' "
                        "WHERE print_via IS NULL OR print_via = ''"
                    )
                )
    except Exception:
        return


def create_print_job(
    session: Session,
    gcode_filename: str,
    printer_name: str,
    username: str,
    print_via: str | None,
) -> PrintJob | None:
    ensure_print_job_schema(session)
    columns = _get_print_job_columns(session)
    required = {"gcode_filename", "printer_name", "username", "print_via"}
    if not required.issubset(columns):
        return None
    job = PrintJob(
        gcode_filename=gcode_filename,
        printer_name=printer_name,
        username=username,
        print_via=normalize_print_via(print_via),
    )
    session.add(job)
    return job


def list_print_jobs(session: Session, limit: int = 200) -> list[PrintJob]:
    ensure_print_job_schema(session)
    columns = _get_print_job_columns(session)
    if not columns:
        return []
    try:
        return session.query(PrintJob).order_by(PrintJob.id.desc()).limit(limit).all()
    except Exception:
        return []


def print_job_to_dict(job: PrintJob) -> dict:
    return {
        "id": job.id,
        "job_date": job.job_date,
        "gcode_filename": job.gcode_filename,
        "printer_name": job.printer_name,
        "username": job.username,
        "print_via": job.print_via,
    }
