from flask import Blueprint

from printfleet2.db.session import session_scope
from printfleet2.services.printer_service import list_printers, printers_to_dict
from printfleet2.services.settings_service import ensure_settings_row, settings_to_dict


bp = Blueprint("web", __name__)


@bp.get("/")
def index():
    return {"status": "ok", "app": "PrintFleet2"}


@bp.get("/api/settings")
def get_settings():
    with session_scope() as session:
        settings = ensure_settings_row(session)
        return settings_to_dict(settings)


@bp.get("/api/printers")
def get_printers():
    with session_scope() as session:
        printers = list_printers(session)
        return {"items": printers_to_dict(printers)}
