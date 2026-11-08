"""Inspect the user accounts database (data/auth.db)."""
import sqlite3

conn = sqlite3.connect("data/auth.db")
conn.row_factory = sqlite3.Row

rows = conn.execute(
    "SELECT id, username, role, created_at, password FROM users ORDER BY id"
).fetchall()

print(f"Total users: {len(rows)}\n")
for r in rows:
    print(f"  id={r['id']}  username={r['username']!r}  role={r['role']}")
    print(f"      created_at={r['created_at']}")
    print(f"      password_hash={r['password'][:30]}...  (bcrypt, not reversible)")
    print()

conn.close()
