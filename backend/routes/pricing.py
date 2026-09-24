"""Pricing API routes - manage product prices & margins."""
from flask import Blueprint, request, jsonify
from services.db import fetch_all, fetch_one, execute
from security import login_required, role_required

pricing_bp = Blueprint("pricing", __name__)


@pricing_bp.get("/")
@login_required
def list_pricing():
    """Return products with pricing info."""
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(200, max(1, int(request.args.get("limit", 20))))
        offset = (page - 1) * limit

        search = (request.args.get("search") or "").strip()
        category_id = request.args.get("category_id")

        where = ["p.status = 'active'"]
        params = []

        if search:
            where.append("(p.name ILIKE %s OR p.sku ILIKE %s)")
            params.extend([f"%{search}%", f"%{search}%"])

        if category_id:
            where.append("p.category_id = %s")
            params.append(category_id)

        where_sql = " AND ".join(where)

        total_row = fetch_one(
            f"SELECT COUNT(*) AS cnt FROM products p WHERE {where_sql}",
            tuple(params),
        )
        total = total_row["cnt"] if total_row else 0

        rows = fetch_all(
            f"""
            SELECT
                p.id, p.sku, p.name,
                p.cost_price, p.selling_price,
                c.name AS category_name
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE {where_sql}
            ORDER BY p.name ASC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )

        return jsonify({
            "success": True,
            "products": rows or [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": max(1, (total + limit - 1) // limit),
            },
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@pricing_bp.put("/<int:product_id>")
@login_required
@role_required("admin")
def update_pricing(product_id):
    """Update cost_price and selling_price for a product."""
    try:
        data = request.get_json(silent=True) or {}
        cost_price = float(data.get("cost_price", 0))
        selling_price = float(data.get("selling_price", 0))

        if cost_price < 0 or selling_price < 0:
            return jsonify({"success": False, "message": "Prices must be non-negative"}), 400

        product = fetch_one("SELECT id FROM products WHERE id = %s", (product_id,))
        if not product:
            return jsonify({"success": False, "message": "Product not found"}), 404

        execute(
            "UPDATE products SET cost_price = %s, selling_price = %s WHERE id = %s",
            (cost_price, selling_price, product_id),
        )

        return jsonify({"success": True, "message": "Pricing updated"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500