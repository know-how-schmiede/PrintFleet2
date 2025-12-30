#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: Run as root (sudo -i)."
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "${script_dir}/.." && pwd)"
service_user="printfleet2"
venv_dir="${repo_dir}/.venv"
service_file="/etc/systemd/system/printfleet2.service"

echo "Installing systemd service..."

if ! id -u "${service_user}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${service_user}"
fi

sed   -e "s|__REPO_DIR__|${repo_dir}|g"   -e "s|__VENV_DIR__|${venv_dir}|g"   "${script_dir}/printfleet2.service.example" > "${service_file}"

systemctl daemon-reload
systemctl enable --now printfleet2

echo "Service installed and started."
