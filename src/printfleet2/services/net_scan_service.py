import concurrent.futures
import ipaddress
import json
import re
import socket
import ssl
import urllib.request


HTTP_TIMEOUT = 0.6
SCAN_PORTS = (80, 443, 5000, 7125, 8080, 3030)
USER_AGENT = "PrintFleet2 NetScan"


def _get_local_ipv4_networks() -> list[ipaddress.IPv4Network]:
    addresses: set[str] = set()
    try:
        addresses.add(socket.gethostbyname(socket.gethostname()))
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addresses.add(info[4][0])
    except OSError:
        pass
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        addresses.add(sock.getsockname()[0])
        sock.close()
    except OSError:
        pass

    networks: list[ipaddress.IPv4Network] = []
    for addr in addresses:
        if addr.startswith(("127.", "169.254.")):
            continue
        try:
            networks.append(ipaddress.ip_network(f"{addr}/24", strict=False))
        except ValueError:
            continue

    unique: list[ipaddress.IPv4Network] = []
    seen: set[str] = set()
    for network in networks:
        key = str(network)
        if key in seen:
            continue
        seen.add(key)
        unique.append(network)
    return unique


def _build_url(scheme: str, host: str, port: int) -> str:
    default_port = 443 if scheme == "https" else 80
    port_part = "" if port == default_port else f":{port}"
    return f"{scheme}://{host}{port_part}"


def _fetch_url(host: str, port: int, scheme: str, path: str) -> tuple[str, dict, int] | None:
    url = f"{scheme}://{host}:{port}{path}"
    headers = {"User-Agent": USER_AGENT}
    context = None
    if scheme == "https":
        context = ssl._create_unverified_context()
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT, context=context) as response:
            data = response.read(8192)
            text = data.decode("utf-8", errors="ignore")
            return text, dict(response.headers), response.status
    except Exception:
        return None


def _fetch_json(host: str, port: int, scheme: str, path: str) -> dict | None:
    response = _fetch_url(host, port, scheme, path)
    if not response:
        return None
    body, _headers, status = response
    if status < 200 or status >= 300:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


def _extract_title(body: str) -> str | None:
    match = re.search(r"<title>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    title = re.sub(r"\s+", " ", match.group(1)).strip()
    return title or None


def _detect_neptune(text: str) -> tuple[str, str] | None:
    if not text:
        return None
    lower = text.lower()
    if "neptune" not in lower:
        return None
    match = re.search(r"neptune[-_\s]*4[-_\s]*(plus|pro|max)?", lower)
    if match:
        variant = match.group(1)
        label = "Elegoo Neptune 4"
        if variant:
            label = f"Elegoo Neptune 4 {variant.title()}"
        return "elegoo-neptune", label
    return "elegoo-neptune", "Elegoo Neptune"


def _detect_from_html(body: str, headers: dict) -> tuple[str, str] | None:
    lower = body.lower()
    server = str(headers.get("Server", "")).lower()
    if "tasmota" in server or "tasmota" in lower:
        return "tasmota", "Tasmota Steckdose"
    if "octoprint" in lower:
        return "octoprint", "OctoPrint"
    neptune = _detect_neptune(body)
    if neptune:
        return neptune
    if "elegoo" in lower and ("mainsail" in lower or "fluidd" in lower or "klipper" in lower):
        return "elegoo-neptune", "Elegoo Neptune"
    if "mainsail" in lower:
        return "moonraker", "Mainsail (Moonraker)"
    if "fluidd" in lower:
        return "moonraker", "Fluidd (Moonraker)"
    if "elegoo" in lower or "centauri" in lower or "centurio" in lower:
        return "elegoo-centurio-carbon", "Elegoo Centurio Carbon"
    return None


def _scan_target(host: str, port: int) -> list[dict]:
    scheme = "https" if port == 443 else "http"
    if port == 7125:
        info = _fetch_json(host, port, scheme, "/server/info")
        result = info.get("result") if isinstance(info, dict) else None
        if isinstance(result, dict) and ("moonraker_version" in result or "klippy_connected" in result):
            name = None
            system_info = result.get("system_info")
            if isinstance(system_info, dict):
                name = system_info.get("hostname")
            neptune = _detect_neptune(name or "")
            dtype, label = ("moonraker", "Moonraker")
            if neptune:
                dtype, label = neptune
            return [
                {
                    "type": dtype,
                    "label": label,
                    "host": host,
                    "port": port,
                    "scheme": scheme,
                    "url": _build_url(scheme, host, port),
                    "name": name,
                }
            ]
        return []

    response = _fetch_url(host, port, scheme, "/")
    if not response:
        return []
    body, headers, status = response
    if status < 200 or status >= 500:
        return []
    detected = _detect_from_html(body, headers)
    if not detected:
        return []
    dtype, label = detected
    return [
        {
            "type": dtype,
            "label": label,
            "host": host,
            "port": port,
            "scheme": scheme,
            "url": _build_url(scheme, host, port),
            "name": _extract_title(body),
        }
    ]


def scan_local_network() -> list[dict]:
    networks = _get_local_ipv4_networks()
    if not networks:
        return []
    hosts: list[str] = []
    for network in networks:
        hosts.extend(str(host) for host in network.hosts())

    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as executor:
        futures = [
            executor.submit(_scan_target, host, port)
            for host in hosts
            for port in SCAN_PORTS
        ]
        for future in concurrent.futures.as_completed(futures):
            try:
                results.extend(future.result())
            except Exception:
                continue

    unique: list[dict] = []
    seen: set[tuple[str, int, str]] = set()
    for item in results:
        key = (item["host"], item["port"], item["type"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    unique.sort(key=lambda item: (item["type"], item["host"], item["port"]))
    return unique
