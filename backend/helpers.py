"""Shared serialization helpers for the DCMS API."""

from __future__ import annotations

import sqlite3
from datetime import date, datetime, timedelta

from db import today


def initials(name: str) -> str:
    # Derive a 1-2 character uppercase initials from a patient's name.
    parts = [p for p in name.split() if p]
    return "".join(p[0].upper() for p in parts[:2]) or "?"


def age_from_dob(dob: str | None) -> int | None:
    # Compute age in whole years from an ISO date string (or None).
    if not dob:
        return None
    try:
        born = date.fromisoformat(dob)
        t = today()
        return t.year - born.year - ((t.month, t.day) < (born.month, born.day))
    except (ValueError, TypeError):
        return None


def gender_age(gender: str, dob: str | None) -> str:
    # Format a gender/age label, omitting age when it cannot be computed.
    a = age_from_dob(dob)
    return f"{gender}, {a}" if a is not None else gender


def patient_summary(conn: sqlite3.Connection, patient_id: str) -> dict:
    # Build a serializable summary dict for a patient (empty if not found).
    row = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    if row is None:
        return {}
    return {
        "id": row["id"],
        "name": row["name"],
        "initials": initials(row["name"]),
        "age": age_from_dob(row["dob"]) or 0,
        "gender": row["gender"] or "Other",
        "phone": row["phone"] or "",
        "dob": row["dob"],
    }


def time_ago(at: str) -> str:
    # Render a human-readable relative-time string for an ISO timestamp.
    if not at:
        return ""
    try:
        dt = datetime.fromisoformat(at)
    except (ValueError, TypeError):
        return ""
    delta = datetime.now() - dt
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    days = hours // 24
    return f"{days} day{'s' if days > 1 else ''} ago"


def invoice_totals(conn: sqlite3.Connection, invoice_id: str) -> dict:
    # Aggregate line items, payments, and status for a single invoice.
    total = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) AS t FROM invoice_line_items WHERE invoice_id = ?",
        (invoice_id,),
    ).fetchone()["t"]
    paid = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) AS t FROM payments WHERE invoice_id = ?",
        (invoice_id,),
    ).fetchone()["t"]
    balance = max(0.0, round(total - paid, 2))
    due = conn.execute(
        "SELECT due_date FROM invoices WHERE id = ?", (invoice_id,)
    ).fetchone()["due_date"]
    status = compute_status(total, paid, balance, due)
    return {"total": total, "paid": paid, "balance": balance, "status": status}


def compute_status(total: float, paid: float, balance: float, due_date: str) -> str:
    # Classify an invoice as paid, overdue, unpaid, or partial.
    today_iso = today().isoformat()
    if balance <= 0.001:
        return "paid"
    if due_date < today_iso:
        return "overdue"
    if paid <= 0.001:
        return "unpaid"
    return "partial"


def patient_outstanding(conn: sqlite3.Connection, patient_id: str) -> tuple[float, bool]:
    # Sum outstanding balances across a patient's invoices and flag any overdue.
    rows = conn.execute(
        "SELECT id FROM invoices WHERE patient_id = ?", (patient_id,)
    ).fetchall()
    total_out = 0.0
    overdue = False
    for r in rows:
        t = invoice_totals(conn, r["id"])
        total_out += t["balance"]
        if t["status"] == "overdue":
            overdue = True
    return round(total_out, 2), overdue