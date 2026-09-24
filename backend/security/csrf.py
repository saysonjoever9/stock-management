"""CSRF protection for the stock management API.

The frontend talks to the API with JSON over XHR using same-site
session cookies (SameSite=Lax) plus an X-Requested-With header.
That combination blocks cross-site form posts, so requests under
the /api/ namespace are exempted from CSRF token validation.
"""

from flask_wtf.csrf import CSRFProtect, CSRFError
from flask import jsonify

csrf = CSRFProtect()

_API_PREFIX = "/api/"


def init_csrf_protection(app):
    """Initialize CSRF protection for the Flask application."""
    csrf.init_app(app)

    @app.errorhandler(CSRFError)
    def handle_csrf_error(e):
        return jsonify({
            "success": False,
            "message": "CSRF token missing or invalid",
        }), 400

    return csrf


def exempt_api_views(app):
    """Exempt every /api/* view from CSRF checks.

    Called after blueprints are registered so every view function is
    visible in app.view_functions.
    """
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith(_API_PREFIX):
            view = app.view_functions.get(rule.endpoint)
            if view is not None:
                csrf.exempt(view)