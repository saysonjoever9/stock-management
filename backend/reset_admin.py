"""Reset the admin slot - removes any existing admin user."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.db import execute, fetch_all

print("Deleting any existing admin users...")
execute("""
    DELETE FROM users
    WHERE id IN (
        SELECT u.id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'admin'
    )
""")
print("Done.")

print("\nRemaining users:")
rows = fetch_all("""
    SELECT u.id, u.username, r.name AS role
    FROM users u
    JOIN roles r ON r.id = u.role_id
""")
if not rows:
    print("  (none)")
else:
    for row in rows:
        print(f"  id={row['id']}  username={row['username']}  role={row['role']}")
