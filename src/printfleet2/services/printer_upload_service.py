import json
import mimetypes
import ssl
import urllib.error
import urllib.request
from uuid import uuid4

from printfleet2.models.printer import Printer


DEFAULT_UPLOAD_TIMEOUT = 120
USER_AGENT = "PrintFleet2 Upload"


def upload_and_print(
    printer: Printer,
    filename: str,
    content: bytes,
    upload_timeout: int | float | None = None,
) -> tuple[bool, str]:
    backend = (printer.backend or "").strip().lower()
    if backend == "octoprint":
        return _upload_octoprint(printer, filename, content, upload_timeout)
    if backend == "moonraker":
        return _upload_moonraker(printer, filename, content, upload_timeout)
    return False, "unsupported_backend"


def _upload_octoprint(
    printer: Printer, filename: str, content: bytes, upload_timeout: int | float | None
) -> tuple[bool, str]:
    if not printer.api_key:
        return False, "api_key_missing"
    url = f"{_printer_base_url(printer)}/api/files/local"
    fields = {"select": "true", "print": "true"}
    status, payload = _post_multipart(
        url,
        headers={"User-Agent": USER_AGENT, "X-Api-Key": printer.api_key},
        fields=fields,
        filename=filename,
        content=content,
        timeout=upload_timeout,
    )
    if _is_success_status(status):
        return True, "ok"
    if status in {401, 403}:
        return False, "api_key_invalid"
    message = _extract_error(payload)
    return False, message or "upload_failed"


def _upload_moonraker(
    printer: Printer, filename: str, content: bytes, upload_timeout: int | float | None
) -> tuple[bool, str]:
    url = f"{_printer_base_url(printer)}/server/files/upload"
    headers = {"User-Agent": USER_AGENT}
    if printer.token:
        headers["Authorization"] = f"Bearer {printer.token}"
        headers["X-Api-Key"] = printer.token
    fields = {"print": "true"}
    status, payload = _post_multipart(
        url,
        headers=headers,
        fields=fields,
        filename=filename,
        content=content,
        timeout=upload_timeout,
    )
    if _is_success_status(status):
        return True, "ok"
    if status in {401, 403}:
        return False, "auth_required"
    message = _extract_error(payload)
    return False, message or "upload_failed"


def _post_multipart(
    url: str,
    headers: dict,
    fields: dict,
    filename: str,
    content: bytes,
    timeout: int | float | None,
) -> tuple[int | None, bytes | None]:
    boundary = uuid4().hex
    body = _encode_multipart(fields, filename, content, boundary)
    request_headers = {
        **headers,
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }
    request = urllib.request.Request(url, data=body, headers=request_headers, method="POST")
    try:
        context = ssl._create_unverified_context() if url.startswith("https://") else None
        with urllib.request.urlopen(
            request, timeout=_resolve_timeout(timeout), context=context
        ) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except Exception:
        return None, None


def _is_success_status(status: int | None) -> bool:
    return status is not None and 200 <= status < 300


def _resolve_timeout(timeout: int | float | None) -> float:
    if timeout is None:
        return float(DEFAULT_UPLOAD_TIMEOUT)
    try:
        parsed = float(timeout)
    except (TypeError, ValueError):
        return float(DEFAULT_UPLOAD_TIMEOUT)
    if parsed <= 0:
        return float(DEFAULT_UPLOAD_TIMEOUT)
    return parsed


def _encode_multipart(fields: dict, filename: str, content: bytes, boundary: str) -> bytes:
    mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(f"--{boundary}\r\n".encode("utf-8"))
        parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        parts.append(str(value).encode("utf-8"))
        parts.append(b"\r\n")
    safe_name = filename.replace("\\", "_").replace("/", "_")
    parts.append(f"--{boundary}\r\n".encode("utf-8"))
    parts.append(
        f'Content-Disposition: form-data; name="file"; filename="{safe_name}"\r\n'.encode("utf-8")
    )
    parts.append(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
    parts.append(content)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts)


def _extract_error(payload: bytes | None) -> str | None:
    if not payload:
        return None
    try:
        data = json.loads(payload.decode("utf-8", errors="ignore"))
    except Exception:
        return None
    if isinstance(data, dict):
        error = data.get("error")
        if isinstance(error, dict):
            message = error.get("message") or error.get("error")
            if message:
                return str(message)
        if isinstance(error, str):
            return error
        message = data.get("message")
        if isinstance(message, str) and message.strip():
            return message
    return None


def _printer_base_url(printer: Printer) -> str:
    scheme = "https" if printer.https else "http"
    return f"{scheme}://{printer.host}:{printer.port}"
