from flask import Blueprint, request, jsonify, session
from argon2 import PasswordHasher
from services.db import fetch_one, fetch_all, execute
from services.audit import log_action
from utils.validators import is_valid_username, is_strong_password, clean_str

users_bp = Blueprint("users", __name__)
ph = PasswordHasher()


def require_admin():
    if not session.get("user_id"):
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"success": False, "message": "Admin access required"}), 403
    return None


# ---------- LIST ALL USERS ----------
@users_bp.get("/")
def list_users():
    err = require_admin()
    if err:
        return err
    users = fetch_all(
        """
        SELECT u.id, u.username, u.email, u.full_name,
               u.is_active, u.is_approved, u.last_login, u.created_at,
               r.name AS role
        FROM users u JOIN roles r ON r.id = u.role_id
        ORDER BY u.is_approved ASC, u.created_at DESC
        """
    )
    return jsonify({"success": True, "users": users})


# ---------- LIST PENDING ----------
@users_bp.get("/pending")
def list_pending():
    err = require_admin()
    if err:
        return err
    users = fetch_all(
        """
        SELECT u.id, u.username, u.email, u.full_name, u.created_at,
               r.name AS role
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.is_approved = FALSE
        ORDER BY u.created_at DESC
        """
    )
    return jsonify({"success": True, "users": users})


# ---------- APPROVE ----------
@users_bp.post("/<int:user_id>/approve")
def approve_user(user_id):
    err = require_admin()
    if err:
        return err
    user = fetch_one("SELECT id, username FROM users WHERE id = %s", (user_id,))
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    execute("UPDATE users SET is_approved = TRUE, is_active = TRUE WHERE id = %s",
            (user_id,))

    log_action(session["user_id"], "user_approved", "user", str(user_id),
               details=f"approved user: {user['username']}")

    return jsonify({"success": True,
                    "message": f"User '{user['username']}' approved."})


# ---------- REJECT ----------
@users_bp.post("/<int:user_id>/reject")
def reject_user(user_id):
    err = require_admin()
    if err:
        return err
    user = fetch_one("SELECT id, username FROM users WHERE id = %s", (user_id,))
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    execute("DELETE FROM users WHERE id = %s", (user_id,))

    log_action(session["user_id"], "user_rejected", "user", str(user_id),
               details=f"rejected user: {user['username']}")

    return jsonify({"success": True,
                    "message": f"User '{user['username']}' rejected."})


# ---------- CREATE USER ----------
@users_bp.post("/")
def create_user():
    err = require_admin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    username = clean_str(data.get("username"), 50)
    full_name = clean_str(data.get("full_name"), 120)
    email = clean_str(data.get("email"), 120)
    password = data.get("password") or ""
    role = (data.get("role") or "staff").lower().strip()

    if not is_valid_username(username):
        return jsonify({"success": False, "message": "Invalid username"}), 400
    if not full_name:
        return jsonify({"success": False, "message": "Full name required"}), 400
    if not is_strong_password(password):
        return jsonify({"success": False,
                        "message": "Password must be 8+ chars with upper, lower, digit"}), 400
    if role not in ("staff", "admin"):
        return jsonify({"success": False, "message": "Invalid role"}), 400

    role_row = fetch_one("SELECT id FROM roles WHERE name = %s", (role,))
    if not role_row:
        return jsonify({"success": False, "message": "Role not found"}), 500

    pw_hash = ph.hash(password)
    try:
        new_user = execute(
            """
            INSERT INTO users (username, email, password_hash, full_name,
                               role_id, is_active, is_approved)
            VALUES (%s, %s, %s, %s, %s, TRUE, TRUE)
            RETURNING id, username, email, full_name, is_active, is_approved, created_at
            """,
            (username, email, pw_hash, full_name, role_row["id"]),
            returning=True,
        )
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return jsonify({"success": False,
                            "message": "Username or email already exists"}), 409
        raise

    log_action(session["user_id"], "user_created", "user", str(new_user["id"]),
               details=f"role={role}")

    return jsonify({"success": True, "user": {**new_user, "role": role}}), 201


# ---------- UPDATE USER ----------
@users_bp.put("/<int:user_id>")
def update_user(user_id):
    err = require_admin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    full_name = clean_str(data.get("full_name"), 120)
    email = clean_str(data.get("email"), 120)
    role = (data.get("role") or "").lower().strip()
    is_active = data.get("is_active")

    if not full_name:
        return jsonify({"success": False, "message": "Full name required"}), 400

    role_row = fetch_one("SELECT id FROM roles WHERE name = %s", (role,)) if role else None

    execute(
        """
        UPDATE users
        SET full_name = %s, email = %s,
            role_id = COALESCE(%s, role_id),
            is_active = COALESCE(%s, is_active)
        WHERE id = %s
        """,
        (full_name, email or None,
         role_row["id"] if role_row else None,
         is_active, user_id),
    )

    log_action(session["user_id"], "user_updated", "user", str(user_id))
    return jsonify({"success": True, "message": "User updated"})


# ---------- RESET PASSWORD ----------
@users_bp.post("/<int:user_id>/reset-password")
def reset_password(user_id):
    err = require_admin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""

    if not is_strong_password(password):
        return jsonify({"success": False,
                        "message": "Password must be 8+ chars with upper, lower, digit"}), 400

    pw_hash = ph.hash(password)
    execute("UPDATE users SET password_hash = %s WHERE id = %s", (pw_hash, user_id))

    log_action(session["user_id"], "password_reset", "user", str(user_id))
    return jsonify({"success": True, "message": "Password reset"})