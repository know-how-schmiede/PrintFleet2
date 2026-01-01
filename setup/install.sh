#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: Run as root (sudo -i)."
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
default_repo_dir="$(cd "${script_dir}/.." && pwd)"

prompt() {
  local label="$1"
  local default="$2"
  local value=""
  read -r -p "${label} [${default}]: " value
  if [[ -z "$value" ]]; then
    value="$default"
  fi
  printf '%s' "$value"
}

echo "PrintFleet2 setup inside Debian 13 LXC."
echo "Press Enter to accept defaults."
echo

REPO_DIR="$(prompt "Path to PrintFleet2 repo" "$default_repo_dir")"
SERVICE_USER="$(prompt "Service user" "printfleet2")"
VENV_DIR="$(prompt "Python venv path" "${REPO_DIR}/.venv")"
START_TEST_RAW="$(prompt "Start PrintFleet2 now for a test? (y/n)" "y")"

START_TEST="$(printf '%s' "$START_TEST_RAW" | tr '[:upper:]' '[:lower:]')"

REPO_DIR="$(cd "$REPO_DIR" && pwd)"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "ERROR: Repo directory not found: $REPO_DIR"
  exit 1
fi

if [[ ! -d "$REPO_DIR/src/printfleet2" ]]; then
  echo "ERROR: PrintFleet2 package not found in ${REPO_DIR}/src"
  exit 1
fi

REQ_FILE=""
if [[ -f "$REPO_DIR/requirements.txt" ]]; then
  REQ_FILE="$REPO_DIR/requirements.txt"
elif [[ -f "$REPO_DIR/src/requirements.txt" ]]; then
  REQ_FILE="$REPO_DIR/src/requirements.txt"
else
  echo "ERROR: requirements.txt not found."
  exit 1
fi

echo "Installing packages..."
DEBIAN_FRONTEND=noninteractive apt-get update
DEBIAN_FRONTEND=noninteractive apt-get -y install git python3 python3-venv python3-pip build-essential ffmpeg
echo "Note: Live-Wall RTSP MJPEG proxy requires ffmpeg (installed above)."

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$SERVICE_USER"
fi

chown -R "${SERVICE_USER}:${SERVICE_USER}" "$REPO_DIR"

if ! runuser -u "$SERVICE_USER" -- test -x "$REPO_DIR"; then
  echo "ERROR: Service user cannot access repo path: $REPO_DIR"
  echo "Move the repo to a shared path (e.g. /opt/PrintFleet2) or use Service user=root."
  exit 1
fi

echo "Creating virtual environment..."
if [[ ! -d "$VENV_DIR" ]]; then
  runuser -u "$SERVICE_USER" -- python3 -m venv "$VENV_DIR"
fi

runuser -u "$SERVICE_USER" -- "$VENV_DIR/bin/python" -m pip install --upgrade pip
runuser -u "$SERVICE_USER" -- "$VENV_DIR/bin/python" -m pip install -r "$REQ_FILE"
runuser -u "$SERVICE_USER" -- "$VENV_DIR/bin/python" -m pip install -e "$REPO_DIR"

echo "Running database migrations..."
runuser -u "$SERVICE_USER" -- bash -lc "cd \"$REPO_DIR\" && \"$VENV_DIR/bin/alembic\" upgrade head"

echo
echo "Installation done."
echo "Test command:"
echo "  cd ${REPO_DIR} && ${VENV_DIR}/bin/python -m printfleet2"
echo "Open: http://<container-ip>:8080"
echo
echo "After a successful test, run:"
echo "  ${script_dir}/install-service.sh"

if [[ "$START_TEST" == "y" ]]; then
  echo
  echo "Starting PrintFleet2 now. Stop with Ctrl+C when done testing."
  runuser -u "$SERVICE_USER" -- bash -lc "cd \"$REPO_DIR\" && \"$VENV_DIR/bin/python\" -m printfleet2"
fi
