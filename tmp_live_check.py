"""Live end-to-end check: restart-independent proof that the running server
serves the FIXED analytics layout (safe to delete)."""
import os
import sys
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, r"c:\stock_management_system\backend")
os.chdir(r"c:\stock_management_system\backend")

from run import create_app  # noqa: E402

app = create_app()
print("[0] debug:", app.debug,
      "| TEMPLATES_AUTO_RELOAD:", app.config["TEMPLATES_AUTO_RELOAD"],
      "| jinja auto_reload:", app.jinja_env.auto_reload)

serializer = app.session_interface.get_signing_serializer(app)
cookie = serializer.dumps({
    "user_id": 1,
    "role": "admin",
    "username": "layout-verify",
    "last_seen": datetime.now(timezone.utc).isoformat(),
})
cookie_name = app.config["SESSION_COOKIE_NAME"]

req = urllib.request.Request("http://127.0.0.1:5000/analytics")
req.add_header("Cookie", f"{cookie_name}={cookie}")
with urllib.request.urlopen(req, timeout=20) as resp:
    body = resp.read().decode("utf-8", "replace")
    print("[1] live GET /analytics ->", resp.status, "| bytes:", len(body))
    print("[2] final URL:", resp.geturl())
    print("[3] Cache-Control:", resp.headers.get("Cache-Control"))

print("[4] is the analytics page      :", 'id="summary-grid"' in body)
print("[5] has 3-col KPI grid         :", "repeat(3, minmax(0, 1fr))" in body)
print("[6] has 2-col analytics grid   :", "repeat(2, minmax(0, 1fr))" in body)
print("[7] old 4-col rule still there :", "repeat(auto-fit, minmax(280px, 1fr))" in body)
print("[8] has low-stock tile grid    :", "repeat(auto-fill, minmax(280px, 1fr))" in body)
print("[9] has canvas guard           :" , ".chart-wrap canvas" in body)

req2 = urllib.request.Request("http://127.0.0.1:5000/css/dashboard.css")
with urllib.request.urlopen(req2, timeout=20) as resp2:
    css = resp2.read().decode("utf-8", "replace")
print("[10] dashboard.css served      :", resp2.status, "| 260px KPI grid:", "minmax(260px, 1fr)" in css)
