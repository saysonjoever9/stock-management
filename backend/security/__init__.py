"""Security package."""
from functools import wraps
from flask import session, jsonify, redirect, url_for, request

from .sessions import init_session_guard
from .limits import limiter, init_rate_limiter
from .headers import register_security_headers
from .errors import register_error_handlers
from .csrf import init_csrf_protection


def login_required(f):
    """Require an authenticated session."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            if request.path.startswith("/api/"):
                return jsonify({"success": False, "message": "Not authenticated"}), 401
            return redirect(url_for("page_login"))
        return f(*args, **kwargs)
    return wrapper


def role_required(*roles):
    """Require the current user to have one of the given roles."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if session.get("role") not in roles:
                if request.path.startswith("/api/"):
                    return jsonify({"success": False, "message": "Forbidden"}), 403
                return redirect(url_for("page_dashboard"))
            return f(*args, **kwargs)
        return wrapper
    return decorator


def init_security(app):
    """Initialize all security features.

    NOTE: No TrustedHost / host validation here.
    Access is controlled by:
      - CSRF (for /api/ views)
      - Session guards
      - Rate limits
      - Security headers
    """
    init_csrf_protection(app)
    init_rate_limiter(app)
    register_security_headers(app)
    register_error_handlers(app)
    init_session_guard(app)
    return app