from dataclasses import dataclass
from pathlib import Path
import os


DEFAULT_DATA_DIR = Path(os.environ.get("PRINTFLEET2_DATA_DIR", "data"))


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path}"


@dataclass(frozen=True)
class Config:
    secret_key: str
    database_url: str
    env: str
    debug: bool


def load_config() -> Config:
    env = os.environ.get("FLASK_ENV", os.environ.get("PRINTFLEET2_ENV", "production"))
    debug = os.environ.get("PRINTFLEET2_DEBUG", "").lower() in ("1", "true", "yes", "on")
    secret_key = os.environ.get("PRINTFLEET2_SECRET_KEY", "change-me")
    database_url = os.environ.get("DATABASE_URL", "")

    if not database_url:
        data_dir = DEFAULT_DATA_DIR
        data_dir.mkdir(parents=True, exist_ok=True)
        database_url = _sqlite_url((data_dir / "printfleet2.sqlite3").resolve())

    return Config(
        secret_key=secret_key,
        database_url=database_url,
        env=env,
        debug=debug,
    )
