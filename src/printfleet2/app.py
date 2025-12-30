from flask import Flask

from printfleet2.config import load_config
from printfleet2.db.session import init_engine
from printfleet2.web.routes import bp as web_bp


def create_app() -> Flask:
    cfg = load_config()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = cfg.secret_key
    app.config["DATABASE_URL"] = cfg.database_url
    app.config["ENV"] = cfg.env
    app.config["DEBUG"] = cfg.debug

    init_engine(cfg.database_url)
    app.register_blueprint(web_bp)

    return app
