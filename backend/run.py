import os
import socket
import subprocess
from flask import Flask, render_template, session, redirect, url_for
from flask_cors import CORS

from config import Config
from security import init_security
from security.csrf import exempt_api_views

from routes.auth import auth_bp
from routes.users import users_bp
from routes.products import products_bp
from routes.categories import categories_bp
from routes.suppliers import suppliers_bp
from routes.inventory import inventory_bp
from routes.reports import reports_bp
from routes.audit import audit_bp
from routes.analytics import analytics_bp
from routes.pricing import pricing_bp
from routes.purchase_orders import purchase_orders_bp


def _port_is_taken(host, port):
    """True when something is already accepting TCP connections on host:port."""
    probe_host = "127.0.0.1" if host in ("0.0.0.0", "::", "") else host
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            return sock.connect_ex((probe_host, port)) == 0
    except OSError:
        return False


def _listener_pids(port):
    """Best-effort list of PIDs listening on a TCP port (Windows only)."""
    if os.name != "nt":
        return []
    try:
        output = subprocess.check_output(
            ["netstat", "-ano", "-p", "TCP"],
            encoding="utf-8",
            errors="ignore",
            timeout=5,
        )
    except Exception:
        return []

    pids = []
    for line in output.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[3] == "LISTENING" and parts[1].endswith(f":{port}"):
            if parts[4].isdigit() and parts[4] not in pids:
                pids.append(parts[4])
    return pids


def create_app():
    base_dir = os.path.abspath(os.path.dirname(__file__))
    frontend_dir = os.path.join(os.path.dirname(base_dir), "frontend")

    app = Flask(
        __name__,
        template_folder=frontend_dir,
        static_folder=frontend_dir,
        static_url_path="",
    )
    app.config.from_object(Config)

    # ---------- CORS (para sa Vercel -> Render cross-origin) ----------
    CORS(
        app,
        supports_credentials=True,
        origins=[
            "https://stock-management-alpha-indol.vercel.app",
            "https://*.vercel.app",
            "http://localhost:5000",
            "http://127.0.0.1:5000",
        ],
        allow_headers=["Content-Type", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        expose_headers=["Content-Type"],
    )

    # ---------- BLUEPRINTS ----------
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(products_bp, url_prefix="/api/products")
    app.register_blueprint(categories_bp, url_prefix="/api/categories")
    app.register_blueprint(suppliers_bp, url_prefix="/api/suppliers")
    app.register_blueprint(inventory_bp, url_prefix="/api/inventory")
    app.register_blueprint(reports_bp, url_prefix="/api/reports")
    app.register_blueprint(audit_bp, url_prefix="/api/audit")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(pricing_bp, url_prefix="/api/pricing")
    app.register_blueprint(purchase_orders_bp, url_prefix="/api/purchase-orders")

    # ---------- SECURITY ----------
    init_security(app)
    exempt_api_views(app)

    # ---------- PAGE ROUTES ----------
    @app.route("/")
    def page_login():
        if session.get("user_id"):
            return redirect(url_for("page_dashboard"))
        return render_template("index.html")

    @app.route("/register")
    def page_register():
        if session.get("user_id"):
            return redirect(url_for("page_dashboard"))
        return render_template("register.html")

    @app.route("/dashboard")
    def page_dashboard():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("dashboard.html")

    @app.route("/products")
    def page_products():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("products.html")

    @app.route("/categories")
    def page_categories():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("categories.html")

    @app.route("/suppliers")
    def page_suppliers():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("suppliers.html")

    @app.route("/inventory")
    def page_inventory():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("inventory.html")

    @app.route("/transactions")
    def page_transactions():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("transactions.html")

    @app.route("/reports")
    def page_reports():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("reports.html")

    @app.route("/users")
    def page_users():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        if session.get("role") != "admin":
            return redirect(url_for("page_dashboard"))
        return render_template("users.html")

    @app.route("/pending")
    def page_pending():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        if session.get("role") != "admin":
            return redirect(url_for("page_dashboard"))
        return render_template("pending.html")

    @app.route("/audit")
    def page_audit():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        if session.get("role") != "admin":
            return redirect(url_for("page_dashboard"))
        return render_template("audit.html")

    @app.route("/analytics")
    def page_analytics():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        if session.get("role") != "admin":
            return redirect(url_for("page_dashboard"))
        return render_template("analytics.html")

    @app.route("/purchase-orders")
    def page_purchase_orders():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        if session.get("role") != "admin":
            return redirect(url_for("page_dashboard"))
        return render_template("purchase-orders.html")

    @app.route("/pricing")
    def page_pricing():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        if session.get("role") != "admin":
            return redirect(url_for("page_dashboard"))
        return render_template("pricing.html")

    @app.route("/settings")
    def page_settings():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        if session.get("role") != "admin":
            return redirect(url_for("page_dashboard"))
        return render_template("settings.html")

    @app.route("/customers")
    def page_customers():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("customers.html")

    @app.route("/pos")
    def page_pos():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("pos.html")

    @app.route("/scanner")
    def page_scanner():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("scanner.html")

    @app.route("/stock-in")
    def page_stock_in():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("stock-in.html")

    @app.route("/stock-out")
    def page_stock_out():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("stock-out.html")

    @app.route("/adjustment")
    def page_adjustment():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("adjustment.html")

    @app.route("/my-transactions")
    def page_my_transactions():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("my-transactions.html")

    @app.route("/my-requests")
    def page_my_requests():
        if not session.get("user_id"):
            return redirect(url_for("page_login"))
        return render_template("my-requests.html")

    return app


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))

    try:
        from waitress import serve
        use_waitress = True
    except ImportError:
        use_waitress = False

    app = create_app()

    # Refuse to start a second server on the same port (local dev safeguard)
    if _port_is_taken("127.0.0.1", port):
        pids = _listener_pids(port)
        holders = ", ".join(pids) if pids else "an unknown process"
        print(f"[ERROR] Port {port} is already in use by {holders}.")
        print("        Stop it first (PowerShell):")
        if pids:
            for pid in pids:
                print(f"          Stop-Process -Id {pid} -Force")
        else:
            print(f"          netstat -ano | findstr :{port}")
            print("          Stop-Process -Id <PID> -Force")
        raise SystemExit(1)

    for warning in Config.startup_warnings():
        print(f"[WARN] {warning}")

    print(f"Server running on http://0.0.0.0:{port}")
    print(f"DB target: {Config.DB_USER}@{Config.DB_HOST}:{Config.DB_PORT}/{Config.DB_NAME}")

    if use_waitress:
        serve(app, host="0.0.0.0", port=port, threads=8)
    else:
        print("[WARN] waitress not installed — using Flask dev server")
        app.run(host="0.0.0.0", port=port, debug=False)