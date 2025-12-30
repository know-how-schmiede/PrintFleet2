from sqlalchemy.orm import Session

from printfleet2.models.user import User

VALID_ROLES = {"superadmin", "admin", "user"}


def normalize_role(role: str | None) -> str | None:
    if role is None:
        return None
    role = role.strip().lower()
    if not role:
        return None
    if role not in VALID_ROLES:
        return None
    return role


def has_users(session: Session) -> bool:
    return session.query(User.id).first() is not None


def list_users(session: Session) -> list[User]:
    return session.query(User).order_by(User.id).all()


def get_user(session: Session, user_id: int) -> User | None:
    return session.get(User, user_id)


def get_user_by_username(session: Session, username: str) -> User | None:
    return session.query(User).filter(User.username == username).one_or_none()


def create_user(session: Session, username: str, password_hash: str, role: str = "user") -> User:
    user = User(username=username, password_hash=password_hash, role=role)
    session.add(user)
    return user


def user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "created_at": user.created_at,
    }
