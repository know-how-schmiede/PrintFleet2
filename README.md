# PrintFleet2

PrintFleet2 is a clean rebuild of PrintFleet focused on a stronger foundation.
The goal is to keep the current usability while making the system easier to
extend and safer to operate as features grow.

Planned foundations:
- SQLAlchemy ORM and Alembic migrations
- Clear layers (web, services, db, models)
- Predictable configuration and runtime behavior

Status: scaffolding only.

## Project layout

```
PrintFleet2/
  README.md
  requirements.txt
  requirements-dev.txt
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
      db/
        __init__.py
        base.py
        session.py
      models/
        __init__.py
      web/
        __init__.py
        routes.py
  tests/
    README.md
  docs/
    README.md
```

## Quick start

See `setup/README.md` for clone, setup, and run commands.

## Notes

- Local config files (e.g. `.env`) are not committed.
- Database files and runtime artifacts are ignored by `.gitignore`.
- Database URL is read from `DATABASE_URL` (fallback: `data/printfleet2.sqlite3`).
