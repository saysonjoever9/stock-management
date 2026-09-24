from flask import Blueprint, request, jsonify, session
from services.db import fetch_all, fetch_one, execute
from services.audit import log_action
from middleware.auth import login_required, role_required
from utils.validators import clean_str, is_valid_email

suppliers_bp = Blueprint("suppliers", __name__)


@suppliers_bp.get("/")
@login_required
def list_suppliers():
    rows = fetch_all(
        """
        SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS product_count
        FROM suppliers s ORDER BY s.name
        """
    )
    return jsonify({"success": True, "suppliers": rows})


@suppliers_bp.post("/")
@login_required
@role_required("admin")
def create_supplier():
    data = request.get_json(silent=True) or {}
    name = clean_str(data.get("name"), 150)
    if not name:
        return jsonify({"success": False, "message": "Name required"}), 400

    email = clean_str(data.get("email"), 120)
    if email and not is_valid_email(email):
        return jsonify({"success": False, "message": "Invalid email"}), 400

    row = execute(
        """
        INSERT INTO suppliers (name, contact_person, email, phone, address, notes)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING *
        """,
        (name,
         clean_str(data.get("contact_person"), 120),
         email,
         clean_str(data.get("phone"), 30),
         clean_str(data.get("address"), 500),
         clean_str(data.get("notes"), 500)),
        returning=True,
    )
    log_action(session.get("user_id"), "supplier_create", "supplier", str(row["id"]))
    return jsonify({"success": True, "supplier": row}), 201


@suppliers_bp.put("/<int:sid>")
@login_required
@role_required("admin")
def update_supplier(sid):
    data = request.get_json(silent=True) or {}
    name = clean_str(data.get("name"), 150)
    if not name:
        return jsonify({"success": False, "message": "Name required"}), 400

    email = clean_str(data.get("email"), 120)
    if email and not is_valid_email(email):
        return jsonify({"success": False, "message": "Invalid email"}), 400

    row = execute(
        """
        UPDATE suppliers SET name=%s, contact_person=%s, email=%s, phone=%s, address=%s, notes=%s
        WHERE id=%s RETURNING *
        """,
        (name,
         clean_str(data.get("contact_person"), 120),
         email,
         clean_str(data.get("phone"), 30),
         clean_str(data.get("address"), 500),
         clean_str(data.get("notes"), 500),
         sid),
        returning=True,
    )
    if not row:
        return jsonify({"success": False, "message": "Supplier not found"}), 404

    log_action(session.get("user_id"), "supplier_update", "supplier", str(sid))
    return jsonify({"success": True, "supplier": row})


@suppliers_bp.delete("/<int:sid>")
@login_required
@role_required("admin")
def delete_supplier(sid):
    linked = fetch_one("SELECT COUNT(*) AS c FROM products WHERE supplier_id=%s", (sid,))
    if linked and linked["c"] > 0:
        return jsonify({"success": False,
                        "message": "Cannot delete: products are linked to this supplier"}), 409

    row = execute("DELETE FROM suppliers WHERE id=%s RETURNING id", (sid,), returning=True)
    if not row:
        return jsonify({"success": False, "message": "Supplier not found"}), 404

    log_action(session.get("user_id"), "supplier_delete", "supplier", str(sid))
    return jsonify({"success": True})