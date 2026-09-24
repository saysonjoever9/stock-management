from flask import Blueprint, request, jsonify, session
from services.db import fetch_all, fetch_one, execute
from services.audit import log_action
from middleware.auth import login_required, role_required
from utils.validators import clean_str

categories_bp = Blueprint("categories", __name__)


@categories_bp.get("/")
@login_required
def list_categories():
    rows = fetch_all(
        """
        SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
        FROM categories c
        ORDER BY c.name
        """
    )
    return jsonify({"success": True, "categories": rows})


@categories_bp.post("/")
@login_required
@role_required("admin")
def create_category():
    data = request.get_json(silent=True) or {}
    name = clean_str(data.get("name"), 100)
    description = clean_str(data.get("description"), 500)
    if not name:
        return jsonify({"success": False, "message": "Name required"}), 400

    try:
        row = execute(
            "INSERT INTO categories (name, description) VALUES (%s, %s) RETURNING *",
            (name, description), returning=True,
        )
    except Exception as e:
        if "unique" in str(e).lower():
            return jsonify({"success": False, "message": "Category already exists"}), 409
        raise

    log_action(session.get("user_id"), "category_create", "category", str(row["id"]))
    return jsonify({"success": True, "category": row}), 201


@categories_bp.put("/<int:cid>")
@login_required
@role_required("admin")
def update_category(cid):
    data = request.get_json(silent=True) or {}
    name = clean_str(data.get("name"), 100)
    description = clean_str(data.get("description"), 500)
    if not name:
        return jsonify({"success": False, "message": "Name required"}), 400

    row = execute(
        "UPDATE categories SET name=%s, description=%s WHERE id=%s RETURNING *",
        (name, description, cid), returning=True,
    )
    if not row:
        return jsonify({"success": False, "message": "Category not found"}), 404

    log_action(session.get("user_id"), "category_update", "category", str(cid))
    return jsonify({"success": True, "category": row})


@categories_bp.delete("/<int:cid>")
@login_required
@role_required("admin")
def delete_category(cid):
    # Prevent deletion if products are linked (safer than silent SET NULL)
    linked = fetch_one("SELECT COUNT(*) AS c FROM products WHERE category_id=%s", (cid,))
    if linked and linked["c"] > 0:
        return jsonify({"success": False,
                        "message": "Cannot delete: products are assigned to this category"}), 409

    row = execute("DELETE FROM categories WHERE id=%s RETURNING id", (cid,), returning=True)
    if not row:
        return jsonify({"success": False, "message": "Category not found"}), 404

    log_action(session.get("user_id"), "category_delete", "category", str(cid))
    return jsonify({"success": True})