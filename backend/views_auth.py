"""Authentication endpoints: login, logout, profile, password.

Simple token sessions stored in SQLite. Passwords are salted PBKDF2-SHA256
hashes (stdlib only).
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from datetime import timedelta

from db import now_iso, today

SESSION_DAYS = 30
PBKDF2_ITERATIONS = 120_000


def _parse_hash(stored: str) -> tuple[str, str] | None:
    if not stored or "$" not in stored:
        return None
    salt, digest = stored.split("$", 1)
    return salt, digest


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    ).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    parsed = _parse_hash(stored)
    if parsed is None:
        return False
    salt, digest = parsed
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    ).hex()
    return hmac.compare_digest(candidate, digest)


def to_user(r) -> dict:
    return {
        "id": r["id"],
        "username": r["username"],
        "name": r["name"],
        "role": r["role"],
        "active": bool(r["active"]),
        "email": r["email"] or "",
        "phone": r["phone"] or "",
        "title": r["title"] or "",
    }


def login(conn: sqlite3.Connection, data: dict) -> dict:
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        raise ValueError("username and password are required")
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        raise ValueError("Invalid username or password")
    if not row["active"]:
        raise ValueError("This account has been disabled")
    token = secrets.token_hex(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)",
        (token, row["id"], now_iso(), (today() + timedelta(days=SESSION_DAYS)).isoformat()),
    )
    return {"token": token, "user": to_user(row)}


def logout(conn: sqlite3.Connection, token: str) -> None:
    if token:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _fetch_user(conn: sqlite3.Connection, user_id: str):
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def authenticate(conn: sqlite3.Connection, token: str) -> dict | None:
    if not token:
        return None
    row = conn.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token = ? AND s.expires_at >= ? AND u.active = 1",
        (token, today().isoformat()),
    ).fetchone()
    return to_user(row) if row else None


def get_profile(conn: sqlite3.Connection, user_id: str) -> dict | None:
    row = _fetch_user(conn, user_id)
    return to_user(row) if row else None


def update_profile(conn: sqlite3.Connection, user_id: str, data: dict) -> dict | None:
    row = _fetch_user(conn, user_id)
    if row is None:
        return None
    fields = {
        "name": ("name", "Username is required"),
        "email": ("email", None),
        "phone": ("phone", None),
        "title": ("title", None),
    }
    for key, (column, required_msg) in fields.items():
        if key not in data:
            continue
        value = str(data[key]).strip()
        if required_msg and not value:
            raise ValueError(required_msg)
        conn.execute(f"UPDATE users SET {column} = ? WHERE id = ?", (value, user_id))
    return get_profile(conn, user_id)


def change_password(
    conn: sqlite3.Connection, user_id: str, data: dict
) -> None:
    current = data.get("currentPassword") or ""
    new_password = data.get("newPassword") or ""
    confirm = data.get("confirmPassword")
    if not current:
        raise ValueError("Current password is required")
    if len(new_password) < 6:
        raise ValueError("New password must be at least 6 characters")
    if confirm is not None and new_password != confirm:
        raise ValueError("New passwords do not match")
    row = _fetch_user(conn, user_id)
    if row is None:
        raise ValueError("User not found")
    if not verify_password(current, row["password_hash"]):
        raise ValueError("Current password is incorrect")
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (hash_password(new_password), user_id),
    )