"""Patient endpoints: list, get, create, update, delete."""

from __future__ import annotations

import sqlite3
from datetime import date, timedelta

from db import iso, row_dict, rows_dicts, today
from helpers import age_from_dob, initials, invoice_totals, patient_outstanding


def _clinical_status(active_plan, outstanding, overdue, last_visit, active):
    if active and active == "inactive":
        return "INACTIVE"
    if active_plan:
        return "IN TREATMENT"
    if outstanding > 0 or overdue:
        return "FOLLOW-UP"
    if last_visit:
        days = (today() - date.fromisoformat(last_visit)).days
        if days <= 90:
            return "HEALTHY"
        return "FOLLOW-UP"
    return "INACTIVE"


def _compose(conn: sqlite3.Connection, p: dict) -> dict:
    pid = p["id"]
    active_plan = conn.execute(
        "SELECT 1 FROM treatment_plans WHERE patient_id = ? "
        "AND status IN ('pending_approval','approved','scheduled','in_progress') LIMIT 1",
        (pid,),
    ).fetchone()
    last = conn.execute(
        "SELECT ap.date, pr.name AS provider_name FROM appointments ap "
        "JOIN providers pr ON pr.id = ap.provider_id "
        "WHERE ap.patient_id = ? AND ap.status IN ('completed','confirmed') "
        "ORDER BY ap.date DESC LIMIT 1",
        (pid,),
    ).fetchone()
    last_visit = last["date"] if last else None
    doctor = last["provider_name"] if last else ""
    outstanding, overdue = patient_outstanding(conn, pid)
    g = p.get
    return {
        "id": pid,
        "name": g("name", ""),
        "initials": initials(g("name", "")),
        "age": age_from_dob(g("dob")) or 0,
        "gender": g("gender") or "Other",
        "phone": g("phone") or "",
        "email": g("email") or "",
        "dob": g("dob"),
        "address": g("address") or "",
        "insuranceId": g("insurance_id") or "",
        "insuranceProvider": g("insurance_provider") or "",
        "status": g("status", "active"),
        "clinicalStatus": _clinical_status(bool(active_plan), outstanding, overdue, last_visit, g("status", "active")),
        "lastVisit": last_visit,
        "doctorName": doctor,
        "outstanding": outstanding,
        "overdue": overdue,
        "createdAt": g("created_at"),
        "notes": g("notes") or "",
    }


def next_patient_id(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT id FROM patients").fetchall()
    nums = [int(r["id"].split("-")[2]) for r in rows if r["id"].count("-") == 2]
    highest = max(nums) if nums else 0
    return f"PT-{today().year}-{highest + 1:04d}"


def list_patients(conn: sqlite3.Connection) -> list[dict]:
    base = (
        "SELECT p.*, i.provider AS insurance_provider FROM patients p "
        "LEFT JOIN insurance i ON i.id = p.insurance_id"
    )
    rows = rows_dicts(conn.execute(base + " ORDER BY p.name").fetchall())
    return [_compose(conn, r) for r in rows]


def get_patient(conn: sqlite3.Connection, pid: str) -> dict | None:
    row = conn.execute(
        "SELECT p.*, i.provider AS insurance_provider FROM patients p "
        "LEFT JOIN insurance i ON i.id = p.insurance_id WHERE p.id = ?",
        (pid,),
    ).fetchone()
    if row is None:
        return None
    return _compose(conn, row_dict(row))


def create_patient(conn: sqlite3.Connection, data: dict) -> dict | None:
    pid = data.get("id") or next_patient_id(conn)
    conn.execute(
        "INSERT OR REPLACE INTO patients "
        "(id, name, dob, gender, phone, email, address, insurance_id, "
        "status, created_at, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (pid, data.get("name"), data.get("dob"), data.get("gender"),
         data.get("phone"), data.get("email"), data.get("address"),
         data.get("insuranceId") or data.get("insurance_id"),
         data.get("status", "active"), data.get("createdAt") or iso(0),
         data.get("notes")),
    )
    return get_patient(conn, pid)


def update_patient(conn: sqlite3.Connection, pid: str, data: dict) -> dict | None:
    fields = ["name", "dob", "gender", "phone", "email", "address",
              "insurance_id", "status", "notes"]
    for key in fields:
        if key in data:
            conn.execute(f"UPDATE patients SET {key} = ? WHERE id = ?", (data[key], pid))
    if "insuranceId" in data:
        conn.execute("UPDATE patients SET insurance_id = ? WHERE id = ?",
                     (data["insuranceId"], pid))
    return get_patient(conn, pid)


def delete_patient(conn: sqlite3.Connection, pid: str) -> bool:
    cur = conn.execute("DELETE FROM patients WHERE id = ?", (pid,))
    return cur.rowcount > 0


def patient_history(conn: sqlite3.Connection, pid: str) -> dict:
    """Visits (appointments) and bills (invoices) for a patient."""
    appointments = rows_dicts(conn.execute(
        "SELECT ap.id, ap.date, ap.start_time, ap.end_time, ap.title, ap.room, "
        "ap.status, ap.notes, pr.name AS provider FROM appointments ap "
        "LEFT JOIN providers pr ON pr.id = ap.provider_id "
        "WHERE ap.patient_id = ? ORDER BY ap.date DESC, ap.start_time DESC",
        (pid,),
    ).fetchall())

    invoices = []
    for r in conn.execute(
        "SELECT * FROM invoices WHERE patient_id = ? ORDER BY created_date DESC", (pid,)
    ).fetchall():
        inv = row_dict(r)
        total = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS t FROM invoice_line_items WHERE invoice_id = ?",
            (inv["id"],),
        ).fetchone()["t"]
        items = rows_dicts(conn.execute(
            "SELECT description, code, quantity, unit_price, amount "
            "FROM invoice_line_items WHERE invoice_id = ? ORDER BY id", (inv["id"],),
        ).fetchall())
        invoices.append({
            "id": inv["id"],
            "number": inv["number"],
            "createdDate": inv["created_date"],
            "dueDate": inv["due_date"],
            "notes": inv["notes"],
            "items": items,
            "totals": invoice_totals(conn, inv["id"]),
            "lineTotal": total,
        })

    return {"appointments": appointments, "invoices": invoices}