#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
venv_dir="${repo_dir}/.venv"

python3 -m venv "${venv_dir}"
"${venv_dir}/bin/python" -m pip install --upgrade pip
"${venv_dir}/bin/python" -m pip install -r "${repo_dir}/requirements.txt"
"${venv_dir}/bin/python" -m pip install -e "${repo_dir}"

echo
print_banner() {
  echo "PrintFleet2 environment ready."
  echo "Run:"
  echo "  . ${venv_dir}/bin/activate"
  echo "  python -m printfleet2"
}
print_banner
