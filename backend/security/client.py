"""Request metadata helpers shared by audit logging and rate limiting."""

from flask import request

from config import Config


def client_ip():
    """Caller IP, honouring proxy headers only when explicitly trusted.

    X-Forwarded-For is attacker-controlled unless a trusted reverse proxy
    always overwrites it, so it is ignored by default.
    """
    if Config.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("X-Forwarded-For", "")
        first_hop = forwarded.split(",")[0].strip()
        if first_hop:
            return first_hop[:64]
    return (request.remote_addr or "unknown")[:64]


def client_user_agent(max_length=250):
    agent = request.headers.get("User-Agent") or ""
    return agent[:max_length]
