from flask import request
from services.db import db_cursor


def log_action(user_id, action, resource=None, resource_id=None, status="success", details=None):
    try:
        ip = request.remote_addr if request else None
        ua = request.headers.get("User-Agent") if request else None
        with db_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO audit_logs
                    (user_id, action, resource, resource_id, status, ip_address, user_agent, details)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id, action, resource, resource_id, status,
                    ip, (ua[:250] if ua else None), details,
                ),
            )
    except Exception as e:
        print(f"[audit-error] {e}")