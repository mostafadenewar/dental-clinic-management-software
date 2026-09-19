"""Appointment endpoints: list (by range), create, update, status, delete."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from db import iso, row_dict, today
from helpers import gender_age, patient_summary


def _time_add(start: str, minutes: int) -> str:
    dt = datetime.strptime(start, "%H:%M")
    return (dt + timedelta(minutes=minutes)).strftime("%H:%M")


def _compose(conn: sqlite3.Connection, r: dict) -> dict:
    patient = patient_summary(conn, r["patient_id"])
    provider = conn.execute(
        "SELECT name FROM providers WHERE id = ?", (r["provider_id"],)
    ).fetchone()
    return {
        "id": r["id"],
        "patientId": r["patient_id"],
        "patientName": patient.get("name", ""),
        "patientInitials": patient.get("initials", "?"),
        "patientGenderAge": gender_age(patient.get("gender", ""), r.get("_dob")),
        "providerId": r["provider_id"],
        "providerName": provider["name"] if provider else "",
        "title": r["title"],
        "date": r["date"],
        "startTime": r["start_time"],
        "endTime": r["end_time"],
        "room": r["room"],
        "status": r["status"],
        "notes": r["notes"] or "",
    }


def next_appt_id(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT id FROM appointments").fetchall()
    nums = [int(r["id"].rsplit("-", 1)[1]) for r in rows]
    highest = max(nums) if nums else 0
    return f"APT-{today().year}-{highest + 1:04d}"


def list_appointments(conn: sqlite3.Connection, start=None, end=None) -> list[dict]:
    sql = (
        "SELECT ap.*, p.dob AS _dob FROM appointments ap "
        "JOIN patients p ON p.id = ap.patient_id"
    )
    params = []
    if start and end:
        sql += " WHERE ap.date >= ? AND ap.date <= ?"
        params = [start, end]
    sql += " ORDER BY ap.date, ap.start_time"
    rows = rows_to_dicts(conn, sql, params)
    return [_compose(conn, r) for r in rows]


def rows_to_dicts(conn: sqlite3.Connection, sql: str, params=()):
    return [row_dict(r) for r in conn.execute(sql, params).fetchall()]


def get_appointment(conn: sqlite3.Connection, aid: str) -> dict | None:
    row = conn.execute(
        "SELECT ap.*, p.dob AS _dob FROM appointments ap "
        "JOIN patients p ON p.id = ap.patient_id WHERE ap.id = ?",
        (aid,),
    ).fetchone()
    return _compose(conn, row_dict(row)) if row else None


def create_appointment(conn: sqlite3.Connection, data: dict) -> dict | None:
    start = data.get("startTime")
    end = data.get("endTime")
    dur = data.get("durationMinutes")
    if not end and dur and start:
        end = _time_add(start, int(dur))
    if not data.get("patientId"):
        raise ValueError("patientId is required")
    if not data.get("date") or not start or not end:
        raise ValueError("date, startTime, and endTime are required")
    if to_minutes(end) <= to_minutes(start):
        raise ValueError("endTime must be later than startTime")
    aid = data.get("id") or next_appt_id(conn)
    conn.execute(
        "INSERT OR REPLACE INTO appointments "
        "(id, patient_id, provider_id, title, date, start_time, end_time, "
        "room, status, notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (aid, data.get("patientId"), data.get("providerId"),
         data.get("title", "Consultation"), data.get("date"), start, end,
         data.get("room", ""), data.get("status", "scheduled"), data.get("notes")),
    )
    return get_appointment(conn, aid)


def update_appointment(conn: sqlite3.Connection, aid: str, data: dict) -> dict | None:
    mapping = {
        "patientId": "patient_id",
        "providerId": "provider_id",
        "title": "title",
        "date": "date",
        "startTime": "start_time",
        "endTime": "end_time",
        "room": "room",
        "notes": "notes",
    }
    current = conn.execute("SELECT * FROM appointments WHERE id = ?", (aid,)).fetchone()
    if not current:
        return None
    merged = {key: current[column] for key, column in mapping.items()}
    merged.update({key: value for key, value in data.items() if key in mapping})
    if not merged["patientId"]:
        raise ValueError("patientId is required")
    if not merged["date"] or not merged["startTime"] or not merged["endTime"]:
        raise ValueError("date, startTime, and endTime are required")
    if to_minutes(merged["endTime"]) <= to_minutes(merged["startTime"]):
        raise ValueError("endTime must be later than startTime")
    for key, column in mapping.items():
        if key in data:
            conn.execute(f"UPDATE appointments SET {column} = ? WHERE id = ?", (data[key], aid))
    return get_appointment(conn, aid)


def to_minutes(value: str) -> int:
    parsed = datetime.strptime(value, "%H:%M")
    return parsed.hour * 60 + parsed.minute


def set_appointment_status(conn: sqlite3.Connection, aid: str, status: str) -> dict | None:
    cur = conn.execute("UPDATE appointments SET status = ? WHERE id = ?", (status, aid))
    if cur.rowcount == 0:
        return None
    return get_appointment(conn, aid)


def delete_appointment(conn: sqlite3.Connection, aid: str) -> bool:
    cur = conn.execute("DELETE FROM appointments WHERE id = ?", (aid,))
    return cur.rowcount > 0