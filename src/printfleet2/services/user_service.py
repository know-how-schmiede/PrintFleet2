from sqlalchemy.orm import Session

from printfleet2.models.user import User


def has_users(session: Session) -> bool:
    return session.query(User.id).first() is not None


def list_users(session: Session) -> list[User]:
    return session.query(User).order_by(User.id).all()


def get_user(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def get_user_by_username(session: Session, username: str) -> User | None:
    return session.query(User).filter(User.username == username).one_or_none()


def create_user(session: Session, username: str, password_hash: str, is_admin: bool = False) -> User:
    user = User(username=username, password_hash=password_hash, is_admin=is_admin)
    session.add(user)
    return user


def user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "is_admin": user.is_admin,
        "created_at": user.created_at,
    }
