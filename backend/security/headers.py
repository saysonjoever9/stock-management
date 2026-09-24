"""Security headers for the stock management API.

IMPORTANT: This module ONLY adds response headers.
No host validation / TrustedHost middleware is registered here.
"""


def register_security_headers(app):
    """Register security headers for all responses (NO host checking)."""

    @app.after_request
    def set_security_headers(response):
        """Add security headers to every response."""
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "SAMEORIGIN"

        # Enable XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self';"
        )

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HTML pages (ug API JSON) — dili i-cache sa browser aron ang daan nga
        # layout dili na mo-gawas pag-usab human sa code change. Ang /css ug
        # /js files wala maapil (separate mimetype) kay pwede ra ma-cache.
        if response.mimetype == "text/html":
            response.headers["Cache-Control"] = "no-store, max-age=0"

        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(self), "
            "payment=()"
        )

        return response

    return app