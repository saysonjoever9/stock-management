"""Diagnose the Host header policy of this app.

Run from the project root:

    python backend/check_hosts.py

Prints the effective ``TRUSTED_HOSTS`` value (Flask 3.1 / Werkzeug 3.1 validate
the ``Host`` header against it) and asks the app itself which Host headers are
accepted. Handy when you run into:

    {"success": false, "message": "Host '127.0.0.1:5000' is not trusted."}

See README (Troubleshooting) for the fix: set ``ALLOWED_HOSTS=*`` in ``.env``
to accept any Host header (dev / LAN), or list the exact hosts you use.

No database connection is made - only the login page is requested.
"""

from config import Config, _local_ipv4_addresses
from run import create_app


def _probe_hosts():
    """Host headers worth testing: loopback plus this machine's LAN IPs."""
    hosts = ["127.0.0.1:5000", "localhost:5000", "[::1]:5000"]
    hosts.extend(f"{ip}:5000" for ip in _local_ipv4_addresses()[:3])
    return hosts


def main():
    app = create_app()
    trusted = app.config.get("TRUSTED_HOSTS")

    print("flask config TRUSTED_HOSTS:", repr(trusted))
    if trusted is None:
        print("Host header validation  : DISABLED (ALLOWED_HOSTS=*)")
        print("                          every Host header is accepted")
    elif trusted:
        print("Host header validation  : ENABLED")
        print("Allowed Host headers    :", ", ".join(trusted))
    else:
        print("Host header validation  : ENABLED but the allowlist is empty!")
        print("                          every request will be rejected")

    print()
    print("GET / results:")
    client = app.test_client()
    for host in _probe_hosts():
        response = client.get("/", headers={"Host": host})
        print(f"  {host:<22} -> HTTP {response.status_code}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
