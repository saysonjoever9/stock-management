"""Audit log viewer routes."""
from flask import Blueprint, jsonify, request, session

from services.db import fetch_all, fetch_one

audit_bp = Blueprint("audit", __name__)


def _require_admin():
    if not session.get("user_id"):
        return jsonify({"success": False, "message": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"success": False, "message": "Forbidden"}), 403
    return None


@audit_bp.route("/", methods=["GET"])
def list_logs():
    err = _require_admin()
    if err:
        return err

    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(200, max(1, int(request.args.get("limit", 50))))
    except (TypeError, ValueError):
        page, limit = 1, 50
    offset = (page - 1) * limit

    action = (request.args.get("action") or "").strip()
    resource = (request.args.get("resource") or "").strip()
    status = (request.args.get("status") or "").strip()
    username = (request.args.get("username") or "").strip()
    date_from = (request.args.get("date_from") or "").strip()
    date_to = (request.args.get("date_to") or "").strip()

    where = []
    params = []

    if action:
        where.append("al.action = %s")
        params.append(action)
    if resource:
        where.append("al.resource = %s")
        params.append(resource)
    if status:
        where.append("al.status = %s")
        params.append(status)
    if username:
        where.append("u.username ILIKE %s")
        params.append(f"%{username}%")
    if date_from:
        where.append("al.created_at >= %s")
        params.append(date_from)
    if date_to:
        where.append("al.created_at <= %s")
        params.append(date_to + " 23:59:59")

    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    count_row = fetch_one(
        f"""
        SELECT COUNT(*) AS total
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        {where_sql}
        """,
        tuple(params),
    )
    total = count_row["total"] if count_row else 0
    pages = max(1, (total + limit - 1) // limit)

    rows = fetch_all(
        f"""
        SELECT
            al.id, al.action, al.resource, al.resource_id, al.status,
            al.ip_address, al.user_agent, al.details, al.created_at,
            u.username, u.full_name
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        {where_sql}
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params + [limit, offset]),
    )

    for r in rows:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        if r.get("details") and len(str(r["details"])) > 200:
            r["details"] = str(r["details"])[:200] + "..."

    return jsonify({
        "success": True,
        "logs": rows,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": pages},
    })


@audit_bp.route("/filters", methods=["GET"])
def get_filter_options():
    err = _require_admin()
    if err:
        return err

    actions = fetch_all("SELECT DISTINCT action FROM audit_logs WHERE action IS NOT NULL ORDER BY action")
    resources = fetch_all("SELECT DISTINCT resource FROM audit_logs WHERE resource IS NOT NULL ORDER BY resource")
    statuses = fetch_all("SELECT DISTINCT status FROM audit_logs WHERE status IS NOT NULL ORDER BY status")

    return jsonify({
        "success": True,
        "actions": [r["action"] for r in actions],
        "resources": [r["resource"] for r in resources],
        "statuses": [r["status"] for r in statuses],
    })