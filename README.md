# Stock Management System

Secure, production-ready stock/inventory management system.

- **Backend:** Python 3.10+ / Flask / psycopg3
- **Database:** PostgreSQL 13+
- **Frontend:** HTML5, CSS3, vanilla JavaScript
- **Auth:** Session-based (HttpOnly cookies), Argon2id password hashing

---

## 1. Prerequisites

- Python **3.10+**
- PostgreSQL **13+**
- `pip` and `venv`

---

## 2. PostgreSQL Setup

Create the database and load the schema.

```bash
# as the postgres superuser
psql -U postgres -c "CREATE DATABASE stock_management;"
psql -U postgres -d stock_management -f database/schema.sql
```

Or, if you want the schema file to create the DB itself, edit the top of
`database/schema.sql` (uncomment the `CREATE DATABASE` lines) and run:

```bash
psql -U postgres -f database/schema.sql
```

---

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
FLASK_SECRET_KEY=<long random string>
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=stock_management
DATABASE_USER=postgres
DATABASE_PASSWORD=c#Tools10
```

⚠️ **Never commit `.env` to version control.**

---

## 4. Install Dependencies

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## 5. Run the Application

Always run the server with the project virtualenv — a system Python usually lacks
`waitress`, so the app falls back to the single-process Flask dev server and prints a
warning banner.

```powershell
# Windows (venv created as "venv", run from the project root)
venv\Scripts\python.exe backend\run.py

# or activate the venv first, then
python backend\run.py
```

```bash
# macOS / Linux
venv/bin/python backend/run.py
```

The app is served at **http://127.0.0.1:5000** (and on your LAN IP, e.g.
**http://192.168.x.x:5000** — the startup banner prints the exact URLs).

On start it prints the effective host policy:

```
[INFO] Host header allowlist: 127.0.0.1, localhost, ...
```
or
```
[INFO] Host header validation disabled (ALLOWED_HOSTS=*)
```

- The Flask app serves the frontend from `frontend/`.
- Login page is at `/` (index.html).
- After login, you are redirected to `/dashboard.html`.

⚠️ Stop the previous server (Ctrl+C) before starting a new one. Windows lets
several processes bind port 5000 at once, and requests then go to the *first*
process — which is how you end up still seeing an old error after fixing the code.

---

## 6. First Login

Default admin credentials (from `database/schema.sql`):

```
username: admin
password: Admin@123
```

**Change this password immediately** via *Users → Reset PW*.

---

## 7. Production Deployment

1. Set `FLASK_ENV=production` and `SESSION_COOKIE_SECURE=True` in `.env`.
2. Use a long random `FLASK_SECRET_KEY` (e.g. `openssl rand -hex 32`).
3. Run behind a reverse proxy (nginx/Caddy) and terminate TLS there.
4. Do **not** enable `debug=True` in production.
5. Use `gunicorn`:

```bash
pip install gunicorn
gunicorn -w 4 -b 127.0.0.1:5000 backend.app:app
```

6. Example nginx location:

```nginx
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 8. Security Notes

- Passwords hashed with **Argon2id**.
- All DB queries are **parameterized** (psycopg3).
- Session cookies are **HttpOnly**, **SameSite=Lax**, `Secure` in production.
- CSRF-lite: all mutating requests require `X-Requested-With: XMLHttpRequest`.
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) applied on every response.
- Login rate limiting via lockout after 5 failed attempts (15-minute lock).
- Audit logs recorded for all sensitive actions.
- Error responses never leak stack traces or SQL details.
- DB credentials are only ever loaded from `.env` by the backend.

---

## 9. Project Layout

```
stock-management-system/
├── backend/
│   ├── app.py
│   ├── config.py
│   ├── requirements.txt
│   ├── routes/         # auth, users, products, categories, suppliers, inventory, reports
│   ├── services/       # db, audit
│   ├── middleware/     # auth
│   └── utils/          # validators
├── database/
│   └── schema.sql
├── frontend/
│   ├── *.html
│   ├── css/
│   └── js/
├── .env.example
├── .gitignore
├── README.md
└── requirements.txt
```

---

## 10. API Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | login |
| POST | `/api/auth/logout` | logout |
| GET  | `/api/auth/me` | current user |
| GET/POST/PUT/DELETE | `/api/users/...` | admin only |
| GET/POST/PUT/DELETE | `/api/products/...` | writes: admin only |
| GET/POST/PUT/DELETE | `/api/categories/...` | writes: admin only |
| GET/POST/PUT/DELETE | `/api/suppliers/...` | writes: admin only |
| POST | `/api/inventory/stock-in` | any authenticated user |
| POST | `/api/inventory/stock-out` | any authenticated user |
| POST | `/api/inventory/adjustment` | admin only |
| GET  | `/api/inventory/transactions` | history |
| GET  | `/api/reports/dashboard` | dashboard stats |
| GET  | `/api/reports/inventory` | inventory report |
| GET  | `/api/reports/low-stock` | low stock |
| GET  | `/api/reports/out-of-stock` | out of stock |
| GET  | `/api/reports/transactions` | transaction report |
| GET  | `/api/reports/audit-logs` | admin only |

---

## 11. Troubleshooting

- **`Host '127.0.0.1:5000' is not trusted.`** — Flask 3.1 / Werkzeug 3.1 validate the `Host`
  header against `TRUSTED_HOSTS`. Set `ALLOWED_HOSTS=*` in `.env` to accept any host
  (dev / LAN), or list the exact hosts you use, e.g.
  `ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.50`. The literal `*` must never be put
  inside a list — it is not a wildcard for Werkzeug and would reject every request.
  Check the current policy at any time with `python backend/check_hosts.py`.
- **`[ERROR] Port 5000 is already in use - another server is running.`** — a previous instance is
  still listening. Windows lets several processes bind the same port, but requests keep
  going to the *first* one, so the new code appears to have no effect. Kill it with
  `netstat -ano | findstr :5000` (last column = PID) then `Stop-Process -Id <PID> -Force`,
  or start this instance on `FLASK_PORT=5001`.
- **`psycopg.OperationalError`** — verify PostgreSQL is running and `.env` credentials are correct.
- **Login loop** — clear cookies; ensure `FLASK_SECRET_KEY` is set.
- **CSP blocking assets** — everything must be served from the same origin.