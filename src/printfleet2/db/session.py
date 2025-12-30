from contextlib import contextmanager
from typing import Generator, Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


_ENGINE: Optional[Engine] = None
_SESSION_FACTORY: Optional[sessionmaker] = None


def init_engine(database_url: str) -> Engine:
    global _ENGINE, _SESSION_FACTORY
    _ENGINE = create_engine(database_url, future=True)
    _SESSION_FACTORY = sessionmaker(bind=_ENGINE, autoflush=False, autocommit=False, future=True)
    return _ENGINE


def get_engine() -> Engine:
    if _ENGINE is None:
        raise RuntimeError("Database engine is not initialized.")
    return _ENGINE


def get_session() -> Session:
    if _SESSION_FACTORY is None:
        raise RuntimeError("Session factory is not initialized.")
    return _SESSION_FACTORY()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
