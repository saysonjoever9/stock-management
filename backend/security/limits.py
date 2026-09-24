from flask_limiter import Limiter

from config import Config
from security.client import client_ip

limiter = Limiter(
    key_func=client_ip,
    storage_uri=Config.RATELIMIT_STORAGE_URI,
    default_limits=[Config.GLOBAL_RATE_LIMIT] if Config.GLOBAL_RATE_LIMIT else None,
    headers_enabled=True,
    strategy="fixed-window",
    enabled=Config.RATE_LIMIT_ENABLED,
)


def init_rate_limiter(app):
    """Bind the shared limiter instance to the application."""
    limiter.init_app(app)
    return limiter
