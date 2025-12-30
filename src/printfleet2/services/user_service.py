from sqlalchemy.orm import Session

from printfleet2.models.user import User


def list_users(session: Session) -> list[User]:
    return session.query(User).order_by(User.id).all()


def get_user(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def get_user_by_username(session: Session, username: str) -> User | None:
    return session.query(User).filter(User.username == username).one_or_none()


def create_user(session: Session, username: str, password_hash: str) -> User:
    user = User(username=username, password_hash=password_hash)
    session.add(user)
    return user


def user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "created_at": user.created_at,
    }
