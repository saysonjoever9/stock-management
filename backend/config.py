"""Application configuration with security-first defaults."""

import os
import re
import secrets
import socket
import subprocess
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# ============================================================
# Load .env gikan sa PROJECT ROOT (parent sa backend/)
# Absolute path — dili mag-depende sa current working directory
# ============================================================
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

_WEAK_SECRET_MARKERS = (
    "change", "changeme", "secret", "example", "placeholder",
    "test", "password", "insecure", "dev",
)
_MIN_SECRET_LENGTH = 32

# Subnet masks & reserved addresses we never want in TRUSTED_HOSTS
_BAD_IPS = {
    "0.0.0.0",
    "255.255.255.255",
    "255.255.255.0",
    "255.255.254.0",
    "255.255.252.0",
    "255.255.248.0",
    "255.255.240.0",
    "255.255.224.0",
    "255.255.192.0",
    "255.255.128.0",
    "255.255.0.0",
    "255.0.0.0",
}

# Shapes Werkzeug's host matcher can actually compare. Anything else (spaces,
# non-ASCII, punctuation) can never equal a Host header, and some values even
# make Werkzeug's idna encoding raise UnicodeError at request time, so they are
# dropped from the allowlist.
_HOSTNAME_ENTRY_RE = re.compile(r"\.?[a-z0-9](?:[a-z0-9.\-]*[a-z0-9])?")
_IPV6_ENTRY_RE = re.compile(r"\[[0-9a-f:.]+\]")


def env_bool(name, default=False):
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def env_int(name, default):
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return default


def looks_weak_secret(value):
    """True when a value is too short or is an obvious placeholder."""
    if not value or len(value) < _MIN_SECRET_LENGTH:
        return True
    lowered = value.lower()
    return any(marker in lowered for marker in _WEAK_SECRET_MARKERS)


def _csv_env(name, default=()):
    raw = os.getenv(name, "")
    items = [item.strip() for item in raw.split(",") if item.strip()]
    return items or list(default)


def _normalize_host_entry(value):
    """Normalize one allowed-host entry into what Werkzeug compares against."""
    if not value:
        return ""

    entry = str(value).strip().lower()

    # Drop a scheme and/or a trailing path if a URL was pasted in by mistake
    if "://" in entry:
        entry = entry.split("://", 1)[1]
    entry = entry.split("/", 1)[0].strip()

    # "*.example.com" -> ".example.com" (Werkzeug: leading dot = suffix match).
    if entry.startswith("*."):
        entry = entry[1:]
    elif entry.startswith("*"):
        return ""

    if not entry or entry in _BAD_IPS:
        return ""

    if entry.startswith("["):
        closing = entry.find("]")
        if closing == -1:
            return ""
        entry = entry[: closing + 1]
    elif entry.count(":") > 1:
        # Bare IPv6 address - Werkzeug only matches the bracketed form
        entry = f"[{entry}]"
    else:
        # IPv4 address or hostname, optionally with ":port" (port is ignored)
        entry = entry.partition(":")[0]

    if not entry or entry in _BAD_IPS or entry.startswith("255."):
        return ""

    if entry.startswith("["):
        valid = _IPV6_ENTRY_RE.fullmatch(entry) is not None
    else:
        valid = _HOSTNAME_ENTRY_RE.fullmatch(entry) is not None

    return entry if valid else ""


def _local_ipv4_addresses():
    """Best-effort discovery of this machine's LAN IPv4 addresses."""
    found = set()

    # ---- Strategy 1: hostname resolution ----
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in _BAD_IPS:
                found.add(ip)
    except Exception:
        pass

    # ---- Strategy 2: outbound UDP route ----
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        if ip and not ip.startswith("127.") and ip not in _BAD_IPS:
            found.add(ip)
        s.close()
    except Exception:
        pass

    # ---- Strategy 3: parse OS network output ----
    try:
        if os.name == "nt":
            out = subprocess.check_output(
                ["ipconfig"],
                encoding="utf-8",
                errors="ignore",
                timeout=3,
            )
            matches = re.findall(
                r"IPv4[^:]*:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})",
                out,
            )
        else:
            try:
                out = subprocess.check_output(
                    ["ip", "-4", "addr"],
                    encoding="utf-8",
                    errors="ignore",
                    timeout=3,
                )
            except Exception:
                out = subprocess.check_output(
                    ["ifconfig"],
                    encoding="utf-8",
                    errors="ignore",
                    timeout=3,
                )
            matches = re.findall(
                r"inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})",
                out,
            )

        for ip in matches:
            if ip.startswith("127."):
                continue
            if ip in _BAD_IPS:
                continue
            if ip.startswith("255."):
                continue
            try:
                parts = ip.split(".")
                if all(0 <= int(p) <= 255 for p in parts):
                    found.add(ip)
            except Exception:
                pass
    except Exception:
        pass

    return sorted(found)


_BOOT_ERROR = """
[SECURITY] Refusing to start: FLASK_SECRET_KEY is missing or too weak.

Generate a strong key and put it in .env, then restart:

    python -c "import secrets; print(secrets.token_hex(32))"

    FLASK_SECRET_KEY=<the value printed above>

If this is a throwaway local environment and you accept the risk, set
ALLOW_INSECURE_DEV_SECRET=true.
""".strip()


class Config:
    # ---------------- environment ----------------
    FLASK_ENV = os.getenv("FLASK_ENV", "development").strip().lower()
    IS_PRODUCTION = FLASK_ENV in ("production", "prod")

    # ---------------- web server ----------------
    HOST = os.getenv("FLASK_HOST", "0.0.0.0").strip() or "0.0.0.0"
    PORT = env_int("FLASK_PORT", 5000)
    DEBUG = env_bool("FLASK_DEBUG", False) and not IS_PRODUCTION

    TEMPLATES_AUTO_RELOAD = env_bool("TEMPLATES_AUTO_RELOAD", True)

    # ---------------- session signing key ----------------
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "").strip()
    ALLOW_INSECURE_DEV_SECRET = env_bool("ALLOW_INSECURE_DEV_SECRET", False)

    if not SECRET_KEY or looks_weak_secret(SECRET_KEY):
        if IS_PRODUCTION or not ALLOW_INSECURE_DEV_SECRET:
            raise RuntimeError(_BOOT_ERROR)
        SECRET_KEY = secrets.token_hex(32)

    # ---------------- session / cookies ----------------
    SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "sms_session")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax").strip() or "Lax"
    SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", IS_PRODUCTION)
    SESSION_COOKIE_PATH = "/"
    SESSION_REFRESH_EACH_REQUEST = False

    SESSION_LIFETIME_MINUTES = env_int("SESSION_LIFETIME_MINUTES", 60)
    SESSION_IDLE_TIMEOUT_MINUTES = env_int("SESSION_IDLE_TIMEOUT_MINUTES", 30)
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=SESSION_LIFETIME_MINUTES)
    SESSION_IDLE_TIMEOUT = timedelta(minutes=SESSION_IDLE_TIMEOUT_MINUTES)

    MAX_CONTENT_LENGTH = env_int("MAX_CONTENT_LENGTH_BYTES", 1024 * 1024)

    # ---------------- host header allowlist ----------------
    _default_hosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0"]

    # Auto-detected LAN IPs
    _default_hosts.extend(_local_ipv4_addresses())

    # Extra known hosts (manual overrides + cloud platforms)
    _default_hosts.extend([
        "192.168.137.1",
        "10.0.15.204",
        ".onrender.com",
        ".vercel.app",
        ".neon.tech",
    ])

    # If bound to a specific IP, include it too
    if HOST not in ("0.0.0.0", "::", ""):
        _default_hosts.append(HOST)

    # Merge with ALLOWED_HOSTS from .env
    _env_hosts = _csv_env("ALLOWED_HOSTS", ())

    _allow_all = "*" in _env_hosts or "*" in _default_hosts

    if _allow_all:
        TRUSTED_HOSTS = None
    else:
        combined = set(_default_hosts) | set(_env_hosts)
        TRUSTED_HOSTS = sorted(
            {_normalize_host_entry(host) for host in combined} - {""}
        )

    # ---------------- rate limiting ----------------
    LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "10 per 5 minutes").strip()
    REGISTER_RATE_LIMIT = os.getenv("REGISTER_RATE_LIMIT", "5 per hour").strip()
    GLOBAL_RATE_LIMIT = os.getenv("GLOBAL_RATE_LIMIT", "600 per minute").strip()
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://").strip()
    RATELIMIT_HEADERS_ENABLED = True
    RATE_LIMIT_ENABLED = env_bool("RATE_LIMIT_ENABLED", True)

    # ---------------- account / login policy ----------------
    MAX_FAILED_LOGINS = env_int("MAX_FAILED_LOGINS", 5)
    ACCOUNT_LOCK_MINUTES = env_int("ACCOUNT_LOCK_MINUTES", 15)

    ALLOW_ADMIN_SELF_REGISTRATION = env_bool("ALLOW_ADMIN_SELF_REGISTRATION", False)
    ADMIN_BOOTSTRAP_SECRET = os.getenv("ADMIN_BOOTSTRAP_SECRET", "").strip()

    # ---------------- transport ----------------
    TRUST_PROXY_HEADERS = env_bool("TRUST_PROXY_HEADERS", False)
    EXTRA_ALLOWED_ORIGINS = _csv_env("EXTRA_ALLOWED_ORIGINS", ())
    ENFORCE_HTTPS = env_bool("ENFORCE_HTTPS", IS_PRODUCTION)
    HSTS_MAX_AGE = env_int("HSTS_MAX_AGE_SECONDS", 31536000)

    CSP_POLICY = os.getenv(
        "CONTENT_SECURITY_POLICY",
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'none'",
    ).strip()

    # ---------------- PostgreSQL ----------------
    DB_HOST = os.getenv("DATABASE_HOST", "localhost")
    DB_PORT = env_int("DATABASE_PORT", 5432)
    DB_NAME = os.getenv("DATABASE_NAME", "stock_management")
    DB_USER = os.getenv("DATABASE_USER", "postgres")
    DB_PASSWORD = os.getenv("DATABASE_PASSWORD", "")
    DB_CONNECT_TIMEOUT = env_int("DATABASE_CONNECT_TIMEOUT", 5)
    DB_STATEMENT_TIMEOUT_MS = env_int("DATABASE_STATEMENT_TIMEOUT_MS", 10000)
    DB_SSLMODE = os.getenv("DATABASE_SSLMODE", "prefer").strip() or "prefer"

    @staticmethod
    def get_db_dsn():
        dsn = (
            f"host={Config.DB_HOST} port={Config.DB_PORT} dbname={Config.DB_NAME} "
            f"user={Config.DB_USER} password={Config.DB_PASSWORD} "
            f"sslmode={Config.DB_SSLMODE} "
            f"connect_timeout={Config.DB_CONNECT_TIMEOUT} "
            f"application_name=stock_management"
        )
        if Config.DB_STATEMENT_TIMEOUT_MS > 0:
            dsn += f" options='-c statement_timeout={Config.DB_STATEMENT_TIMEOUT_MS}'"
        return dsn

    # ---------------- startup checks ----------------
    @classmethod
    def startup_warnings(cls):
        warnings = []
        if not cls.SESSION_COOKIE_SECURE and not cls.IS_PRODUCTION:
            warnings.append(
                "SESSION_COOKIE_SECURE is off - fine over plain HTTP on localhost, "
                "set it to True (and ENFORCE_HTTPS=True) before serving real users."
            )
        if cls.HOST in ("0.0.0.0", "::"):
            if cls.TRUSTED_HOSTS:
                warnings.append(
                    f"Binding to {cls.HOST} exposes the app on the network. "
                    f"Allowed Host headers: {', '.join(cls.TRUSTED_HOSTS)}"
                )
            else:
                warnings.append(
                    f"Binding to {cls.HOST} exposes the app on the network and "
                    "Host header validation is disabled (ALLOWED_HOSTS=*), so any "
                    "Host header is accepted."
                )
        if cls.ALLOW_ADMIN_SELF_REGISTRATION and not cls.ADMIN_BOOTSTRAP_SECRET:
            warnings.append(
                "ALLOW_ADMIN_SELF_REGISTRATION is on but ADMIN_BOOTSTRAP_SECRET is empty - "
                "admin self-registration will be refused."
            )
        if cls.ALLOW_INSECURE_DEV_SECRET:
            warnings.append(
                "ALLOW_INSECURE_DEV_SECRET is on - sessions use a random key that "
                "changes on every restart. Never use this outside local development."
            )
        return warnings