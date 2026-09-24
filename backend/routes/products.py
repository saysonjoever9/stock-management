from flask import Blueprint, request, jsonify, session
from services.db import fetch_all, fetch_one, execute
from services.audit import log_action
from middleware.auth import login_required, role_required
from utils.validators import (
    clean_str, is_valid_sku, to_int, to_float
)

products_bp = Blueprint("products", __name__)


@products_bp.get("/")
@login_required
def list_products():
    # Pagination & filters
    page = max(to_int(request.args.get("page"), 1), 1)
    limit = min(max(to_int(request.args.get("limit"), 10), 1), 200)
    offset = (page - 1) * limit

    search = clean_str(request.args.get("search"), 100)
    category_id = to_int(request.args.get("category_id"))
    supplier_id = to_int(request.args.get("supplier_id"))
    status = request.args.get("status")
    sort = request.args.get("sort", "name")
    order = "DESC" if request.args.get("order", "asc").lower() == "desc" else "ASC"

    sortable = {
        "name": "p.name",
        "sku": "p.sku",
        "current_stock": "p.current_stock",
        "selling_price": "p.selling_price",
        "created_at": "p.created_at",
    }
    sort_col = sortable.get(sort, "p.name")

    where, params = [], []
    if search:
        params.append(f"%{search}%")
        where.append(f"(p.name ILIKE %s OR p.sku ILIKE %s)")
        params.append(f"%{search}%")
    if category_id:
        params.append(category_id); where.append(f"p.category_id = %s")
    if supplier_id:
        params.append(supplier_id); where.append(f"p.supplier_id = %s")
    if status == "low":
        where.append("p.current_stock > 0 AND p.current_stock <= p.min_stock_level")
    elif status == "out":
        where.append("p.current_stock = 0")
    elif status == "in":
        where.append("p.current_stock > p.min_stock_level")
    elif status in ("active", "inactive"):
        params.append(status); where.append("p.status = %s")

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    total_row = fetch_one(f"SELECT COUNT(*) AS c FROM products p {where_sql}", tuple(params))
    total = total_row["c"] if total_row else 0

    rows = fetch_all(
        f"""
        SELECT p.*, c.name AS category_name, s.name AS supplier_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        {where_sql}
        ORDER BY {sort_col} {order}
        LIMIT %s OFFSET %s
        """,
        tuple(params + [limit, offset]),
    )

    return jsonify({
        "success": True,
        "products": rows,
        "pagination": {
            "page": page, "limit": limit, "total": total,
            "pages": max((total + limit - 1) // limit, 1),
        },
    })


@products_bp.get("/<int:pid>")
@login_required
def get_product(pid):
    row = fetch_one(
        """
        SELECT p.*, c.name AS category_name, s.name AS supplier_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        WHERE p.id = %s
        """,
        (pid,),
    )
    if not row:
        return jsonify({"success": False, "message": "Product not found"}), 404
    return jsonify({"success": True, "product": row})


def _validate_product(data):
    sku = clean_str(data.get("sku"), 60)
    name = clean_str(data.get("name"), 150)
    barcode = clean_str(data.get("barcode"), 60)
    if not is_valid_sku(sku):
        return None, "Invalid SKU"
    if not name:
        return None, "Name required"
    if barcode and not is_valid_sku(barcode):
        return None, "Invalid barcode"

    cost = to_float(data.get("cost_price"), 0)
    sell = to_float(data.get("selling_price"), 0)
    if cost is None or cost < 0:
        return None, "Invalid cost price"
    if sell is None or sell < 0:
        return None, "Invalid selling price"

    min_lvl = to_int(data.get("min_stock_level"), 0) or 0
    max_lvl = to_int(data.get("max_stock_level"), 0) or 0
    status = data.get("status", "active")
    if status not in ("active", "inactive"):
        return None, "Invalid status"

    return {
        "sku": sku, "name": name, "barcode": barcode,
        "description": clean_str(data.get("description"), 1000),
        "category_id": to_int(data.get("category_id")),
        "supplier_id": to_int(data.get("supplier_id")),
        "unit": clean_str(data.get("unit"), 20) or "pcs",
        "cost_price": cost, "selling_price": sell,
        "min_stock_level": min_lvl, "max_stock_level": max_lvl,
        "status": status,
    }, None


@products_bp.post("/")
@login_required
@role_required("admin")
def create_product():
    data = request.get_json(silent=True) or {}
    payload, err = _validate_product(data)
    if err:
        return jsonify({"success": False, "message": err}), 400

    initial_stock = to_int(data.get("current_stock"), 0) or 0
    if initial_stock < 0:
        return jsonify({"success": False, "message": "Stock cannot be negative"}), 400

    try:
        row = execute(
            """
            INSERT INTO products
                (sku, barcode, name, description, category_id, supplier_id, unit,
                 cost_price, selling_price, current_stock, min_stock_level, max_stock_level, status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING *
            """,
            (
                payload["sku"], payload["barcode"], payload["name"], payload["description"],
                payload["category_id"], payload["supplier_id"], payload["unit"],
                payload["cost_price"], payload["selling_price"], initial_stock,
                payload["min_stock_level"], payload["max_stock_level"], payload["status"],
            ),
            returning=True,
        )
    except Exception as e:
        msg = str(e).lower()
        if "unique" in msg:
            return jsonify({"success": False, "message": "SKU or barcode already exists"}), 409
        raise

    log_action(session.get("user_id"), "product_create", "product", str(row["id"]))
    return jsonify({"success": True, "product": row}), 201


@products_bp.put("/<int:pid>")
@login_required
@role_required("admin")
def update_product(pid):
    data = request.get_json(silent=True) or {}
    payload, err = _validate_product(data)
    if err:
        return jsonify({"success": False, "message": err}), 400

    existing = fetch_one("SELECT * FROM products WHERE id=%s", (pid,))
    if not existing:
        return jsonify({"success": False, "message": "Product not found"}), 404

    try:
        row = execute(
            """
            UPDATE products SET
                sku=%s, barcode=%s, name=%s, description=%s,
                category_id=%s, supplier_id=%s, unit=%s,
                cost_price=%s, selling_price=%s,
                min_stock_level=%s, max_stock_level=%s, status=%s
            WHERE id=%s RETURNING *
            """,
            (
                payload["sku"], payload["barcode"], payload["name"], payload["description"],
                payload["category_id"], payload["supplier_id"], payload["unit"],
                payload["cost_price"], payload["selling_price"],
                payload["min_stock_level"], payload["max_stock_level"], payload["status"],
                pid,
            ),
            returning=True,
        )
    except Exception as e:
        if "unique" in str(e).lower():
            return jsonify({"success": False, "message": "SKU or barcode already exists"}), 409
        raise

    log_action(session.get("user_id"), "product_update", "product", str(pid))
    return jsonify({"success": True, "product": row})


@products_bp.delete("/<int:pid>")
@login_required
@role_required("admin")
def delete_product(pid):
    # Soft-delete via status to preserve transaction history integrity
    row = execute(
        "UPDATE products SET status='inactive' WHERE id=%s RETURNING *",
        (pid,), returning=True,
    )
    if not row:
        return jsonify({"success": False, "message": "Product not found"}), 404

    log_action(session.get("user_id"), "product_deactivate", "product", str(pid))
    return jsonify({"success": True})