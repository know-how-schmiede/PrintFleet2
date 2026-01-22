import shutil
import subprocess
import time
from datetime import datetime, date, timezone

from flask import Blueprint, request, session as flask_session, Response, render_template, redirect, stream_with_context, url_for

from printfleet2.db.session import session_scope
from printfleet2.models.printer import Printer
from printfleet2.services.printer_service import (
    create_printer,
    delete_printer,
    ensure_printer_schema,
    get_printer,
    list_printers,
    printer_to_dict,
    printers_to_dict,
    update_printer,
    update_print_time_totals,
)
from printfleet2.services.printer_group_service import (
    create_printer_group,
    get_printer_group,
    get_printer_group_by_name,
    list_printer_groups,
    normalize_group_name,
    printer_group_to_dict,
)
from printfleet2.services.printer_type_service import (
    create_printer_type,
    get_printer_type,
    get_printer_type_by_name,
    list_printer_types,
    normalize_type_name,
    printer_type_to_dict,
)
from printfleet2.services.printer_status_service import (
    build_printer_snapshots,
    collect_plug_energy,
    collect_plug_statuses,
    collect_printer_statuses,
)
from printfleet2.services.settings_service import (
    ensure_settings_row,
    normalize_printer_data,
    normalize_printer_columns,
    normalize_plug_poll_interval,
    normalize_stream_active,
    settings_to_dict,
    update_settings,
)
from printfleet2.services.printer_upload_service import upload_and_print
from printfleet2.services.print_job_service import (
    count_print_jobs,
    count_print_jobs_today,
    create_print_job,
    list_print_jobs,
    normalize_print_via,
    print_job_to_dict,
)
from printfleet2.services.net_scan_service import scan_local_network
from printfleet2.services.user_service import (
    create_user,
    get_user,
    get_user_by_username,
    has_users,
    list_users,
    normalize_role,
    user_to_dict,
)
from printfleet2.services.auth_service import hash_password, verify_password
from printfleet2.version import VERSION


bp = Blueprint("web", __name__)

_PENDING_UPLOADS: dict[int, list[dict]] = {}
_PENDING_UPLOAD_TTL_SECONDS = 30 * 60


def clean_text(value: object | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    return value or None


def normalize_rtsp_host(host: str | None) -> str | None:
    if not host:
        return None
    candidate = host.strip()
    if not candidate:
        return None
    lower = candidate.lower()
    if lower.startswith("rtsp://"):
        candidate = candidate[7:]
    candidate = candidate.split("/", 1)[0]
    if not candidate:
        return None
    if candidate.startswith("["):
        if "]" in candidate and candidate.rsplit("]", 1)[-1].startswith(":"):
            return candidate
        return f"{candidate}:554"
    if ":" in candidate:
        return candidate
    return f"{candidate}:554"


def build_rtsp_url(host: str | None, user: str | None, password: str | None, stream_path: str = "stream1") -> str | None:
    host_value = clean_text(host)
    if not host_value:
        return None
    lower = host_value.lower()
    if lower.startswith("rtsp://"):
        tail = host_value[7:]
        if "@" in tail:
            return host_value
        user_value = clean_text(user)
        password_value = clean_text(password)
        if user_value and password_value:
            return f"rtsp://{user_value}:{password_value}@{tail}"
        return host_value
    if "/" in host_value:
        base, path = host_value.split("/", 1)
        path = f"/{path}"
    else:
        base = host_value
        path = f"/{stream_path}"
    base = base.strip()
    if not base:
        return None
    if "@" in base:
        credentials, host_part = base.rsplit("@", 1)
        normalized_host = normalize_rtsp_host(host_part)
        if not normalized_host:
            return None
        return f"rtsp://{credentials}@{normalized_host}{path}"
    normalized_host = normalize_rtsp_host(base)
    if not normalized_host:
        return None
    user_value = clean_text(user)
    password_value = clean_text(password)
    credentials = f"{user_value}:{password_value}@" if user_value and password_value else ""
    return f"rtsp://{credentials}{normalized_host}{path}"


def normalize_layout(layout: str | None) -> str:
    if not layout:
        return "standard"
    layout = layout.strip().lower().replace(" ", "-")
    if layout in {"standard", "grid", "focus"}:
        return layout
    return "standard"


def stream_type_for_url(url: str) -> str:
    lower = url.split("?", 1)[0].lower()
    if lower.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg")):
        return "image"
    if "mjpeg" in lower or "mjpg" in lower:
        return "image"
    return "iframe"


def build_live_wall_config(settings: dict) -> dict:
    streams: list[dict] = []

    def add_stream(
        stream_id: int,
        url: str | None,
        label: str,
        active: bool = True,
        title: str | None = None,
        rtsp_url: str | None = None,
    ) -> None:
        if not active:
            return
        url_value = clean_text(url)
        rtsp_value = clean_text(rtsp_url)
        if url_value:
            final_url = url_value
        elif rtsp_value:
            final_url = url_for("web.live_wall_stream", stream_id=stream_id)
        else:
            final_url = None
        title_value = title.strip() if isinstance(title, str) else ""
        label_value = title_value or label
        streams.append(
            {
                "label": label_value,
                "url": final_url,
                "type": stream_type_for_url(final_url) if final_url else "empty",
            }
        )

    add_stream(
        1,
        settings.get("kiosk_stream_url_1"),
        "Stream 1",
        settings.get("kiosk_stream_active_1", True),
        settings.get("kiosk_stream_title_1"),
        build_rtsp_url(
            settings.get("kiosk_camera_host_1"),
            settings.get("kiosk_camera_user_1"),
            settings.get("kiosk_camera_password_1"),
            1,
        ),
    )
    add_stream(
        2,
        settings.get("kiosk_stream_url_2"),
        "Stream 2",
        settings.get("kiosk_stream_active_2", True),
        settings.get("kiosk_stream_title_2"),
        build_rtsp_url(
            settings.get("kiosk_camera_host_2"),
            settings.get("kiosk_camera_user_2"),
            settings.get("kiosk_camera_password_2"),
            2,
        ),
    )
    add_stream(
        3,
        settings.get("kiosk_stream_url_3"),
        "Stream 3",
        settings.get("kiosk_stream_active_3", True),
        settings.get("kiosk_stream_title_3"),
        build_rtsp_url(
            settings.get("kiosk_camera_host_3"),
            settings.get("kiosk_camera_user_3"),
            settings.get("kiosk_camera_password_3"),
            3,
        ),
    )
    add_stream(
        4,
        settings.get("kiosk_stream_url_4"),
        "Stream 4",
        settings.get("kiosk_stream_active_4", True),
        settings.get("kiosk_stream_title_4"),
        build_rtsp_url(
            settings.get("kiosk_camera_host_4"),
            settings.get("kiosk_camera_user_4"),
            settings.get("kiosk_camera_password_4"),
            4,
        ),
    )

    poll_interval = settings.get("poll_interval")
    try:
        poll_interval_value = float(poll_interval) if poll_interval is not None else None
    except (TypeError, ValueError):
        poll_interval_value = None
    if not poll_interval_value or poll_interval_value <= 0:
        poll_interval_value = 5.0

    return {
        "layout": normalize_layout(settings.get("kiosk_stream_layout")),
        "printer_columns": normalize_printer_columns(settings.get("live_wall_printer_columns")) or 3,
        "printer_data": normalize_printer_data(settings.get("live_wall_printer_data")),
        "plug_poll_interval": normalize_plug_poll_interval(settings.get("live_wall_plug_poll_interval")) or 5.0,
        "status_poll_interval": poll_interval_value,
        "streams": streams,
    }


def build_live_wall_printers(printers) -> list[dict]:
    status_map = collect_printer_statuses([printer for printer in printers if printer.enabled], include_plug=True)
    active_printers = []
    for printer in printers:
        if not printer.enabled:
            continue
        status = status_map.get(
            printer.id,
            {
                "label": "Unknown",
                "state": "muted",
                "temp_hotend": None,
                "temp_bed": None,
                "target_hotend": None,
                "target_bed": None,
                "job_name": None,
                "progress": None,
                "elapsed": None,
                "remaining": None,
                "error_message": None,
                "plug_label": None,
                "plug_state": None,
            },
        )
        active_printers.append(
            {
                "id": printer.id,
                "name": printer.name,
                "location": printer.location,
                "type": printer.printer_type,
                "backend": printer.backend,
                "host": printer.host,
                "port": printer.port,
                "status": status["label"],
                "status_state": status["state"],
                "temp_hotend": status.get("temp_hotend"),
                "temp_bed": status.get("temp_bed"),
                "target_hotend": status.get("target_hotend"),
                "target_bed": status.get("target_bed"),
                "job_name": status.get("job_name"),
                "progress": status.get("progress"),
                "elapsed": status.get("elapsed"),
                "remaining": status.get("remaining"),
                "error_message": status.get("error_message"),
                "plug_label": status.get("plug_label"),
                "plug_state": status.get("plug_state"),
            }
        )
    return active_printers


def build_rtsp_url_from_settings(settings, stream_id: int) -> str | None:
    host = getattr(settings, f"kiosk_camera_host_{stream_id}", None)
    user = getattr(settings, f"kiosk_camera_user_{stream_id}", None)
    password = getattr(settings, f"kiosk_camera_password_{stream_id}", None)
    return build_rtsp_url(host, user, password)


def iter_mjpeg_stream(rtsp_url: str):
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-rtsp_transport",
        "tcp",
        "-i",
        rtsp_url,
        "-an",
        "-sn",
        "-dn",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-q:v",
        "5",
        "-r",
        "10",
        "-",
    ]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        bufsize=0,
    )
    buffer = b""
    try:
        while True:
            chunk = process.stdout.read(4096) if process.stdout else b""
            if not chunk:
                break
            buffer += chunk
            while True:
                start = buffer.find(b"\xff\xd8")
                if start == -1:
                    buffer = buffer[-2:] if len(buffer) > 2 else buffer
                    break
                end = buffer.find(b"\xff\xd9", start + 2)
                if end == -1:
                    if start > 0:
                        buffer = buffer[start:]
                    break
                frame = buffer[start : end + 2]
                buffer = buffer[end + 2 :]
                header = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(frame)}\r\n\r\n".encode()
                )
                yield header + frame + b"\r\n"
    except GeneratorExit:
        pass
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=2)
            except Exception:
                process.kill()


def clean_optional(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
    else:
        value = str(value).strip()
    return value or None


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _normalize_job_filename(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
    else:
        cleaned = str(value).strip()
    if not cleaned:
        return None
    for sep in ("/", "\\"):
        if sep in cleaned:
            cleaned = cleaned.rsplit(sep, 1)[-1]
    return cleaned or None


def _job_name_matches(filename: str, job_name: str | None) -> bool:
    normalized_job = _normalize_job_filename(job_name)
    normalized_file = _normalize_job_filename(filename)
    if not normalized_job or not normalized_file:
        return False
    job_lower = normalized_job.lower()
    file_lower = normalized_file.lower()
    job_stem = job_lower.rsplit(".", 1)[0]
    file_stem = file_lower.rsplit(".", 1)[0]
    if job_lower == file_lower:
        return True
    if job_stem and file_stem and job_stem == file_stem:
        return True
    safe_name = filename.replace("\\", "_").replace("/", "_").lower()
    if job_lower == safe_name:
        return True
    return job_lower.endswith(file_lower)


def _is_active_job_label(label: str | None) -> bool:
    if not label:
        return False
    lowered = str(label).lower()
    return any(token in lowered for token in ("printing", "paused", "pausing", "resuming"))


def _confirm_print_started(printer: Printer, filename: str, attempts: int = 5, delay: float = 1.0) -> bool:
    for idx in range(max(1, attempts)):
        status_map = collect_printer_statuses([printer], include_plug=False)
        status = status_map.get(printer.id, {})
        label = status.get("label")
        job_name = clean_optional(status.get("job_name"))
        if job_name:
            if _job_name_matches(filename, job_name):
                return True
        elif _is_active_job_label(label):
            return True
        if idx < attempts - 1:
            time.sleep(delay)
    return False


def _record_pending_upload(
    printer_id: int,
    filename: str,
    printer_name: str,
    username: str,
    print_via: str,
) -> None:
    now = time.time()
    _cleanup_pending_uploads(now)
    attempts = _PENDING_UPLOADS.setdefault(printer_id, [])
    attempts = [entry for entry in attempts if not _job_name_matches(entry["filename"], filename)]
    attempts.append(
        {
            "ts": now,
            "filename": filename,
            "printer_name": printer_name,
            "username": username,
            "print_via": print_via,
        }
    )
    _PENDING_UPLOADS[printer_id] = attempts


def _cleanup_pending_uploads(now: float) -> None:
    cutoff = now - _PENDING_UPLOAD_TTL_SECONDS
    for printer_id in list(_PENDING_UPLOADS.keys()):
        attempts = [entry for entry in _PENDING_UPLOADS[printer_id] if entry["ts"] >= cutoff]
        if attempts:
            _PENDING_UPLOADS[printer_id] = attempts
        else:
            _PENDING_UPLOADS.pop(printer_id, None)


def _pop_pending_upload(printer_id: int, job_name: str | None) -> dict | None:
    if not job_name:
        return None
    attempts = _PENDING_UPLOADS.get(printer_id)
    if not attempts:
        return None
    for idx, attempt in enumerate(attempts):
        if _job_name_matches(attempt["filename"], job_name):
            return attempts.pop(idx)
    return None


def _discard_pending_upload(printer_id: int, filename: str) -> None:
    attempts = _PENDING_UPLOADS.get(printer_id)
    if not attempts:
        return
    attempts = [entry for entry in attempts if not _job_name_matches(entry["filename"], filename)]
    if attempts:
        _PENDING_UPLOADS[printer_id] = attempts
    else:
        _PENDING_UPLOADS.pop(printer_id, None)


def _flush_pending_uploads(session, status_map: dict[int, dict], name_map: dict[int, str]) -> None:
    now = time.time()
    _cleanup_pending_uploads(now)
    for printer_id, status in status_map.items():
        label = status.get("label")
        job_name = clean_optional(status.get("job_name"))
        if not job_name and not _is_active_job_label(label):
            continue
        attempt = _pop_pending_upload(printer_id, job_name)
        if not attempt:
            continue
        printer_name = name_map.get(printer_id) or attempt.get("printer_name") or "Unknown printer"
        username = attempt.get("username") or "unknown"
        print_via = attempt.get("print_via") or "unknown"
        create_print_job(
            session,
            gcode_filename=attempt.get("filename") or job_name or "unknown",
            printer_name=printer_name,
            username=username,
            print_via=print_via,
        )


def normalize_group_id(payload: dict, session) -> tuple[bool, int | None, dict | None]:
    if "group_id" not in payload:
        return False, None, None
    raw_value = payload.get("group_id")
    if raw_value in (None, ""):
        return True, None, None
    try:
        group_id = int(raw_value)
    except (TypeError, ValueError):
        return True, None, {"error": "invalid_group_id"}
    if group_id <= 0:
        return True, None, {"error": "invalid_group_id"}
    group = get_printer_group(session, group_id)
    if group is None:
        return True, None, {"error": "group_not_found"}
    return True, group_id, None


@bp.get("/")
def index():
    with session_scope() as session:
        printers = list_printers(session)
        enabled_printers = [printer for printer in printers if printer.enabled]
        snapshots = build_printer_snapshots(enabled_printers)
        active_printer_names = [printer.name for printer in enabled_printers]
        total_print_jobs_today = count_print_jobs_today(session)
        total_print_jobs_total = count_print_jobs(session)
    status_map = collect_printer_statuses(snapshots, include_plug=False)
    active_prints = 0
    active_errors = 0
    for printer in snapshots:
        status = status_map.get(
            printer.id,
            {
                "label": "Unknown",
                "state": "muted",
                "error_message": None,
            },
        )
        label = status.get("label")
        if isinstance(label, str) and "printing" in label.lower():
            active_prints += 1
        error_message = status.get("error_message")
        if status.get("state") == "error" or (isinstance(error_message, str) and error_message.strip()):
            active_errors += 1
    snapshot = {
        "total_printers": len(printers),
        "active_prints": active_prints,
        "active_errors": active_errors,
        "total_print_jobs_today": total_print_jobs_today,
        "total_print_jobs_total": total_print_jobs_total,
    }
    return render_template(
        "index.html",
        snapshot=snapshot,
        active_printer_names=active_printer_names,
    )


@bp.get("/printer-dashboard")
def printer_dashboard_page():
    with session_scope() as session:
        printers = list_printers(session)
        enabled_printers = [printer for printer in printers if printer.enabled]
        snapshots = build_printer_snapshots(enabled_printers)
        total_print_jobs_today = count_print_jobs_today(session)
        total_print_jobs_total = count_print_jobs(session)
    status_map = collect_printer_statuses(snapshots, include_plug=False)
    active_prints = 0
    active_errors = 0
    for printer in snapshots:
        status = status_map.get(
            printer.id,
            {
                "label": "Unknown",
                "state": "muted",
                "error_message": None,
            },
        )
        label = status.get("label")
        if isinstance(label, str) and "printing" in label.lower():
            active_prints += 1
        error_message = status.get("error_message")
        if status.get("state") == "error" or (isinstance(error_message, str) and error_message.strip()):
            active_errors += 1
    snapshot = {
        "total_printers": len(printers),
        "active_prints": active_prints,
        "active_errors": active_errors,
        "total_print_jobs_today": total_print_jobs_today,
        "total_print_jobs_total": total_print_jobs_total,
    }
    return render_template(
        "printer_dashboard.html",
        snapshot=snapshot,
    )


@bp.get("/printer-just")
def printer_just_page():
    with session_scope() as session:
        printers = list_printers(session)
        enabled_printers = [printer for printer in printers if printer.enabled]
        snapshots = build_printer_snapshots(enabled_printers)
        total_print_jobs_today = count_print_jobs_today(session)
        total_print_jobs_total = count_print_jobs(session)
    status_map = collect_printer_statuses(snapshots, include_plug=False)
    active_prints = 0
    active_errors = 0
    for printer in snapshots:
        status = status_map.get(
            printer.id,
            {
                "label": "Unknown",
                "state": "muted",
                "error_message": None,
            },
        )
        label = status.get("label")
        if isinstance(label, str) and "printing" in label.lower():
            active_prints += 1
        error_message = status.get("error_message")
        if status.get("state") == "error" or (isinstance(error_message, str) and error_message.strip()):
            active_errors += 1
    snapshot = {
        "total_printers": len(printers),
        "enabled_printers": len(enabled_printers),
        "active_prints": active_prints,
        "active_errors": active_errors,
        "total_print_jobs_today": total_print_jobs_today,
        "total_print_jobs_total": total_print_jobs_total,
    }
    return render_template(
        "printer_just.html",
        snapshot=snapshot,
    )


@bp.get("/printer-group-just")
def printer_group_just_page():
    with session_scope() as session:
        printers = list_printers(session)
        enabled_printers = [printer for printer in printers if printer.enabled]
        snapshots = build_printer_snapshots(enabled_printers)
        total_print_jobs_today = count_print_jobs_today(session)
        total_print_jobs_total = count_print_jobs(session)
    status_map = collect_printer_statuses(snapshots, include_plug=False)
    active_prints = 0
    active_errors = 0
    for printer in snapshots:
        status = status_map.get(
            printer.id,
            {
                "label": "Unknown",
                "state": "muted",
                "error_message": None,
            },
        )
        label = status.get("label")
        if isinstance(label, str) and "printing" in label.lower():
            active_prints += 1
        error_message = status.get("error_message")
        if status.get("state") == "error" or (isinstance(error_message, str) and error_message.strip()):
            active_errors += 1
    snapshot = {
        "total_printers": len(printers),
        "enabled_printers": len(enabled_printers),
        "active_prints": active_prints,
        "active_errors": active_errors,
        "total_print_jobs_today": total_print_jobs_today,
        "total_print_jobs_total": total_print_jobs_total,
    }
    return render_template(
        "printer_group_just.html",
        snapshot=snapshot,
    )


@bp.get("/api/settings")
def get_settings():
    with session_scope() as session:
        settings = ensure_settings_row(session)
        return settings_to_dict(settings)


@bp.put("/api/settings")
@bp.patch("/api/settings")
def put_settings():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    with session_scope() as session:
        settings = ensure_settings_row(session)
        update_settings(settings, payload)
        return settings_to_dict(settings)


@bp.get("/api/printers")
def get_printers():
    with session_scope() as session:
        printers = list_printers(session)
        return {"items": printers_to_dict(printers)}


@bp.get("/api/printer-groups")
def get_printer_groups():
    with session_scope() as session:
        groups = list_printer_groups(session)
        return {"items": [printer_group_to_dict(group) for group in groups]}


@bp.get("/api/printer-groups/export")
def export_printer_groups():
    with session_scope() as session:
        groups = list_printer_groups(session)
        return {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "app_version": VERSION,
            "items": [printer_group_to_dict(group) for group in groups],
        }


@bp.post("/api/printer-groups/import")
def import_printer_groups():
    payload = request.get_json(silent=True) or {}
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = payload.get("items") or payload.get("printer_groups") or payload.get("groups")
    else:
        items = None
    if not isinstance(items, list):
        return {"error": "invalid_json"}, 400
    created = 0
    updated = 0
    skipped = 0
    invalid = 0
    seen_names: set[str] = set()
    with session_scope() as session:
        for raw in items:
            if not isinstance(raw, dict):
                invalid += 1
                continue
            name = normalize_group_name(raw.get("name"))
            if not name:
                invalid += 1
                continue
            name_key = name.lower()
            if name_key in seen_names:
                skipped += 1
                continue
            seen_names.add(name_key)
            description = clean_optional(raw.get("description")) if "description" in raw else None
            existing = get_printer_group_by_name(session, name)
            if existing is None:
                create_printer_group(session, name, description)
                created += 1
            else:
                if "description" in raw:
                    existing.description = description
                updated += 1
    return {"created": created, "updated": updated, "skipped": skipped, "invalid": invalid}


@bp.post("/api/printer-groups")
def post_printer_group():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    name = normalize_group_name(payload.get("name"))
    if not name:
        return {"error": "missing_name"}, 400
    description = clean_optional(payload.get("description"))
    with session_scope() as session:
        existing = get_printer_group_by_name(session, name)
        if existing is not None:
            return {"error": "name_exists"}, 409
        group = create_printer_group(session, name, description)
        return printer_group_to_dict(group), 201


@bp.put("/api/printer-groups/<int:group_id>")
@bp.patch("/api/printer-groups/<int:group_id>")
def put_printer_group(group_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    with session_scope() as session:
        group = get_printer_group(session, group_id)
        if group is None:
            return {"error": "not_found"}, 404
        if "name" in payload:
            name_value = normalize_group_name(payload.get("name"))
            if not name_value:
                return {"error": "missing_name"}, 400
            existing = get_printer_group_by_name(session, name_value)
            if existing is not None and existing.id != group.id:
                return {"error": "name_exists"}, 409
            group.name = name_value
        if "description" in payload:
            group.description = clean_optional(payload.get("description"))
        return printer_group_to_dict(group)


@bp.delete("/api/printer-groups/<int:group_id>")
def delete_printer_group(group_id: int):
    with session_scope() as session:
        group = get_printer_group(session, group_id)
        if group is None:
            return {"error": "not_found"}, 404
        ensure_printer_schema(session)
        cleared = (
            session.query(Printer)
            .filter(Printer.group_id == group_id)
            .update({Printer.group_id: None})
        )
        session.delete(group)
        return {"status": "deleted", "cleared_printers": cleared or 0}


@bp.get("/api/printer-types")
def get_printer_types():
    with session_scope() as session:
        types = list_printer_types(session)
        return {"items": [printer_type_to_dict(item) for item in types]}


@bp.get("/api/printer-types/export")
def export_printer_types():
    with session_scope() as session:
        types = list_printer_types(session)
        return {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "app_version": VERSION,
            "items": [printer_type_to_dict(item) for item in types],
        }


@bp.post("/api/printer-types/import")
def import_printer_types():
    payload = request.get_json(silent=True) or {}
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = payload.get("items") or payload.get("printer_types") or payload.get("types")
    else:
        items = None
    if not isinstance(items, list):
        return {"error": "invalid_json"}, 400
    created = 0
    updated = 0
    skipped = 0
    invalid = 0
    seen_names: set[str] = set()
    with session_scope() as session:
        for raw in items:
            if not isinstance(raw, dict):
                invalid += 1
                continue
            name = normalize_type_name(raw.get("name"))
            if not name:
                invalid += 1
                continue
            name_key = name.lower()
            if name_key in seen_names:
                skipped += 1
                continue
            seen_names.add(name_key)
            bed_size = clean_optional(raw.get("bed_size")) if "bed_size" in raw else None
            manufacturer = clean_optional(raw.get("manufacturer")) if "manufacturer" in raw else None
            gcode_prefix = clean_optional(raw.get("gcode_prefix")) if "gcode_prefix" in raw else None
            type_kind = clean_optional(raw.get("type_kind")) if "type_kind" in raw else None
            notes = clean_optional(raw.get("notes")) if "notes" in raw else None
            active_present = "active" in raw
            upload_present = "upload_gcode_active" in raw
            active = normalize_stream_active(raw.get("active"), default=True)
            upload_gcode_active = normalize_stream_active(raw.get("upload_gcode_active"), default=False)
            existing = get_printer_type_by_name(session, name)
            if existing is None:
                create_printer_type(
                    session,
                    name,
                    bed_size,
                    manufacturer,
                    gcode_prefix,
                    active,
                    upload_gcode_active,
                    type_kind,
                    notes,
                )
                created += 1
            else:
                if "bed_size" in raw:
                    existing.bed_size = bed_size
                if "manufacturer" in raw:
                    existing.manufacturer = manufacturer
                if "gcode_prefix" in raw:
                    existing.gcode_prefix = gcode_prefix
                if active_present:
                    existing.active = active
                if upload_present:
                    existing.upload_gcode_active = upload_gcode_active
                if "type_kind" in raw:
                    existing.type_kind = type_kind
                if "notes" in raw:
                    existing.notes = notes
                updated += 1
    return {"created": created, "updated": updated, "skipped": skipped, "invalid": invalid}


@bp.post("/api/printer-types")
def post_printer_type():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    name = normalize_type_name(payload.get("name"))
    if not name:
        return {"error": "missing_name"}, 400
    bed_size = clean_optional(payload.get("bed_size"))
    manufacturer = clean_optional(payload.get("manufacturer"))
    gcode_prefix = clean_optional(payload.get("gcode_prefix"))
    type_kind = clean_optional(payload.get("type_kind"))
    notes = clean_optional(payload.get("notes"))
    active = normalize_stream_active(payload.get("active"), default=True)
    upload_gcode_active = normalize_stream_active(payload.get("upload_gcode_active"), default=False)
    with session_scope() as session:
        existing = get_printer_type_by_name(session, name)
        if existing is not None:
            return {"error": "name_exists"}, 409
        printer_type = create_printer_type(
            session,
            name,
            bed_size,
            manufacturer,
            gcode_prefix,
            active,
            upload_gcode_active,
            type_kind,
            notes,
        )
        return printer_type_to_dict(printer_type), 201


@bp.put("/api/printer-types/<int:type_id>")
@bp.patch("/api/printer-types/<int:type_id>")
def put_printer_type(type_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    with session_scope() as session:
        printer_type = get_printer_type(session, type_id)
        if printer_type is None:
            return {"error": "not_found"}, 404
        if "name" in payload:
            name_value = normalize_type_name(payload.get("name"))
            if not name_value:
                return {"error": "missing_name"}, 400
            existing = get_printer_type_by_name(session, name_value)
            if existing is not None and existing.id != printer_type.id:
                return {"error": "name_exists"}, 409
            printer_type.name = name_value
        if "bed_size" in payload:
            printer_type.bed_size = clean_optional(payload.get("bed_size"))
        if "manufacturer" in payload:
            printer_type.manufacturer = clean_optional(payload.get("manufacturer"))
        if "gcode_prefix" in payload:
            printer_type.gcode_prefix = clean_optional(payload.get("gcode_prefix"))
        if "active" in payload:
            printer_type.active = normalize_stream_active(payload.get("active"), default=True)
        if "upload_gcode_active" in payload:
            printer_type.upload_gcode_active = normalize_stream_active(
                payload.get("upload_gcode_active"),
                default=False,
            )
        if "type_kind" in payload:
            printer_type.type_kind = clean_optional(payload.get("type_kind"))
        if "notes" in payload:
            printer_type.notes = clean_optional(payload.get("notes"))
        return printer_type_to_dict(printer_type)


@bp.delete("/api/printer-types/<int:type_id>")
def delete_printer_type(type_id: int):
    with session_scope() as session:
        printer_type = get_printer_type(session, type_id)
        if printer_type is None:
            return {"error": "not_found"}, 404
        session.delete(printer_type)
        return {"status": "deleted"}


@bp.get("/api/live-wall/status")
def live_wall_status():
    with session_scope() as session:
        printers = list_printers(session)
        enabled_printers = [printer for printer in printers if printer.enabled]
        snapshots = build_printer_snapshots(enabled_printers)
        total_printers = len(printers)
        name_map = {printer.id: printer.name for printer in enabled_printers}
    status_map = collect_printer_statuses(snapshots, include_plug=False)
    items = []
    total_print_time_today_seconds = 0.0
    total_print_time_total_seconds = 0.0
    total_print_jobs_today = 0
    total_print_jobs_total = 0
    for printer in snapshots:
        status = status_map.get(
            printer.id,
            {
                "label": "Unknown",
                "state": "muted",
                "temp_hotend": None,
                "temp_bed": None,
                "target_hotend": None,
                "target_bed": None,
                "job_name": None,
                "progress": None,
                "elapsed": None,
                "remaining": None,
                "error_message": None,
            },
        )
        items.append(
            {
                "id": printer.id,
                "name": name_map.get(printer.id),
                "status": status["label"],
                "status_state": status["state"],
                "temp_hotend": status.get("temp_hotend"),
                "temp_bed": status.get("temp_bed"),
                "target_hotend": status.get("target_hotend"),
                "target_bed": status.get("target_bed"),
                "job_name": status.get("job_name"),
                "progress": status.get("progress"),
                "elapsed": status.get("elapsed"),
                "remaining": status.get("remaining"),
                "error_message": status.get("error_message"),
            }
        )
    if snapshots:
        with session_scope() as session:
            printer_ids = [printer.id for printer in snapshots]
            printers = session.query(Printer).filter(Printer.id.in_(printer_ids)).all()
            total_print_time_today_seconds, total_print_time_total_seconds = update_print_time_totals(
                printers,
                status_map,
            )
            total_print_jobs_today = count_print_jobs_today(session)
            total_print_jobs_total = count_print_jobs(session)
            for printer in printers:
                status = status_map.get(printer.id, {})
                label = status.get("label")
                if isinstance(label, str) and "printing" in label.lower():
                    if (printer.print_check_status or "").strip().lower() != "check":
                        printer.print_check_status = "check"
            _flush_pending_uploads(session, status_map, name_map)
    else:
        with session_scope() as session:
            total_print_jobs_today = count_print_jobs_today(session)
            total_print_jobs_total = count_print_jobs(session)
    return {
        "items": items,
        "total_printers": total_printers,
        "total_print_time_today_seconds": total_print_time_today_seconds,
        "total_print_time_total_seconds": total_print_time_total_seconds,
        "total_print_jobs_today": total_print_jobs_today,
        "total_print_jobs_total": total_print_jobs_total,
    }


@bp.get("/api/live-wall/plug-status")
def live_wall_plug_status():
    with session_scope() as session:
        printers = [printer for printer in list_printers(session) if printer.enabled]
        snapshots = build_printer_snapshots(printers)
    status_map = collect_plug_statuses(snapshots)
    items = []
    for printer in snapshots:
        status = status_map.get(printer.id)
        if not status:
            continue
        items.append(
            {
                "id": printer.id,
                "plug_label": status.get("plug_label"),
                "plug_state": status.get("plug_state"),
            }
        )
    return {"items": items}


@bp.get("/api/printers/plug-energy")
def printers_plug_energy():
    with session_scope() as session:
        printers = list_printers(session)
        snapshots = build_printer_snapshots(printers)
    energy_map = collect_plug_energy(snapshots)
    items = []
    for printer in snapshots:
        if not printer.tasmota_host:
            continue
        energy = energy_map.get(printer.id, {})
        items.append(
            {
                "id": printer.id,
                "power_w": energy.get("power_w"),
                "today_wh": energy.get("today_wh"),
                "error": energy.get("error"),
            }
        )
    return {"items": items}


@bp.post("/api/net-scan")
def net_scan():
    return {"items": scan_local_network(), "scanned_at": datetime.now(timezone.utc).isoformat()}


@bp.get("/api/print-jobs")
def get_print_jobs():
    start_value = clean_optional(request.args.get("start_date"))
    end_value = clean_optional(request.args.get("end_date"))
    start_date = parse_iso_date(start_value) if start_value else None
    end_date = parse_iso_date(end_value) if end_value else None
    if (start_value and start_date is None) or (end_value and end_date is None):
        return {"error": "invalid_date"}, 400
    if start_date and end_date and start_date > end_date:
        return {"error": "invalid_date_range"}, 400
    with session_scope() as session:
        jobs = list_print_jobs(session, start_date=start_date, end_date=end_date)
        return {"items": [print_job_to_dict(job) for job in jobs]}


@bp.get("/api/printers/<int:printer_id>")
def get_printer_by_id(printer_id: int):
    with session_scope() as session:
        printer = get_printer(session, printer_id)
        if printer is None:
            return {"error": "not_found"}, 404
        return printer_to_dict(printer)


@bp.post("/api/printers")
def post_printer():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    for field in ("name", "backend", "host"):
        if not payload.get(field):
            return {"error": "missing_field", "field": field}, 400
    with session_scope() as session:
        has_group, group_id, error = normalize_group_id(payload, session)
        if error:
            return error, 400 if error.get("error") == "invalid_group_id" else 404
        if has_group:
            payload["group_id"] = group_id
        printer = create_printer(session, payload)
        return printer_to_dict(printer), 201


@bp.put("/api/printers/<int:printer_id>")
@bp.patch("/api/printers/<int:printer_id>")
def put_printer(printer_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    with session_scope() as session:
        printer = get_printer(session, printer_id)
        if printer is None:
            return {"error": "not_found"}, 404
        if "print_check_status" in payload:
            candidate = payload.get("print_check_status")
            clearing = False
            if isinstance(candidate, bool):
                clearing = candidate is False
            elif isinstance(candidate, str):
                cleaned = candidate.strip().lower().replace(" ", "").replace("_", "")
                clearing = cleaned in {"clear", "ok", "ready"}
            if clearing:
                status_map = collect_printer_statuses([printer], include_plug=False)
                status = status_map.get(printer.id, {})
                label = status.get("label")
                if isinstance(label, str) and "printing" in label.lower():
                    job_name = clean_optional(status.get("job_name")) or "unknown"
                    return {
                        "error": f'Cannot clear status while printing job "{job_name}".',
                        "code": "printer_busy",
                        "job_name": job_name,
                    }, 409
        has_group, group_id, error = normalize_group_id(payload, session)
        if error:
            return error, 400 if error.get("error") == "invalid_group_id" else 404
        if has_group:
            payload["group_id"] = group_id
        update_printer(session, printer, payload)
        return printer_to_dict(printer)


@bp.delete("/api/printers/<int:printer_id>")
def delete_printer_by_id(printer_id: int):
    with session_scope() as session:
        printer = get_printer(session, printer_id)
        if printer is None:
            return {"error": "not_found"}, 404
        delete_printer(session, printer)
        return {"status": "deleted"}


@bp.post("/api/printers/<int:printer_id>/upload-print")
def upload_print(printer_id: int):
    file = request.files.get("file")
    if not file or not file.filename:
        return {"error": "Missing file."}, 400
    content = file.read()
    if not content:
        return {"error": "Empty file."}, 400
    filename = file.filename
    print_via = normalize_print_via(
        request.form.get("print_via") or request.args.get("print_via") or "JustPrinting"
    )
    with session_scope() as session:
        printer = get_printer(session, printer_id)
        if printer is None:
            return {"error": "Printer not found."}, 404
        username = None
        user_id = flask_session.get("user_id")
        if user_id:
            session_user = get_user(session, int(user_id))
            if session_user is not None:
                username = clean_optional(session_user.username)
        username = username or "unknown"
        type_name = clean_optional(printer.printer_type)
        if not type_name:
            return {"error": "Upload not allowed for this printer type."}, 400
        printer_type = get_printer_type_by_name(session, type_name)
        if printer_type is None or not printer_type.upload_gcode_active:
            return {"error": "Upload not allowed for this printer type."}, 400
        check_status = clean_optional(getattr(printer, "print_check_status", None)) or "clear"
        if check_status.lower() != "clear":
            return {
                "error": "Printer check required before upload.",
                "code": "printer_check_required",
            }, 409
        status_map = collect_printer_statuses([printer], include_plug=False)
        status = status_map.get(printer.id, {})
        label = status.get("label")
        if isinstance(label, str) and "printing" in label.lower():
            job_name = clean_optional(status.get("job_name")) or "unknown"
            return {
                "error": f'Printer is currently printing job "{job_name}". Upload aborted.',
                "code": "printer_busy",
                "job_name": job_name,
            }, 409
        prefix = clean_optional(getattr(printer_type, "gcode_prefix", None))
        if prefix:
            filename_lower = filename.lower()
            prefix_lower = prefix.lower()
            if prefix_lower not in filename_lower:
                return {
                    "error": (
                        "WARNING: Filename does not contain the required g-Code prefix "
                        f"\"{prefix}\". Upload aborted."
                      )
                }, 400
        settings = ensure_settings_row(session)
        ok, message = upload_and_print(printer, filename, content, settings.upload_timeout)
        if not ok:
            if _confirm_print_started(printer, filename):
                ok = True
                message = "ok"
        if ok:
            printer.print_check_status = "check"
            create_print_job(
                session,
                gcode_filename=filename,
                printer_name=printer.name,
                username=username,
                print_via=print_via,
            )
            _discard_pending_upload(printer.id, filename)
        else:
            _record_pending_upload(
                printer.id,
                filename,
                printer.name,
                username,
                print_via,
            )
    if ok:
        return {"status": "ok"}
    error_map = {
        "api_key_missing": "API key missing for this printer.",
        "api_key_invalid": "API key invalid for this printer.",
        "auth_required": "Printer authentication required.",
        "unsupported_backend": "Unsupported backend for upload.",
        "upload_failed": "Upload failed.",
    }
    error_message = error_map.get(message, message or "Upload failed.")
    status_code = 400 if message in {"api_key_missing", "api_key_invalid", "auth_required", "unsupported_backend"} else 502
    return {"error": error_message}, status_code


@bp.get("/api/users")
def get_users():
    with session_scope() as db_session:
        users = list_users(db_session)
        return {"items": [user_to_dict(user) for user in users]}


@bp.get("/api/users/export")
def export_users():
    with session_scope() as db_session:
        users = list_users(db_session)
        items = []
        for user in users:
            data = user_to_dict(user)
            data["password_hash"] = user.password_hash
            items.append(data)
        return {"items": items}


@bp.post("/api/users/import")
def import_users():
    payload = request.get_json(silent=True) or {}
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = payload.get("items") or payload.get("users")
    else:
        items = None
    if not isinstance(items, list):
        return {"error": "invalid_json"}, 400
    created = 0
    skipped = 0
    invalid = 0
    with session_scope() as db_session:
        existing_users = list_users(db_session)
        existing_usernames = {user.username.lower() for user in existing_users if user.username}
        first_user = not existing_users
        for raw in items:
            if not isinstance(raw, dict):
                invalid += 1
                continue
            username = clean_optional(raw.get("username"))
            if not username:
                invalid += 1
                continue
            username_key = username.lower()
            if username_key in existing_usernames:
                skipped += 1
                continue
            password_hash = clean_optional(raw.get("password_hash"))
            if not password_hash:
                password = raw.get("password")
                if not isinstance(password, str) or not password:
                    invalid += 1
                    continue
                password_hash = hash_password(password)
            role = normalize_role(raw.get("role"))
            if raw.get("role") is not None and role is None:
                invalid += 1
                continue
            if first_user:
                role = "superadmin"
                first_user = False
            if role is None:
                role = "user"
            create_user(
                db_session,
                username,
                password_hash,
                role=role,
                first_name=clean_optional(raw.get("first_name")),
                last_name=clean_optional(raw.get("last_name")),
                email=clean_optional(raw.get("email")),
                notes=clean_optional(raw.get("notes")),
            )
            existing_usernames.add(username_key)
            created += 1
    return {"created": created, "skipped": skipped, "invalid": invalid}


@bp.post("/api/users")
def post_user():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    role = normalize_role(payload.get("role"))
    first_name = clean_optional(payload.get("first_name"))
    last_name = clean_optional(payload.get("last_name"))
    email = clean_optional(payload.get("email"))
    notes = clean_optional(payload.get("notes"))
    if not username or not password:
        return {"error": "missing_field"}, 400
    if payload.get("role") is not None and role is None:
        return {"error": "invalid_role"}, 400
    with session_scope() as db_session:
        existing = get_user_by_username(db_session, username)
        if existing is not None:
            return {"error": "username_exists"}, 409
        first_user = not has_users(db_session)
        if first_user:
            role = "superadmin"
        if role is None:
            role = "user"
        user = create_user(
            db_session,
            username,
            hash_password(password),
            role=role,
            first_name=first_name,
            last_name=last_name,
            email=email,
            notes=notes,
        )
        return user_to_dict(user), 201


@bp.get("/api/users/<int:user_id>")
def get_user_by_id(user_id: int):
    with session_scope() as db_session:
        user = get_user(db_session, user_id)
        if user is None:
            return {"error": "not_found"}, 404
        return user_to_dict(user)


@bp.delete("/api/users/<int:user_id>")
def delete_user_by_id(user_id: int):
    with session_scope() as db_session:
        user = get_user(db_session, user_id)
        if user is None:
            return {"error": "not_found"}, 404
        if user.role == "superadmin":
            return {"error": "forbidden"}, 403
        db_session.delete(user)
        return {"status": "deleted"}


@bp.put("/api/users/<int:user_id>")
@bp.patch("/api/users/<int:user_id>")
def update_user_by_id(user_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    new_username = clean_optional(payload.get("username"))
    if "username" in payload and new_username is None:
        return {"error": "missing_field", "field": "username"}, 400
    role = normalize_role(payload.get("role"))
    if payload.get("role") is not None and role is None:
        return {"error": "invalid_role"}, 400
    with session_scope() as db_session:
        user = get_user(db_session, user_id)
        if user is None:
            return {"error": "not_found"}, 404
        if new_username is not None and new_username != user.username:
            existing = get_user_by_username(db_session, new_username)
            if existing is not None and existing.id != user.id:
                return {"error": "username_exists"}, 409
            user.username = new_username
        if "role" in payload and role:
            user.role = role
        if "first_name" in payload:
            user.first_name = clean_optional(payload.get("first_name"))
        if "last_name" in payload:
            user.last_name = clean_optional(payload.get("last_name"))
        if "email" in payload:
            user.email = clean_optional(payload.get("email"))
        if "notes" in payload:
            user.notes = clean_optional(payload.get("notes"))
        password = payload.get("password") or ""
        if password:
            user.password_hash = hash_password(password)
        return user_to_dict(user)


@bp.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        return {"error": "missing_field"}, 400
    with session_scope() as db_session:
        user = get_user_by_username(db_session, username)
        if user is None or not verify_password(user.password_hash, password):
            return {"error": "invalid_credentials"}, 401
        flask_session["user_id"] = user.id
        return {"status": "ok", "user": user_to_dict(user)}


@bp.post("/api/auth/logout")
def logout():
    flask_session.pop("user_id", None)
    return {"status": "ok"}


@bp.get("/api/auth/me")
def auth_me():
    user_id = flask_session.get("user_id")
    if not user_id:
        return {"error": "not_authenticated"}, 401
    with session_scope() as db_session:
        user = get_user(db_session, int(user_id))
        if user is None:
            flask_session.pop("user_id", None)
            return {"error": "not_authenticated"}, 401
        return {"user": user_to_dict(user)}


@bp.get("/api/docs")
def api_docs():
    return {
        "endpoints": [
            {"method": "GET", "path": "/api/settings"},
            {"method": "PUT", "path": "/api/settings"},
            {"method": "PATCH", "path": "/api/settings"},
            {"method": "GET", "path": "/api/live-wall/status"},
            {"method": "GET", "path": "/api/live-wall/plug-status"},
            {"method": "GET", "path": "/api/printers/plug-energy"},
            {"method": "GET", "path": "/api/print-jobs"},
            {"method": "GET", "path": "/api/printers"},
            {"method": "POST", "path": "/api/printers"},
            {"method": "GET", "path": "/api/printers/{id}"},
            {"method": "PUT", "path": "/api/printers/{id}"},
            {"method": "PATCH", "path": "/api/printers/{id}"},
            {"method": "DELETE", "path": "/api/printers/{id}"},
            {"method": "GET", "path": "/api/printer-groups"},
            {"method": "GET", "path": "/api/printer-groups/export"},
            {"method": "POST", "path": "/api/printer-groups/import"},
            {"method": "POST", "path": "/api/printer-groups"},
            {"method": "PUT", "path": "/api/printer-groups/{id}"},
            {"method": "PATCH", "path": "/api/printer-groups/{id}"},
            {"method": "DELETE", "path": "/api/printer-groups/{id}"},
            {"method": "GET", "path": "/api/printer-types"},
            {"method": "GET", "path": "/api/printer-types/export"},
            {"method": "POST", "path": "/api/printer-types/import"},
            {"method": "POST", "path": "/api/printer-types"},
            {"method": "PUT", "path": "/api/printer-types/{id}"},
            {"method": "PATCH", "path": "/api/printer-types/{id}"},
            {"method": "DELETE", "path": "/api/printer-types/{id}"},
            {"method": "GET", "path": "/api/users"},
            {"method": "GET", "path": "/api/users/export"},
            {"method": "POST", "path": "/api/users/import"},
            {"method": "POST", "path": "/api/users"},
            {"method": "GET", "path": "/api/users/{id}"},
            {"method": "DELETE", "path": "/api/users/{id}"},
            {"method": "PUT", "path": "/api/users/{id}"},
            {"method": "PATCH", "path": "/api/users/{id}"},
            {"method": "POST", "path": "/api/auth/login"},
            {"method": "POST", "path": "/api/auth/logout"},
            {"method": "GET", "path": "/api/auth/me"},
        ]
    }


@bp.get("/docs")
def docs_page():
    return render_template("docs.html")


@bp.get("/live-wall/stream/<int:stream_id>.mjpg")
def live_wall_stream(stream_id: int):
    if stream_id not in {1, 2, 3, 4}:
        return {"error": "not_found"}, 404
    if shutil.which("ffmpeg") is None:
        return {"error": "ffmpeg_missing"}, 503
    with session_scope() as db_session:
        settings = ensure_settings_row(db_session)
        active = getattr(settings, f"kiosk_stream_active_{stream_id}", True)
        if not active:
            return {"error": "not_active"}, 404
        rtsp_url = build_rtsp_url_from_settings(settings, stream_id)
    if not rtsp_url:
        return {"error": "not_configured"}, 404
    return Response(
        stream_with_context(iter_mjpeg_stream(rtsp_url)),
        mimetype="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@bp.get("/printers")
def printers_page():
    return render_template("printers.html")


@bp.get("/printer-groups")
def printer_groups_page():
    return render_template("printer_groups.html")


@bp.get("/printer-types")
def printer_types_page():
    return render_template("printer_types.html")


@bp.get("/logs")
def logs_page():
    return render_template("logs.html")


@bp.get("/users")
def users_page():
    with session_scope() as db_session:
        first_user = not has_users(db_session)
    return render_template("users.html", first_user=first_user)


@bp.get("/settings")
def settings_page():
    return render_template("settings.html")


@bp.get("/live-wall")
def live_wall_page():
    with session_scope() as db_session:
        settings = ensure_settings_row(db_session)
        settings_data = settings_to_dict(settings)
        printers = list_printers(db_session)
        active_printers = build_live_wall_printers(printers)
    config = build_live_wall_config(settings_data)
    return render_template(
        "live_wall.html",
        live_wall=config,
        active_printers=active_printers,
    )


@bp.get("/login")
def login_page():
    with session_scope() as db_session:
        first_user = not has_users(db_session)
    return render_template("login.html", first_user=first_user)


@bp.get("/logout")
def logout_page():
    flask_session.pop("user_id", None)
    return redirect(url_for("web.login_page"))
