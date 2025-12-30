from flask import Blueprint


bp = Blueprint("web", __name__)


@bp.get("/")
def index():
    return {"status": "ok", "app": "PrintFleet2"}
