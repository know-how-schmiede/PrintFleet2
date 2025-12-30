from flask import Flask

from printfleet2.config import load_config
from printfleet2.db.session import init_engine, session_scope
from printfleet2.services.settings_service import ensure_settings_row
from printfleet2.web.routes import bp as web_bp


def create_app() -> Flask:
    cfg = load_config()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = cfg.secret_key
    app.config["DATABASE_URL"] = cfg.database_url
    app.config["ENV"] = cfg.env
    app.config["DEBUG"] = cfg.debug

    init_engine(cfg.database_url)
    try:
        with session_scope() as session:
            ensure_settings_row(session)
    except Exception as exc:
        app.logger.warning("Settings initialization skipped: %s", exc)
    app.register_blueprint(web_bp)

    return app
