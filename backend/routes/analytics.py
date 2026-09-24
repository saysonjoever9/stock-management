"""Analytics API routes - aggregated stats and trends."""
from flask import Blueprint, jsonify
from services.db import fetch_one, fetch_all
from security import login_required, role_required

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/dashboard")
@login_required
def dashboard():
    """Return aggregated dashboard stats."""
    try:
        stats = fetch_one("""
            SELECT
                (SELECT COUNT(*) FROM products WHERE status = 'active') AS total_products,
                (SELECT COALESCE(SUM(current_stock), 0) FROM products WHERE status = 'active') AS total_stock,
                (SELECT COALESCE(SUM(current_stock * cost_price), 0) FROM products WHERE status = 'active') AS inventory_value,
                (SELECT COUNT(*) FROM products WHERE status = 'active' AND current_stock <= min_stock_level AND current_stock > 0) AS low_stock,
                (SELECT COUNT(*) FROM products WHERE status = 'active' AND current_stock <= 0) AS out_of_stock,
                (SELECT COUNT(*) FROM categories) AS total_categories,
                (SELECT COUNT(*) FROM suppliers) AS total_suppliers
        """) or {}

        return jsonify({"success": True, "stats": stats})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@analytics_bp.get("/sales-trend")
@login_required
def sales_trend():
    """Return sales trend for last 30 days."""
    try:
        rows = fetch_all("""
            SELECT
                DATE(created_at) AS day,
                COALESCE(SUM(quantity), 0) AS total_qty
            FROM inventory_transactions
            WHERE type IN ('out', 'sale')
              AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        """)
        return jsonify({"success": True, "data": rows or []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@analytics_bp.get("/top-products")
@login_required
def top_products():
    """Return top-selling products (last 30 days)."""
    try:
        rows = fetch_all("""
            SELECT
                p.name,
                p.sku,
                COALESCE(SUM(t.quantity), 0) AS total_sold
            FROM inventory_transactions t
            JOIN products p ON p.id = t.product_id
            WHERE t.type IN ('out', 'sale')
              AND t.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY p.id, p.name, p.sku
            ORDER BY total_sold DESC
            LIMIT 10
        """)
        return jsonify({"success": True, "data": rows or []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@analytics_bp.get("/low-stock")
@login_required
def low_stock():
    """Return products with low stock."""
    try:
        rows = fetch_all("""
            SELECT id, sku, name, current_stock, min_stock_level
            FROM products
            WHERE status = 'active'
              AND current_stock <= min_stock_level
            ORDER BY current_stock ASC
            LIMIT 50
        """)
        return jsonify({"success": True, "data": rows or []})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500