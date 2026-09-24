from flask import Blueprint, request, jsonify, session
from services.db import get_connection, fetch_all, fetch_one
from services.audit import log_action
from middleware.auth import login_required, role_required
from utils.validators import to_int, to_float, clean_str
from psycopg.rows import dict_row

inventory_bp = Blueprint("inventory", __name__)


def _run_stock_op(user_id, product_id, op_type, quantity, extra):
    """Atomic stock operation using SELECT ... FOR UPDATE."""
    conn = get_connection()
    try:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT id, current_stock FROM products WHERE id=%s FOR UPDATE", (product_id,))
            prod = cur.fetchone()
            if not prod:
                conn.rollback()
                return None, "Product not found"

            prev = prod["current_stock"]
            if op_type == "in":
                new = prev + quantity
            elif op_type == "out":
                new = prev - quantity
                if new < 0:
                    conn.rollback()
                    return None, "Insufficient stock"
            elif op_type == "adjustment":
                new = quantity
            else:
                conn.rollback()
                return None, "Invalid operation"

            cur.execute("UPDATE products SET current_stock=%s WHERE id=%s",
                        (new, product_id))

            diff_qty = abs(new - prev) if op_type == "adjustment" else quantity
            cur.execute(
                """
                INSERT INTO stock_transactions
                    (product_id, user_id, type, quantity, previous_stock, new_stock,
                     unit_cost, supplier_id, reason, reference, notes)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
                """,
                (product_id, user_id, op_type, diff_qty, prev, new,
                 extra.get("unit_cost"), extra.get("supplier_id"),
                 extra.get("reason"), extra.get("reference"), extra.get("notes")),
            )
            tx = cur.fetchone()
        conn.commit()
        return tx, None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@inventory_bp.post("/stock-in")
@login_required
def stock_in():
    data = request.get_json(silent=True) or {}
    pid = to_int(data.get("product_id"))
    qty = to_int(data.get("quantity"))
    if not pid or not qty or qty <= 0:
        return jsonify({"success": False, "message": "Invalid product or quantity"}), 400

    tx, err = _run_stock_op(
        session["user_id"], pid, "in", qty,
        {
            "unit_cost": to_float(data.get("unit_cost")),
            "supplier_id": to_int(data.get("supplier_id")),
            "reference": clean_str(data.get("reference"), 100),
            "notes": clean_str(data.get("notes"), 500),
        },
    )
    if err:
        return jsonify({"success": False, "message": err}), 400

    log_action(session["user_id"], "stock_in", "product", str(pid),
               details=f"qty={qty}")
    return jsonify({"success": True, "transaction": tx}), 201


@inventory_bp.post("/stock-out")
@login_required
def stock_out():
    data = request.get_json(silent=True) or {}
    pid = to_int(data.get("product_id"))
    qty = to_int(data.get("quantity"))
    if not pid or not qty or qty <= 0:
        return jsonify({"success": False, "message": "Invalid product or quantity"}), 400

    tx, err = _run_stock_op(
        session["user_id"], pid, "out", qty,
        {
            "reason": clean_str(data.get("reason"), 100),
            "reference": clean_str(data.get("reference"), 100),
            "notes": clean_str(data.get("notes"), 500),
        },
    )
    if err:
        return jsonify({"success": False, "message": err}), 400

    log_action(session["user_id"], "stock_out", "product", str(pid),
               details=f"qty={qty}")
    return jsonify({"success": True, "transaction": tx}), 201


@inventory_bp.post("/adjustment")
@login_required
@role_required("admin")
def adjustment():
    data = request.get_json(silent=True) or {}
    pid = to_int(data.get("product_id"))
    new_qty = to_int(data.get("new_quantity"))
    if not pid or new_qty is None or new_qty < 0:
        return jsonify({"success": False, "message": "Invalid product or new quantity"}), 400

    tx, err = _run_stock_op(
        session["user_id"], pid, "adjustment", new_qty,
        {
            "reason": clean_str(data.get("reason"), 100) or "Manual adjustment",
            "notes": clean_str(data.get("notes"), 500),
        },
    )
    if err:
        return jsonify({"success": False, "message": err}), 400

    log_action(session["user_id"], "stock_adjustment", "product", str(pid),
               details=f"new_qty={new_qty}")
    return jsonify({"success": True, "transaction": tx}), 201


@inventory_bp.get("/transactions")
@login_required
def transactions():
    page = max(to_int(request.args.get("page"), 1), 1)
    limit = min(max(to_int(request.args.get("limit"), 20), 1), 200)
    offset = (page - 1) * limit

    where, params = [], []
    if request.args.get("product_id"):
        params.append(to_int(request.args["product_id"])); where.append("t.product_id=%s")
    if request.args.get("type"):
        params.append(request.args["type"]); where.append("t.type=%s")
    if request.args.get("user_id"):
        params.append(to_int(request.args["user_id"])); where.append("t.user_id=%s")
    if request.args.get("date_from"):
        params.append(request.args["date_from"]); where.append("t.created_at >= %s")
    if request.args.get("date_to"):
        params.append(request.args["date_to"]); where.append("t.created_at <= %s")

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    total = fetch_one(
        f"SELECT COUNT(*) AS c FROM stock_transactions t {where_sql}",
        tuple(params),
    )["c"]

    rows = fetch_all(
        f"""
        SELECT t.*, p.name AS product_name, p.sku,
               u.username, u.full_name
        FROM stock_transactions t
        JOIN products p ON p.id = t.product_id
        JOIN users u ON u.id = t.user_id
        {where_sql}
        ORDER BY t.created_at DESC
        LIMIT %s OFFSET %s
        """,
        tuple(params + [limit, offset]),
    )

    return jsonify({
        "success": True,
        "transactions": rows,
        "pagination": {
            "page": page, "limit": limit, "total": total,
            "pages": max((total + limit - 1) // limit, 1),
        },
    })