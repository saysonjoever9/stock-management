"""Reports blueprint — role-aware endpoints."""
from flask import Blueprint, request, jsonify, session

from services.db import fetch_one, fetch_all
from middleware.auth import login_required

reports_bp = Blueprint("reports", __name__)


# ============================================================
# DASHBOARD — Admin + Staff (same endpoint, role-aware data)
# ============================================================

@reports_bp.get("/dashboard")
@login_required
def dashboard():
    """Dashboard stats. Returns different data based sa role."""
    role = session.get("role")
    user_id = session.get("user_id")

    if role == "admin":
        return _admin_dashboard()
    return _staff_dashboard(user_id)


def _admin_dashboard():
    """Admin sees full system overview."""
    totals = fetch_one(
        "SELECT COUNT(*) AS total_products, COALESCE(SUM(current_stock),0) AS total_stock FROM products"
    )
    low = fetch_one(
        "SELECT COUNT(*) AS c FROM products WHERE current_stock > 0 AND current_stock <= min_stock_level"
    )
    out = fetch_one("SELECT COUNT(*) AS c FROM products WHERE current_stock = 0")
    value = fetch_one("SELECT COALESCE(SUM(current_stock * cost_price),0) AS v FROM products")
    categories = fetch_one("SELECT COUNT(*) AS c FROM categories")
    suppliers = fetch_one("SELECT COUNT(*) AS c FROM suppliers")

    pending_users = fetch_one(
        "SELECT COUNT(*) AS c FROM users WHERE is_approved = false"
    ) or {"c": 0}

    recent = fetch_all(
        """
        SELECT t.id, t.type, t.quantity, t.created_at,
               p.name AS product_name, u.username
        FROM stock_transactions t
        JOIN products p ON p.id = t.product_id
        JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC LIMIT 10
        """
    )

    return jsonify({
        "success": True,
        "role": "admin",
        "stats": {
            "total_products": totals["total_products"],
            "total_stock": totals["total_stock"],
            "low_stock": low["c"],
            "out_of_stock": out["c"],
            "inventory_value": float(value["v"]),
            "total_categories": categories["c"],
            "total_suppliers": suppliers["c"],
            "pending_users": pending_users["c"],
            "pending_pos": 0,
        },
        "recent_transactions": recent,
    })


def _staff_dashboard(user_id):
    """Staff sees personal stats + quick actions."""
    today_sales = fetch_one(
        """
        SELECT COALESCE(SUM(t.quantity * p.selling_price), 0) AS total
        FROM stock_transactions t
        JOIN products p ON p.id = t.product_id
        WHERE t.user_id = %s
          AND t.type = 'out'
          AND t.created_at::date = CURRENT_DATE
        """,
        (user_id,),
    ) or {"total": 0}

    items_sold = fetch_one(
        """
        SELECT COALESCE(SUM(quantity), 0) AS total
        FROM stock_transactions
        WHERE user_id = %s
          AND type = 'out'
          AND created_at::date = CURRENT_DATE
        """,
        (user_id,),
    ) or {"total": 0}

    my_tx = fetch_one(
        "SELECT COUNT(*) AS total FROM stock_transactions WHERE user_id = %s",
        (user_id,),
    ) or {"total": 0}

    recent = fetch_all(
        """
        SELECT t.id, t.type, t.quantity, t.created_at,
               p.name AS product_name, u.username
        FROM stock_transactions t
        JOIN products p ON p.id = t.product_id
        JOIN users u ON u.id = t.user_id
        WHERE t.user_id = %s
        ORDER BY t.created_at DESC LIMIT 10
        """,
        (user_id,),
    )

    return jsonify({
        "success": True,
        "role": "staff",
        "stats": {
            "today_sales": float(today_sales["total"]),
            "items_sold": int(items_sold["total"]),
            "my_transactions": int(my_tx["total"]),
        },
        "recent_transactions": recent,
    })


# ============================================================
# REPORTS
# ============================================================

@reports_bp.get("/inventory")
@login_required
def inventory_report():
    rows = fetch_all(
        """
        SELECT p.sku, p.name, c.name AS category, s.name AS supplier,
               p.cost_price, p.selling_price, p.current_stock, p.min_stock_level,
               (p.current_stock * p.cost_price) AS stock_value
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        ORDER BY p.name
        """
    )
    return jsonify({"success": True, "report": rows})


@reports_bp.get("/low-stock")
@login_required
def low_stock_report():
    rows = fetch_all(
        """
        SELECT p.sku, p.name, c.name AS category,
               p.current_stock, p.min_stock_level
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.current_stock > 0 AND p.current_stock <= p.min_stock_level
        ORDER BY p.current_stock
        """
    )
    return jsonify({"success": True, "report": rows})


@reports_bp.get("/out-of-stock")
@login_required
def out_of_stock_report():
    rows = fetch_all(
        """
        SELECT p.sku, p.name, c.name AS category, p.min_stock_level
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.current_stock = 0
        ORDER BY p.name
        """
    )
    return jsonify({"success": True, "report": rows})


@reports_bp.get("/transactions")
@login_required
def transaction_report():
    tx_type = request.args.get("type")
    params, where = [], []
    if tx_type in ("in", "out", "adjustment"):
        params.append(tx_type)
        where.append("t.type=%s")
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    rows = fetch_all(
        f"""
        SELECT t.id, p.name AS product, p.sku, t.type, t.quantity,
               t.previous_stock, t.new_stock, u.username, t.created_at,
               t.reference, t.notes
        FROM stock_transactions t
        JOIN products p ON p.id = t.product_id
        JOIN users u ON u.id = t.user_id
        {where_sql}
        ORDER BY t.created_at DESC
        LIMIT 500
        """,
        tuple(params),
    )
    return jsonify({"success": True, "report": rows})


@reports_bp.get("/audit-logs")
@login_required
def audit_report():
    if session.get("role") != "admin":
        return jsonify({"success": False, "message": "Forbidden"}), 403

    rows = fetch_all(
        """
        SELECT a.id, a.action, a.resource, a.resource_id, a.status,
               a.ip_address, a.created_at, u.username
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT 500
        """
    )
    return jsonify({"success": True, "report": rows})