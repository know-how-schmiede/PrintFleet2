from flask import Flask, g, jsonify, redirect, request, session as flask_session, url_for

from printfleet2.config import load_config
from printfleet2.db.session import init_engine, session_scope
from printfleet2.services.settings_service import ensure_settings_row
from printfleet2.web.routes import bp as web_bp
from printfleet2.services.user_service import get_user, has_users
from printfleet2.version import VERSION


def create_app() -> Flask:
    cfg = load_config()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = cfg.secret_key
    app.config["DATABASE_URL"] = cfg.database_url
    app.config["ENV"] = cfg.env
    app.config["DEBUG"] = cfg.debug

    app.logger.info("Database URL: %s", cfg.database_url)
    init_engine(cfg.database_url)
    try:
        with session_scope() as session:
            ensure_settings_row(session)
    except Exception as exc:
        app.logger.warning("Settings initialization skipped: %s", exc)

    @app.before_request
    def require_login():
        if request.endpoint is None or request.endpoint.startswith("static"):
            return None

        public_endpoints = {
            "web.login_page",
            "web.login",
            "web.logout",
            "web.logout_page",
        }

        with session_scope() as db_session:
            has_any_users = has_users(db_session)

        if not has_any_users:
            bootstrap_endpoints = {
                "web.users_page",
                "web.get_users",
                "web.post_user",
            }
            if request.endpoint in public_endpoints or request.endpoint in bootstrap_endpoints:
                return None
        else:
            if request.endpoint in public_endpoints:
                return None

        user_id = flask_session.get("user_id")
        if user_id:
            with session_scope() as db_session:
                user = get_user(db_session, int(user_id))
                if user:
                    g.user = user
                    return None
            flask_session.pop("user_id", None)

        if request.path.startswith("/api/"):
            return jsonify({"error": "not_authenticated"}), 401
        return redirect(url_for("web.login_page"))

    @app.context_processor
    def inject_version():
        return {"app_version": VERSION}
    app.register_blueprint(web_bp)

    return app
