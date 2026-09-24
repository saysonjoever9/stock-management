from flask import Blueprint, request, jsonify, session
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from datetime import datetime, timedelta, timezone
from services.db import fetch_one, execute
from services.audit import log_action
from utils.validators import is_valid_username, is_strong_password, is_valid_email, clean_str

auth_bp = Blueprint("auth", __name__)
ph = PasswordHasher()

MAX_FAILED = 5
LOCK_MINUTES = 15


# ---------- LOGIN ----------
@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = clean_str(data.get("username"), 50)
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"success": False, "message": "Invalid credentials"}), 400

    user = fetch_one(
        """
        SELECT u.id, u.username, u.email, u.full_name, u.password_hash,
               u.is_active, u.is_approved, u.failed_logins, u.locked_until,
               r.name AS role
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.username = %s OR u.email = %s
        """,
        (username, username),
    )

    if not user:
        log_action(None, "login_failed", "auth", None, "failure",
                   details=f"unknown user: {username}")
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

    now = datetime.now(timezone.utc)
    if user["locked_until"] and user["locked_until"] > now:
        return jsonify({"success": False, "message": "Account temporarily locked"}), 423

    if not user["is_active"]:
        return jsonify({"success": False, "message": "Account disabled"}), 403

    # Staff needs approval; admin auto-approved
    if user["role"] == "staff" and not user["is_approved"]:
        return jsonify({
            "success": False,
            "message": "Your account is pending approval by an administrator."
        }), 403

    try:
        ph.verify(user["password_hash"], password)
    except VerifyMismatchError:
        new_failed = (user["failed_logins"] or 0) + 1
        if new_failed >= MAX_FAILED:
            locked_until = now + timedelta(minutes=LOCK_MINUTES)
            execute(
                "UPDATE users SET failed_logins=%s, locked_until=%s WHERE id=%s",
                (new_failed, locked_until, user["id"]),
            )
        else:
            execute("UPDATE users SET failed_logins=%s WHERE id=%s",
                    (new_failed, user["id"]))
        log_action(user["id"], "login_failed", "auth", str(user["id"]), "failure")
        return jsonify({"success": False, "message": "Invalid credentials"}), 401
    except Exception as e:
        print("[login-hash-error]", e, flush=True)
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

    execute(
        "UPDATE users SET failed_logins=0, locked_until=NULL, last_login=NOW() WHERE id=%s",
        (user["id"],),
    )

    session.clear()
    session.permanent = True
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["role"] = user["role"]
    session["last_seen"] = datetime.now(timezone.utc).isoformat()

    log_action(user["id"], "login_success", "auth", str(user["id"]))

    return jsonify({
        "success": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
        },
    })


# ---------- REGISTER ----------
@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = clean_str(data.get("username"), 50)
    email = clean_str(data.get("email"), 120)
    password = data.get("password") or ""
    full_name = clean_str(data.get("full_name"), 120)
    role = (data.get("role") or "staff").lower().strip()

    if not is_valid_username(username):
        return jsonify({"success": False,
                        "message": "Invalid username (3-50 chars, letters/numbers/_)"}), 400
    if not full_name:
        return jsonify({"success": False, "message": "Full name is required"}), 400
    if not email or not is_valid_email(email):
        return jsonify({"success": False, "message": "A valid email is required"}), 400
    if not is_strong_password(password):
        return jsonify({"success": False,
                        "message": "Password must be 8+ chars with upper, lower, and digit"}), 400

    if role not in ("staff", "admin"):
        return jsonify({"success": False, "message": "Invalid role"}), 400

    # Only ONE admin, ever
    if role == "admin":
        existing_admin = fetch_one(
            """
            SELECT u.id
            FROM users u JOIN roles r ON r.id = u.role_id
            WHERE r.name = 'admin'
            LIMIT 1
            """
        )
        if existing_admin:
            return jsonify({
                "success": False,
                "message": "An admin account already exists. Only one admin is allowed."
            }), 403

    role_row = fetch_one("SELECT id FROM roles WHERE name = %s", (role,))
    if not role_row:
        return jsonify({"success": False,
                        "message": f"Server not configured (no {role} role)"}), 500

    is_approved = (role == "admin")  # admin auto-approved; staff pending

    pw_hash = ph.hash(password)
    try:
        new_user = execute(
            """
            INSERT INTO users (username, email, password_hash, full_name,
                               role_id, is_active, is_approved)
            VALUES (%s, %s, %s, %s, %s, TRUE, %s)
            RETURNING id, username, email, full_name, is_active, is_approved, created_at
            """,
            (username, email, pw_hash, full_name, role_row["id"], is_approved),
            returning=True,
        )
    except Exception as e:
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            return jsonify({"success": False,
                            "message": "Username or email already exists"}), 409
        print("[register-error]", e, flush=True)
        return jsonify({"success": False, "message": "Could not create account"}), 500

    log_action(new_user["id"], "register", "user", str(new_user["id"]),
               details=f"role={role}, approved={is_approved}")

    if role == "admin":
        message = "Admin account created. You can now sign in."
    else:
        message = "Account created. Please wait for admin approval before signing in."

    return jsonify({
        "success": True,
        "message": message,
        "user": {**new_user, "role": role},
    }), 201


# ---------- LOGOUT ----------
@auth_bp.post("/logout")
def logout():
    uid = session.get("user_id")
    if uid:
        log_action(uid, "logout", "auth", str(uid))
    session.clear()
    return jsonify({"success": True})


# ---------- CURRENT USER ----------
@auth_bp.get("/me")
def me():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    user = fetch_one(
        """
        SELECT u.id, u.username, u.email, u.full_name, r.name AS role
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = %s
        """,
        (uid,),
    )
    if not user:
        session.clear()
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    return jsonify({"success": True, "user": user})


# ---------- CHECK IF ADMIN EXISTS ----------
@auth_bp.get("/admin-exists")
def admin_exists():
    row = fetch_one(
        """
        SELECT COUNT(*) AS c
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'admin'
        """
    )
    return jsonify({"success": True, "exists": row["c"] > 0})