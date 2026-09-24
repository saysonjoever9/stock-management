import re


def clean_str(value, max_len=255):
    if value is None:
        return ""
    return str(value).strip()[:max_len]


def is_valid_username(username):
    if not username:
        return False
    return bool(re.match(r"^[A-Za-z0-9_]{3,50}$", username))


def is_valid_email(email):
    if not email:
        return False
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def is_strong_password(password):
    if not password or len(password) < 8:
        return False
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    return has_upper and has_lower and has_digit


def is_valid_sku(sku):
    if not sku:
        return False
    return bool(re.match(r"^[A-Za-z0-9\-_]{1,60}$", sku))


def to_int(value, default=None):
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def to_float(value, default=None):
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default