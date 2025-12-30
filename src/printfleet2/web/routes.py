from flask import Blueprint, request, session as flask_session, Response, render_template, redirect, url_for

from printfleet2.db.session import session_scope
from printfleet2.services.printer_service import (
    create_printer,
    delete_printer,
    get_printer,
    list_printers,
    printer_to_dict,
    printers_to_dict,
    update_printer,
)
from printfleet2.services.settings_service import ensure_settings_row, settings_to_dict, update_settings
from printfleet2.services.user_service import (
    create_user,
    get_user,
    get_user_by_username,
    has_users,
    list_users,
    normalize_role,
    user_to_dict,
)
from printfleet2.services.auth_service import hash_password, verify_password


bp = Blueprint("web", __name__)


def clean_optional(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
    else:
        value = str(value).strip()
    return value or None


@bp.get("/")
def index():
    return render_template("index.html")


@bp.get("/api/settings")
def get_settings():
    with session_scope() as session:
        settings = ensure_settings_row(session)
        return settings_to_dict(settings)


@bp.put("/api/settings")
@bp.patch("/api/settings")
def put_settings():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    with session_scope() as session:
        settings = ensure_settings_row(session)
        update_settings(settings, payload)
        return settings_to_dict(settings)


@bp.get("/api/printers")
def get_printers():
    with session_scope() as session:
        printers = list_printers(session)
        return {"items": printers_to_dict(printers)}


@bp.get("/api/printers/<int:printer_id>")
def get_printer_by_id(printer_id: int):
    with session_scope() as session:
        printer = get_printer(session, printer_id)
        if printer is None:
            return {"error": "not_found"}, 404
        return printer_to_dict(printer)


@bp.post("/api/printers")
def post_printer():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    for field in ("name", "backend", "host"):
        if not payload.get(field):
            return {"error": "missing_field", "field": field}, 400
    with session_scope() as session:
        printer = create_printer(session, payload)
        return printer_to_dict(printer), 201


@bp.put("/api/printers/<int:printer_id>")
@bp.patch("/api/printers/<int:printer_id>")
def put_printer(printer_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    with session_scope() as session:
        printer = get_printer(session, printer_id)
        if printer is None:
            return {"error": "not_found"}, 404
        update_printer(session, printer, payload)
        return printer_to_dict(printer)


@bp.delete("/api/printers/<int:printer_id>")
def delete_printer_by_id(printer_id: int):
    with session_scope() as session:
        printer = get_printer(session, printer_id)
        if printer is None:
            return {"error": "not_found"}, 404
        delete_printer(session, printer)
        return {"status": "deleted"}


@bp.get("/api/users")
def get_users():
    with session_scope() as db_session:
        users = list_users(db_session)
        return {"items": [user_to_dict(user) for user in users]}


@bp.post("/api/users")
def post_user():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    role = normalize_role(payload.get("role"))
    first_name = clean_optional(payload.get("first_name"))
    last_name = clean_optional(payload.get("last_name"))
    email = clean_optional(payload.get("email"))
    notes = clean_optional(payload.get("notes"))
    if not username or not password:
        return {"error": "missing_field"}, 400
    if payload.get("role") is not None and role is None:
        return {"error": "invalid_role"}, 400
    with session_scope() as db_session:
        existing = get_user_by_username(db_session, username)
        if existing is not None:
            return {"error": "username_exists"}, 409
        first_user = not has_users(db_session)
        if first_user:
            role = "superadmin"
        if role is None:
            role = "user"
        user = create_user(
            db_session,
            username,
            hash_password(password),
            role=role,
            first_name=first_name,
            last_name=last_name,
            email=email,
            notes=notes,
        )
        return user_to_dict(user), 201


@bp.get("/api/users/<int:user_id>")
def get_user_by_id(user_id: int):
    with session_scope() as db_session:
        user = get_user(db_session, user_id)
        if user is None:
            return {"error": "not_found"}, 404
        return user_to_dict(user)


@bp.delete("/api/users/<int:user_id>")
def delete_user_by_id(user_id: int):
    with session_scope() as db_session:
        user = get_user(db_session, user_id)
        if user is None:
            return {"error": "not_found"}, 404
        if user.role == "superadmin":
            return {"error": "forbidden"}, 403
        db_session.delete(user)
        return {"status": "deleted"}


@bp.put("/api/users/<int:user_id>")
@bp.patch("/api/users/<int:user_id>")
def update_user_by_id(user_id: int):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    new_username = clean_optional(payload.get("username"))
    if "username" in payload and new_username is None:
        return {"error": "missing_field", "field": "username"}, 400
    role = normalize_role(payload.get("role"))
    if payload.get("role") is not None and role is None:
        return {"error": "invalid_role"}, 400
    with session_scope() as db_session:
        user = get_user(db_session, user_id)
        if user is None:
            return {"error": "not_found"}, 404
        if new_username is not None and new_username != user.username:
            existing = get_user_by_username(db_session, new_username)
            if existing is not None and existing.id != user.id:
                return {"error": "username_exists"}, 409
            user.username = new_username
        if "role" in payload and role:
            user.role = role
        if "first_name" in payload:
            user.first_name = clean_optional(payload.get("first_name"))
        if "last_name" in payload:
            user.last_name = clean_optional(payload.get("last_name"))
        if "email" in payload:
            user.email = clean_optional(payload.get("email"))
        if "notes" in payload:
            user.notes = clean_optional(payload.get("notes"))
        password = payload.get("password") or ""
        if password:
            user.password_hash = hash_password(password)
        return user_to_dict(user)


@bp.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return {"error": "invalid_json"}, 400
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        return {"error": "missing_field"}, 400
    with session_scope() as db_session:
        user = get_user_by_username(db_session, username)
        if user is None or not verify_password(user.password_hash, password):
            return {"error": "invalid_credentials"}, 401
        flask_session["user_id"] = user.id
        return {"status": "ok", "user": user_to_dict(user)}


@bp.post("/api/auth/logout")
def logout():
    flask_session.pop("user_id", None)
    return {"status": "ok"}


@bp.get("/api/auth/me")
def auth_me():
    user_id = flask_session.get("user_id")
    if not user_id:
        return {"error": "not_authenticated"}, 401
    with session_scope() as db_session:
        user = get_user(db_session, int(user_id))
        if user is None:
            flask_session.pop("user_id", None)
            return {"error": "not_authenticated"}, 401
        return {"user": user_to_dict(user)}


@bp.get("/api/docs")
def api_docs():
    return {
        "endpoints": [
            {"method": "GET", "path": "/api/settings"},
            {"method": "PUT", "path": "/api/settings"},
            {"method": "PATCH", "path": "/api/settings"},
            {"method": "GET", "path": "/api/printers"},
            {"method": "POST", "path": "/api/printers"},
            {"method": "GET", "path": "/api/printers/{id}"},
            {"method": "PUT", "path": "/api/printers/{id}"},
            {"method": "PATCH", "path": "/api/printers/{id}"},
            {"method": "DELETE", "path": "/api/printers/{id}"},
            {"method": "GET", "path": "/api/users"},
            {"method": "POST", "path": "/api/users"},
            {"method": "GET", "path": "/api/users/{id}"},
            {"method": "DELETE", "path": "/api/users/{id}"},
            {"method": "PUT", "path": "/api/users/{id}"},
            {"method": "PATCH", "path": "/api/users/{id}"},
            {"method": "POST", "path": "/api/auth/login"},
            {"method": "POST", "path": "/api/auth/logout"},
            {"method": "GET", "path": "/api/auth/me"},
        ]
    }


@bp.get("/docs")
def docs_page():
    return render_template("docs.html")


@bp.get("/printers")
def printers_page():
    return render_template("printers.html")


@bp.get("/users")
def users_page():
    with session_scope() as db_session:
        first_user = not has_users(db_session)
    return render_template("users.html", first_user=first_user)


@bp.get("/settings")
def settings_page():
    return render_template("settings.html")


@bp.get("/login")
def login_page():
    with session_scope() as db_session:
        first_user = not has_users(db_session)
    return render_template("login.html", first_user=first_user)


@bp.get("/logout")
def logout_page():
    flask_session.pop("user_id", None)
    return redirect(url_for("web.login_page"))
