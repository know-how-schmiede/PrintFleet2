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

echo "PrintFleet2 update inside Debian 13 LXC."
echo "Press Enter to accept defaults."
echo

REPO_DIR="$(prompt "Path to PrintFleet2 repo" "$default_repo_dir")"
SERVICE_USER="$(prompt "Service user" "printfleet2")"
VENV_DIR="$(prompt "Python venv path" "${REPO_DIR}/.venv")"
SERVICE_NAME="$(prompt "systemd service name" "printfleet2")"
STOP_SERVICE_RAW="$(prompt "Stop service before update? (y/n)" "y")"
PULL_RAW="$(prompt "Pull latest changes with git? (y/n)" "y")"
RESTART_RAW="$(prompt "Restart service after update? (y/n)" "y")"
START_TEST_RAW="$(prompt "Start PrintFleet2 now for a test? (y/n)" "n")"

STOP_SERVICE="$(printf '%s' "$STOP_SERVICE_RAW" | tr '[:upper:]' '[:lower:]')"
PULL="$(printf '%s' "$PULL_RAW" | tr '[:upper:]' '[:lower:]')"
RESTART_SERVICE="$(printf '%s' "$RESTART_RAW" | tr '[:upper:]' '[:lower:]')"
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

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  echo "Service user not found. Creating: ${SERVICE_USER}"
  useradd -m -s /bin/bash "$SERVICE_USER"
fi

chown -R "${SERVICE_USER}:${SERVICE_USER}" "$REPO_DIR"

REQ_FILE=""
if [[ -f "$REPO_DIR/requirements.txt" ]]; then
  REQ_FILE="$REPO_DIR/requirements.txt"
elif [[ -f "$REPO_DIR/src/requirements.txt" ]]; then
  REQ_FILE="$REPO_DIR/src/requirements.txt"
else
  echo "ERROR: requirements.txt not found."
  exit 1
fi

if [[ "$PULL" == "y" ]]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "WARNING: git not found, skipping pull."
  else
    runuser -u "$SERVICE_USER" -- bash -lc "cd \"$REPO_DIR\" && git pull --ff-only"
  fi
fi

if [[ "$STOP_SERVICE" == "y" ]]; then
  systemctl stop "$SERVICE_NAME"
  echo "Service stopped: ${SERVICE_NAME}"
fi

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Creating virtual environment..."
  runuser -u "$SERVICE_USER" -- python3 -m venv "$VENV_DIR"
fi

echo "Updating Python packages..."
runuser -u "$SERVICE_USER" -- "$VENV_DIR/bin/python" -m pip install --upgrade pip
runuser -u "$SERVICE_USER" -- "$VENV_DIR/bin/python" -m pip install -r "$REQ_FILE"
runuser -u "$SERVICE_USER" -- "$VENV_DIR/bin/python" -m pip install -e "$REPO_DIR"

echo "Running database migrations..."
runuser -u "$SERVICE_USER" -- bash -lc "cd \"$REPO_DIR\" && \"$VENV_DIR/bin/alembic\" upgrade head"

echo
echo "Update done."
echo "Test command:"
echo "  cd ${REPO_DIR} && ${VENV_DIR}/bin/python -m printfleet2"

if [[ "$RESTART_SERVICE" == "y" ]]; then
  systemctl restart "$SERVICE_NAME"
  echo "Service restarted: ${SERVICE_NAME}"
fi

if [[ "$START_TEST" == "y" ]]; then
  echo
  echo "Starting PrintFleet2 now. Stop with Ctrl+C when done testing."
  runuser -u "$SERVICE_USER" -- bash -lc "cd \"$REPO_DIR\" && \"$VENV_DIR/bin/python\" -m printfleet2"
fi
