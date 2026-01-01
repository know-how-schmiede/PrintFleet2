#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: Run as root (sudo -i)."
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
default_repo_dir="$(cd "${script_dir}/.." && pwd)"
service_file="/etc/systemd/system/printfleet2.service"

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

echo "PrintFleet2 systemd service setup."
echo "Press Enter to accept defaults."
echo

REPO_DIR="$(prompt "Path to PrintFleet2 repo" "$default_repo_dir")"
SERVICE_USER="$(prompt "Service user" "printfleet2")"
VENV_DIR="$(prompt "Python venv path" "${REPO_DIR}/.venv")"

REPO_DIR="$(cd "$REPO_DIR" && pwd)"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "ERROR: Repo directory not found: $REPO_DIR"
  exit 1
fi

if [[ ! -f "${script_dir}/printfleet2.service.example" ]]; then
  echo "ERROR: printfleet2.service.example not found in ${script_dir}"
  exit 1
fi

echo "Installing systemd service..."

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${SERVICE_USER}"
fi

sed   -e "s|__REPO_DIR__|${REPO_DIR}|g"   -e "s|__VENV_DIR__|${VENV_DIR}|g"   "${script_dir}/printfleet2.service.example" > "${service_file}"

systemctl daemon-reload
systemctl enable --now printfleet2

echo "Service installed and started."
