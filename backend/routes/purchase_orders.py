"""Purchase Orders API routes."""
from flask import Blueprint, request, jsonify
from services.db import fetch_all, fetch_one, execute
from security import login_required, role_required

purchase_orders_bp = Blueprint("purchase_orders", __name__)


@purchase_orders_bp.get("/")
@login_required
def list_purchase_orders():
    """List purchase orders (paginated)."""
    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(200, max(1, int(request.args.get("limit", 20))))
        offset = (page - 1) * limit
        status = (request.args.get("status") or "").strip()

        where = []
        params = []

        if status:
            where.append("po.status = %s")
            params.append(status)

        where_sql = ("WHERE " + " AND ".join(where)) if where else ""

        total_row = fetch_one(
            f"SELECT COUNT(*) AS cnt FROM purchase_orders po {where_sql}",
            tuple(params),
        )
        total = total_row["cnt"] if total_row else 0

        rows = fetch_all(
            f"""
            SELECT
                po.id,
                po.po_number,
                po.supplier_id,
                s.name AS supplier_name,
                po.status,
                po.total_amount,
                po.notes,
                po.created_at,
                po.received_at,
                (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) AS item_count
            FROM purchase_orders po
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            {where_sql}
            ORDER BY po.created_at DESC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )

        return jsonify({
            "success": True,
            "orders": rows or [],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": max(1, (total + limit - 1) // limit),
            },
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_orders_bp.post("/")
@login_required
@role_required("admin")
def create_purchase_order():
    """Create a new purchase order."""
    try:
        data = request.get_json(silent=True) or {}
        supplier_id = data.get("supplier_id")
        items = data.get("items") or []
        notes = data.get("notes")

        if not supplier_id:
            return jsonify({"success": False, "message": "Supplier is required"}), 400
        if not items:
            return jsonify({"success": False, "message": "At least one item is required"}), 400

        total = sum(float(i.get("quantity", 0)) * float(i.get("unit_cost", 0)) for i in items)

        row = fetch_one(
            """
            INSERT INTO purchase_orders (supplier_id, status, total_amount, notes)
            VALUES (%s, 'pending', %s, %s)
            RETURNING id, po_number, created_at
            """,
            (supplier_id, total, notes),
        )

        if not row:
            return jsonify({"success": False, "message": "Failed to create order"}), 500

        po_id = row["id"]

        for item in items:
            execute(
                """
                INSERT INTO purchase_order_items
                    (purchase_order_id, product_id, quantity, unit_cost)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    po_id,
                    item.get("product_id"),
                    item.get("quantity", 0),
                    item.get("unit_cost", 0),
                ),
            )

        return jsonify({
            "success": True,
            "message": "Purchase order created",
            "order": {
                "id": po_id,
                "po_number": row["po_number"],
                "total_amount": total,
                "status": "pending",
            },
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_orders_bp.post("/<int:po_id>/receive")
@login_required
@role_required("admin")
def receive_purchase_order(po_id):
    """Mark a PO as received and add stock."""
    try:
        po = fetch_one("SELECT id, status FROM purchase_orders WHERE id = %s", (po_id,))
        if not po:
            return jsonify({"success": False, "message": "Purchase order not found"}), 404
        if po["status"] != "pending":
            return jsonify({"success": False, "message": "Order is not pending"}), 400

        items = fetch_all(
            "SELECT product_id, quantity, unit_cost FROM purchase_order_items WHERE purchase_order_id = %s",
            (po_id,),
        )

        for item in (items or []):
            execute(
                """
                UPDATE products
                SET current_stock = current_stock + %s
                WHERE id = %s
                """,
                (item["quantity"], item["product_id"]),
            )

        execute(
            "UPDATE purchase_orders SET status = 'received', received_at = NOW() WHERE id = %s",
            (po_id,),
        )

        return jsonify({"success": True, "message": "Order received, stock updated"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@purchase_orders_bp.post("/<int:po_id>/cancel")
@login_required
@role_required("admin")
def cancel_purchase_order(po_id):
    """Cancel a pending purchase order."""
    try:
        po = fetch_one("SELECT id, status FROM purchase_orders WHERE id = %s", (po_id,))
        if not po:
            return jsonify({"success": False, "message": "Purchase order not found"}), 404
        if po["status"] != "pending":
            return jsonify({"success": False, "message": "Only pending orders can be cancelled"}), 400

        execute(
            "UPDATE purchase_orders SET status = 'cancelled' WHERE id = %s",
            (po_id,),
        )
        return jsonify({"success": True, "message": "Order cancelled"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500