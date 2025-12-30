# Setup

This folder contains install scripts and the setup guide.
All commands below are shell examples for Linux.

## 1) Clone

```bash
git clone https://github.com/know-how-schmiede/PrintFleet2.git
cd PrintFleet2
```

## 2) Create a virtual environment and install dependencies

```bash
./setup/install.sh
```

Manual steps (if you do not want to use the script):

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -e .
```

## Windows PowerShell (local development)

```powershell
cd C:\Data\GitHub\PrintFleet2
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -e .
```

If activation is blocked:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## 3) Run the dev server (scaffold only)

```bash
. .venv/bin/activate
python -m printfleet2
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m printfleet2
```

## 4) Database migrations (Alembic)

```bash
. .venv/bin/activate
alembic upgrade head
```

Create a new migration (after you add models):

```bash
alembic revision --autogenerate -m "create tables"
```

PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

## 5) Optional: install as a systemd service

```bash
sudo ./setup/install-service.sh
```

This uses `setup/printfleet2.service.example` as a template. Edit if needed.

## Git hygiene

```bash
# create a feature branch
git checkout -b feature/your-change

# view status and commit
git status
git add .
git commit -m "Describe your change"
```
