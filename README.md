# PrintFleet2

PrintFleet2 is a clean rebuild of PrintFleet with a stronger foundation.
The goal is to keep the current usability while making the system easier to
extend, safer to operate, and more maintainable as features grow.

Current foundations:
- SQLAlchemy ORM and Alembic migrations
- Clear layers (web, services, db, models)
- Predictable configuration and runtime behavior

Status: MVP in progress (users, printers, settings, Live-Wall).

## Key features

- Users with roles: SuperAdmin, Admin, User
- Login required for all views except Live-Wall
- Settings UI with Live-Wall stream configuration (collapsible stream sections)
- Live-Wall printer layout controls (printers per row 1-5, data density: light/normal/all)
- Printer management with active list on Live-Wall
- Printer groups and printer type catalogs in Settings
- Live-Wall status and plug status JSON feeds for external displays
- Network scan API endpoint to discover devices on the local subnet
- User import/export API endpoints for migration and backups
- API docs page at `/docs` plus JSON listing at `/api/docs`
- Versioning file and changelog in docs

## Project layout

```
PrintFleet2/
  README.md
  requirements.txt
  requirements-dev.txt
  alembic.ini
  alembic/
    versions/
  setup/
    README.md
    install.sh
    install-service.sh
    printfleet2.service.example
  src/
    printfleet2/
      __init__.py
      __main__.py
      app.py
      config.py
      version.py
      db/
        __init__.py
        base.py
        session.py
      models/
        __init__.py
        printer.py
        printer_group.py
        printer_type.py
        settings.py
        user.py
      services/
        auth_service.py
        net_scan_service.py
        printer_group_service.py
        printer_service.py
        printer_status_service.py
        printer_type_service.py
        settings_service.py
        user_service.py
      static/
        live_wall.js
        printers.js
        settings.js
        style.css
      templates/
        base.html
        docs.html
        live_wall.html
        login.html
        printers.html
        settings.html
        users.html
      web/
        __init__.py
        routes.py
  tests/
    README.md
  docs/
    README.md
    Version.md
```

## Quick start

See `setup/README.md` for clone, setup, and run commands.

## Migrations

Run Alembic from the repo root:

```
alembic upgrade head
```

## Access and roles

- First created user becomes SuperAdmin.
- Live-Wall is public at `/live-wall`.
- All other routes require login.

## Versioning

Runtime version lives in `src/printfleet2/version.py`.
Changes are logged in `docs/Version.md`.

## Notes

- Local config files (e.g. `.env`) are not committed.
- Database files and runtime artifacts are ignored by `.gitignore`.
- Database URL is read from `DATABASE_URL` (fallback: `data/printfleet2.sqlite3`).
