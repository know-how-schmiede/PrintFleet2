import concurrent.futures
import json
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Iterable

from printfleet2.models.printer import Printer


REQUEST_TIMEOUT = 1.2
USER_AGENT = "PrintFleet2 Status"


@dataclass(frozen=True)
class PrinterSnapshot:
    id: int
    backend: str | None
    host: str
    port: int
    https: bool
    scanning: bool
    token: str | None
    api_key: str | None
    tasmota_host: str | None


def _fetch_json(url: str, headers: dict) -> tuple[int | None, dict | None]:
    try:
        context = None
        if url.startswith("https://"):
            context = ssl._create_unverified_context()
        request = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT, context=context) as response:
            data = response.read(8192)
            payload = json.loads(data.decode("utf-8", errors="ignore"))
            return response.status, payload
    except urllib.error.HTTPError as exc:
        return exc.code, None
    except Exception:
        return None, None


def _coerce_temp(value: object | None) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number


def _status(
    label: str,
    state: str,
    hotend: float | None = None,
    bed: float | None = None,
    job_name: str | None = None,
    progress: float | None = None,
    elapsed: float | None = None,
    remaining: float | None = None,
    error_message: str | None = None,
    plug_label: str | None = None,
    plug_state: str | None = None,
    target_hotend: float | None = None,
    target_bed: float | None = None,
) -> dict:
    return {
        "label": label,
        "state": state,
        "temp_hotend": hotend,
        "temp_bed": bed,
        "target_hotend": target_hotend,
        "target_bed": target_bed,
        "job_name": job_name,
        "progress": progress,
        "elapsed": elapsed,
        "remaining": remaining,
        "error_message": error_message,
        "plug_label": plug_label,
        "plug_state": plug_state,
    }


def _extract_moonraker_status(payload: dict | None) -> dict:
    if not isinstance(payload, dict):
        return {}
    result = payload.get("result")
    if not isinstance(result, dict):
        return {}
    status = result.get("status")
    if not isinstance(status, dict):
        return {}
    return status


def _extract_moonraker_temps(status: dict) -> tuple[float | None, float | None, float | None, float | None]:
    hotend = None
    hotend_target = None
    for key, data in status.items():
        if not key.startswith("extruder") or not isinstance(data, dict):
            continue
        hotend = _coerce_temp(data.get("temperature"))
        hotend_target = _coerce_temp(data.get("target"))
        if hotend is not None or hotend_target is not None:
            break
    bed = None
    bed_target = None
    bed_data = status.get("heater_bed")
    if isinstance(bed_data, dict):
        bed = _coerce_temp(bed_data.get("temperature"))
        bed_target = _coerce_temp(bed_data.get("target"))
    return hotend, bed, hotend_target, bed_target


def _extract_moonraker_job(status: dict) -> tuple[str | None, float | None, float | None, float | None, str | None]:
    print_stats = status.get("print_stats")
    if not isinstance(print_stats, dict):
        return None, None, None, None, None
    job_name = print_stats.get("filename")
    elapsed = _coerce_temp(print_stats.get("print_duration"))
    progress = None
    progress_fraction = None
    progress_source = status.get("virtual_sdcard")
    if not isinstance(progress_source, dict):
        progress_source = status.get("display_status") if isinstance(status.get("display_status"), dict) else None
    if isinstance(progress_source, dict):
        raw_progress = _coerce_temp(progress_source.get("progress"))
        if raw_progress is not None:
            progress_fraction = raw_progress if raw_progress <= 1 else raw_progress / 100
            progress = progress_fraction * 100
    remaining = None
    if progress_fraction is not None and elapsed is not None and progress_fraction > 0:
        remaining = elapsed * (1 - progress_fraction) / progress_fraction
    error_message = None
    state = print_stats.get("state")
    if isinstance(state, str) and state.strip().lower() == "error":
        error_message = print_stats.get("message")
    return job_name, progress, elapsed, remaining, error_message


def _normalize_job_state(state: str | None) -> tuple[str | None, str | None]:
    if not state:
        return None, None
    normalized = state.strip().lower().replace("_", " ")
    mapping = {
        "printing": ("Printing", "ok"),
        "paused": ("Paused", "warn"),
        "pausing": ("Pausing", "warn"),
        "resuming": ("Resuming", "ok"),
        "cancelled": ("Cancelled", "warn"),
        "canceled": ("Cancelled", "warn"),
        "complete": ("Complete", "ok"),
        "completed": ("Complete", "ok"),
        "error": ("Error", "error"),
        "ready": ("Ready", "ok"),
        "standby": ("Standby", "ok"),
        "offline": ("Offline", "error"),
        "operational": ("Operational", "ok"),
    }
    if normalized in mapping:
        return mapping[normalized]
    return state, None


def _extract_octoprint_temps(payload: dict | None) -> tuple[float | None, float | None, float | None, float | None]:
    if not isinstance(payload, dict):
        return None, None, None, None
    temperature = payload.get("temperature")
    if not isinstance(temperature, dict):
        return None, None, None, None
    hotend = None
    hotend_target = None
    tool0 = temperature.get("tool0")
    if isinstance(tool0, dict):
        hotend = _coerce_temp(tool0.get("actual"))
        hotend_target = _coerce_temp(tool0.get("target"))
    if hotend is None:
        for key, data in temperature.items():
            if not key.startswith("tool") or not isinstance(data, dict):
                continue
            hotend = _coerce_temp(data.get("actual"))
            hotend_target = _coerce_temp(data.get("target"))
            if hotend is not None or hotend_target is not None:
                break
    bed = None
    bed_target = None
    bed_data = temperature.get("bed")
    if isinstance(bed_data, dict):
        bed = _coerce_temp(bed_data.get("actual"))
        bed_target = _coerce_temp(bed_data.get("target"))
    return hotend, bed, hotend_target, bed_target


def _moonraker_status(printer: PrinterSnapshot, plug_label: str | None, plug_state: str | None) -> dict:
    headers = {"User-Agent": USER_AGENT}
    if printer.token:
        headers["Authorization"] = f"Bearer {printer.token}"
        headers["X-Api-Key"] = printer.token
    url = f"{_printer_base_url(printer)}/printer/info"
    status_code, payload = _fetch_json(url, headers)
    if status_code in {401, 403}:
        return _status("Auth required", "warn", plug_label=plug_label, plug_state=plug_state)
    if not payload or status_code is None:
        return _status("Offline", "error", plug_label=plug_label, plug_state=plug_state)
    result = payload.get("result") if isinstance(payload, dict) else None
    objects_payload = _fetch_json(
        f"{_printer_base_url(printer)}/printer/objects/query?"
        "print_stats=state,filename,print_duration,total_duration,message&"
        "virtual_sdcard=progress&display_status=progress&"
        "extruder=temperature,target&heater_bed=temperature,target",
        headers,
    )[1]
    status = _extract_moonraker_status(objects_payload)
    hotend, bed, target_hotend, target_bed = _extract_moonraker_temps(status)
    job_name, progress, elapsed, remaining, error_message = _extract_moonraker_job(status)
    job_state = None
    print_stats = status.get("print_stats")
    if isinstance(print_stats, dict):
        job_state = print_stats.get("state")
    job_label, job_class = _normalize_job_state(job_state if isinstance(job_state, str) else None)
    if not error_message and isinstance(result, dict):
        state_message = result.get("state_message")
        state = result.get("state")
        if isinstance(state, str) and state.strip().lower() == "error":
            error_message = state_message or "Error"
        elif isinstance(state_message, str) and "error" in state_message.lower():
            error_message = state_message
    if isinstance(result, dict):
        label = job_label or result.get("state_message") or result.get("state")
        status_class = job_class or "ok"
        if label:
            return _status(
                str(label),
                status_class,
                hotend,
                bed,
                job_name,
                progress,
                elapsed,
                remaining,
                error_message,
                plug_label=plug_label,
                plug_state=plug_state,
                target_hotend=target_hotend,
                target_bed=target_bed,
            )
    return _status(
        job_label or "Online",
        job_class or "ok",
        hotend,
        bed,
        job_name,
        progress,
        elapsed,
        remaining,
        error_message,
        plug_label=plug_label,
        plug_state=plug_state,
        target_hotend=target_hotend,
        target_bed=target_bed,
    )


def _octoprint_status(printer: PrinterSnapshot, plug_label: str | None, plug_state: str | None) -> dict:
    if not printer.api_key:
        return _status("API key missing", "warn", plug_label=plug_label, plug_state=plug_state)
    headers = {"User-Agent": USER_AGENT, "X-Api-Key": printer.api_key}
    url = f"{_printer_base_url(printer)}/api/printer"
    status_code, payload = _fetch_json(url, headers)
    if status_code in {401, 403}:
        return _status("API key invalid", "warn", plug_label=plug_label, plug_state=plug_state)
    if not payload or status_code is None:
        return _status("Offline", "error", plug_label=plug_label, plug_state=plug_state)
    hotend, bed, target_hotend, target_bed = _extract_octoprint_temps(payload if isinstance(payload, dict) else None)
    job_payload = _fetch_json(f"{_printer_base_url(printer)}/api/job", headers)[1]
    job_name = None
    progress = None
    elapsed = None
    remaining = None
    if isinstance(job_payload, dict):
        job = job_payload.get("job")
        if isinstance(job, dict):
            file_info = job.get("file")
            if isinstance(file_info, dict):
                job_name = file_info.get("name") or file_info.get("path")
        progress_info = job_payload.get("progress")
        if isinstance(progress_info, dict):
            progress = _coerce_temp(progress_info.get("completion"))
            elapsed = _coerce_temp(progress_info.get("printTime"))
            remaining = _coerce_temp(progress_info.get("printTimeLeft"))
    if remaining is None and elapsed is not None and progress is not None and progress > 0:
        remaining = elapsed * (100 - progress) / progress
    job_state = None
    if isinstance(job_payload, dict):
        job_state = job_payload.get("state")
    job_label, job_class = _normalize_job_state(job_state if isinstance(job_state, str) else None)
    error_message = None
    if isinstance(payload, dict):
        state = payload.get("state")
        if isinstance(state, dict):
            flags = state.get("flags")
            if isinstance(flags, dict) and flags.get("error"):
                error_message = state.get("text") or "Error"
            if not error_message and isinstance(state.get("text"), str) and "error" in state.get("text", "").lower():
                error_message = state.get("text")
        if isinstance(state, dict) and state.get("text"):
            return _status(
                job_label or str(state["text"]),
                job_class or "ok",
                hotend,
                bed,
                job_name,
                progress,
                elapsed,
                remaining,
                error_message,
                plug_label=plug_label,
                plug_state=plug_state,
                target_hotend=target_hotend,
                target_bed=target_bed,
            )
    return _status(
        job_label or "Online",
        job_class or "ok",
        hotend,
        bed,
        job_name,
        progress,
        elapsed,
        remaining,
        error_message,
        plug_label=plug_label,
        plug_state=plug_state,
        target_hotend=target_hotend,
        target_bed=target_bed,
    )


def _printer_base_url(printer: PrinterSnapshot) -> str:
    scheme = "https" if printer.https else "http"
    return f"{scheme}://{printer.host}:{printer.port}"


def _tasmota_base_url(host: str) -> str:
    base = host.strip()
    if not base:
        return ""
    if any(char.isspace() for char in base):
        return ""
    if base.startswith(("http://", "https://")):
        return base.rstrip("/")
    return f"http://{base}".rstrip("/")


def _tasmota_status(printer: PrinterSnapshot) -> tuple[str, str]:
    if not printer.tasmota_host:
        return "Plug missing", "muted"
    base_url = _tasmota_base_url(printer.tasmota_host)
    if not base_url:
        return "Plug invalid", "muted"
    try:
        url = f"{base_url}/cm?cmnd=Power"
        status_code, payload = _fetch_json(url, {"User-Agent": USER_AGENT})
        if status_code in {401, 403}:
            return "Plug auth", "warn"
        if not payload or status_code is None:
            return "Plug offline", "error"
        if isinstance(payload, dict):
            for key, value in payload.items():
                if not str(key).upper().startswith("POWER"):
                    continue
                state = str(value).strip().upper()
                if state == "ON":
                    return "Plug on", "ok"
                if state == "OFF":
                    return "Plug off", "muted"
                return f"Plug {state.lower()}", "warn"
        return "Plug unknown", "muted"
    except Exception:
        return "Plug error", "muted"


def _extract_tasmota_energy(payload: dict | None) -> tuple[float | None, float | None]:
    if not isinstance(payload, dict):
        return None, None

    def read_energy(data: dict | None) -> tuple[float | None, float | None]:
        if not isinstance(data, dict):
            return None, None
        energy = data.get("ENERGY")
        if not isinstance(energy, dict):
            return None, None
        power = _coerce_temp(energy.get("Power"))
        today = _coerce_temp(energy.get("Today"))
        return power, today

    for key in ("StatusSNS", "StatusSTS", "Status", "ENERGY"):
        power, today = read_energy(payload if key == "ENERGY" else payload.get(key))
        if power is not None or today is not None:
            return power, today
    return None, None


def _tasmota_energy(printer: PrinterSnapshot) -> dict:
    if not printer.tasmota_host:
        return {"power_w": None, "today_wh": None, "error": "missing"}
    base_url = _tasmota_base_url(printer.tasmota_host)
    if not base_url:
        return {"power_w": None, "today_wh": None, "error": "invalid"}
    last_status = None
    for command in ("Status%208", "Status%200"):
        try:
            url = f"{base_url}/cm?cmnd={command}"
            status_code, payload = _fetch_json(url, {"User-Agent": USER_AGENT})
            last_status = status_code
            if status_code in {401, 403}:
                return {"power_w": None, "today_wh": None, "error": "auth"}
            if not payload or status_code is None:
                continue
            power, today_kwh = _extract_tasmota_energy(payload)
            if power is None and today_kwh is None:
                continue
            today_wh = today_kwh * 1000 if today_kwh is not None else None
            return {"power_w": power, "today_wh": today_wh, "error": None}
        except Exception:
            return {"power_w": None, "today_wh": None, "error": "error"}
    if last_status is None:
        return {"power_w": None, "today_wh": None, "error": "offline"}
    return {"power_w": None, "today_wh": None, "error": "unavailable"}


def get_printer_status(printer: PrinterSnapshot, include_plug: bool = True) -> dict:
    plug_label = None
    plug_state = None
    if include_plug and printer.tasmota_host:
        try:
            plug_label, plug_state = _tasmota_status(printer)
        except Exception:
            plug_label, plug_state = "Plug error", "muted"
    if not printer.scanning:
        return _status("Scanning off", "muted", plug_label=plug_label, plug_state=plug_state)
    backend = (printer.backend or "").strip().lower()
    if backend == "moonraker":
        return _moonraker_status(printer, plug_label, plug_state)
    if backend == "octoprint":
        return _octoprint_status(printer, plug_label, plug_state)
    return _status("Unsupported", "muted", plug_label=plug_label, plug_state=plug_state)


def build_printer_snapshots(printers: Iterable[Printer | PrinterSnapshot]) -> list[PrinterSnapshot]:
    snapshots: list[PrinterSnapshot] = []
    for printer in printers:
        if isinstance(printer, PrinterSnapshot):
            snapshots.append(printer)
            continue
        snapshots.append(
            PrinterSnapshot(
                id=printer.id,
                backend=printer.backend,
                host=printer.host,
                port=printer.port,
                https=printer.https,
                scanning=printer.scanning if printer.scanning is not None else True,
                token=printer.token,
                api_key=printer.api_key,
                tasmota_host=printer.tasmota_host,
            )
        )
    return snapshots


def collect_printer_statuses(
    printers: Iterable[Printer | PrinterSnapshot],
    include_plug: bool = True,
) -> dict[int, dict]:
    status_map: dict[int, dict] = {}
    snapshots = build_printer_snapshots(printers)
    if not snapshots:
        return status_map
    max_workers = min(16, max(1, len(snapshots)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(get_printer_status, printer, include_plug): printer.id
            for printer in snapshots
        }
        for future in concurrent.futures.as_completed(futures):
            printer_id = futures[future]
            try:
                status_map[printer_id] = future.result()
            except Exception as exc:
                status_map[printer_id] = _status("Status error", "error", error_message=str(exc))
    return status_map


def collect_plug_statuses(printers: Iterable[Printer | PrinterSnapshot]) -> dict[int, dict]:
    status_map: dict[int, dict] = {}
    snapshots = [
        snapshot
        for snapshot in build_printer_snapshots(printers)
        if snapshot.tasmota_host
    ]
    if not snapshots:
        return status_map
    max_workers = min(16, max(1, len(snapshots)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_tasmota_status, printer): printer.id for printer in snapshots}
        for future in concurrent.futures.as_completed(futures):
            printer_id = futures[future]
            try:
                label, state = future.result()
                status_map[printer_id] = {"plug_label": label, "plug_state": state}
            except Exception:
                status_map[printer_id] = {"plug_label": "Plug error", "plug_state": "muted"}
    return status_map


def collect_plug_energy(printers: Iterable[Printer | PrinterSnapshot]) -> dict[int, dict]:
    energy_map: dict[int, dict] = {}
    snapshots = [
        snapshot
        for snapshot in build_printer_snapshots(printers)
        if snapshot.tasmota_host
    ]
    if not snapshots:
        return energy_map
    max_workers = min(16, max(1, len(snapshots)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_tasmota_energy, printer): printer.id for printer in snapshots}
        for future in concurrent.futures.as_completed(futures):
            printer_id = futures[future]
            try:
                energy_map[printer_id] = future.result()
            except Exception:
                energy_map[printer_id] = {"power_w": None, "today_wh": None, "error": "error"}
    return energy_map
