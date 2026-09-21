"""Notifications: sync derived alerts and expose list / read endpoints."""

from __future__ import annotations

import sqlite3

from db import iso, now_iso

LIMIT = 60


def _add(conn: sqlite3.Connection, kind: str, ref_id: str, message: str) -> None:
    """Insert a notification unless one with the same (kind, ref_id) exists."""
    conn.execute(
        "INSERT OR IGNORE INTO notifications (kind, message, at, read, ref_id) "
        "VALUES (?,?,?,0,?)",
        (kind, message, now_iso(), ref_id),
    )


def sync_notifications(conn: sqlite3.Connection) -> None:
    """Generate notifications from the live database so the bell is meaningful."""
    today_iso = iso(0)

    upcoming = conn.execute(
        "SELECT COUNT(*) AS c FROM appointments "
        "WHERE date = ? AND status IN ('scheduled', 'confirmed')",
        (today_iso,),
    ).fetchone()["c"]
    if upcoming:
        _add(conn, "appointment", f"appt-today:{today_iso}",
             f"{upcoming} appointment{'s' if upcoming != 1 else ''} scheduled today")

    for r in conn.execute(
        "SELECT name, quantity_on_hand FROM inventory_items "
        "WHERE quantity_on_hand <= minimum_threshold ORDER BY name LIMIT 5"
    ).fetchall():
        _add(conn, "stock", f"stock:{r['name']}",
             f"Low stock: {r['name']} ({r['quantity_on_hand']:.0f} on hand)")

    overdue = conn.execute(
        "SELECT COUNT(*) AS c FROM invoices i WHERE "
        "(SELECT COALESCE(SUM(line.amount), 0) FROM invoice_line_items line "
        " WHERE line.invoice_id = i.id) > "
        "(SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id) "
        "AND i.due_date < ?",
        (today_iso,),
    ).fetchone()["c"]
    if overdue:
        _add(conn, "billing", f"overdue:{today_iso}",
             f"{overdue} invoice{'s' if overdue != 1 else ''} overdue")

    week_ago = iso(-7)
    new_patients = conn.execute(
        "SELECT COUNT(*) AS c FROM patients WHERE created_at >= ?", (week_ago,)
    ).fetchone()["c"]
    if new_patients:
        _add(conn, "patient", f"new-patients:{today_iso}",
             f"{new_patients} new patient{'s' if new_patients != 1 else ''} registered this week")


def list_notifications(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT id, kind, message, at, read FROM notifications "
        "ORDER BY id DESC LIMIT ?",
        (LIMIT,),
    ).fetchall()
    return [
        {"id": r["id"], "kind": r["kind"], "message": r["message"],
         "at": r["at"], "read": bool(r["read"])}
        for r in rows
    ]


def unread_count(conn: sqlite3.Connection) -> int:
    return conn.execute(
        "SELECT COUNT(*) AS c FROM notifications WHERE read = 0"
    ).fetchone()["c"]


def mark_read(conn: sqlite3.Connection, notification_id) -> bool:
    cur = conn.execute(
        "UPDATE notifications SET read = 1 WHERE id = ? AND read = 0",
        (notification_id,),
    )
    return cur.rowcount > 0


def mark_all_read(conn: sqlite3.Connection) -> int:
    cur = conn.execute("UPDATE notifications SET read = 1 WHERE read = 0")
    return cur.rowcount