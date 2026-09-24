"""Error handlers for security-related exceptions and HTTP errors."""

from flask import jsonify


def register_error_handlers(app):
    """Register error handlers for common exceptions and HTTP errors."""

    @app.errorhandler(400)
    def bad_request(error):
        msg = getattr(error, "description", None) or "Bad request"
        return jsonify({"success": False, "message": msg}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        msg = getattr(error, "description", None) or "Unauthorized"
        return jsonify({"success": False, "message": msg}), 401

    @app.errorhandler(403)
    def forbidden(error):
        msg = getattr(error, "description", None) or "Forbidden"
        return jsonify({"success": False, "message": msg}), 403

    @app.errorhandler(404)
    def not_found(error):
        msg = getattr(error, "description", None) or "Not found"
        return jsonify({"success": False, "message": msg}), 404

    @app.errorhandler(429)
    def too_many_requests(error):
        msg = getattr(error, "description", None) or "Too many requests"
        return jsonify({"success": False, "message": msg}), 429

    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({"success": False, "message": "Internal server error"}), 500

    return app