"""Session lifetime enforcement.

Flask signs the session cookie, so the stored timestamps are trustworthy.
Two limits apply:

  * absolute - PERMANENT_SESSION_LIFETIME from Flask (SESSION_LIFETIME_MINUTES)
  * idle     - SESSION_IDLE_TIMEOUT, checked here on every request

A session with no recorded activity stamp is treated as expired, so sessions
issued before this guard existed must sign in again.
"""

from datetime import datetime, timezone

from flask import jsonify, redirect, request, session

from config import Config

# Static assets are served through Flask; skip them so they do not keep a
# session alive on their own.
_STATIC_PREFIXES = ("/js/", "/css/", "/img/", "/favicon", "/static/")


def _parse_timestamp(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _reject(message):
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "message": message}), 401
    return redirect("/")


def init_session_guard(app):
    @app.before_request
    def enforce_session_lifetime():
        if request.method == "OPTIONS":
            return None
        if request.path.startswith(_STATIC_PREFIXES):
            return None
        if not session.get("user_id"):
            return None

        now = datetime.now(timezone.utc)
        last_seen = _parse_timestamp(session.get("last_seen"))
        if last_seen is None or (now - last_seen) > Config.SESSION_IDLE_TIMEOUT:
            session.clear()
            return _reject("Session expired. Please sign in again.")

        session["last_seen"] = now.isoformat()
        return None
