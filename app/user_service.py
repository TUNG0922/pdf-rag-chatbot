"""
User account storage backed by SQLite, with bcrypt password hashing.

Schema (table ``users``):
  id         INTEGER PRIMARY KEY
  username   TEXT UNIQUE NOT NULL
  password   TEXT NOT NULL      -- bcrypt hash
  role       TEXT NOT NULL      -- 'admin' or 'user'
  created_at TEXT NOT NULL
"""

import os
import sqlite3
from datetime import datetime, timezone

import bcrypt

from app import config

VALID_ROLES = {"admin", "user"}


def _connect():
    # Ensure the parent directory exists (e.g. data/).
    db_dir = os.path.dirname(config.AUTH_DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(config.AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create the users table if it does not exist."""
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def get_user_by_username(username: str):
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
    return dict(row) if row else None


def count_users() -> int:
    with _connect() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()
    return int(row["c"])


def create_user(username: str, password: str, role: str = "user"):
    """
    Create a new user. Returns the created user (without password hash).

    Raises:
        ValueError: if the username already exists or role is invalid.
    """
    username = username.strip()

    if not username:
        raise ValueError("Username cannot be empty.")
    if not password:
        raise ValueError("Password cannot be empty.")
    if role not in VALID_ROLES:
        raise ValueError(f"Invalid role. Must be one of {sorted(VALID_ROLES)}.")

    if get_user_by_username(username) is not None:
        raise ValueError("Username already exists.")

    created_at = datetime.now(timezone.utc).isoformat()
    password_hash = hash_password(password)

    with _connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (username, password, role, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (username, password_hash, role, created_at),
        )
        conn.commit()
        user_id = cursor.lastrowid

    return {
        "id": user_id,
        "username": username,
        "role": role,
        "created_at": created_at,
    }


def authenticate(username: str, password: str):
    """Return the user dict if credentials are valid, else None."""
    user = get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user["password"]):
        return None
    return user
