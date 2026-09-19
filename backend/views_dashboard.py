"""Dashboard aggregation endpoint."""

from __future__ import annotations

import sqlite3
from datetime import timedelta

from db import iso, rows_dicts, today
from helpers import time_ago
from views_billing import billing_summary

TONE_BY_STATUS = {
    "confirmed": ("amber", "Confirmed"),
    "scheduled": ("slate", "Upcoming"),
    "completed": ("green", "Completed"),
    "cancelled": ("red", "Cancelled"),
    "no_show": ("red", "No Show"),
}

ACTIVITY_META = {
    "treatment": ("activity-green", "check", "Treatment completed"),
    "lab": ("activity-blue", "flask", "Laboratory"),
    "stock": ("activity-amber", "package", "Inventory"),
    "patient": ("activity-teal", "user", "New patient"),
    "appointment": ("activity-blue", "calendar", "Appointment"),
    "payment": ("activity-green", "dollar", "Payment"),
}


def dashboard(conn: sqlite3.Connection) -> dict:
    t = today()
    week_ago = (t - timedelta(days=7)).isoformat()
    prev_start = (t - timedelta(days=14)).isoformat()

    today_appointments = [
        r for r in rows_dicts(conn.execute(
            "SELECT ap.*, p.name AS patient_name FROM appointments ap "
            "JOIN patients p ON p.id = ap.patient_id WHERE ap.date = ?",
            (t.isoformat(),)).fetchall())
    ]
    today_scheduled = sum(1 for a in today_appointments
                          if a["status"] not in ("completed", "cancelled", "no_show"))

    new_week = conn.execute(
        "SELECT COUNT(*) AS c FROM patients WHERE created_at >= ?", (week_ago,)
    ).fetchone()["c"]
    new_prev = conn.execute(
        "SELECT COUNT(*) AS c FROM patients WHERE created_at >= ? AND created_at < ?",
        (prev_start, week_ago)).fetchone()["c"]

    summary = billing_summary(conn)
    current = summary["netRevenue"]
    previous = summary["prevMonthRevenue"]
    pct = round(((current - previous) / previous * 100) if previous else 0, 1)

    active_plans = conn.execute(
        "SELECT COUNT(*) AS c FROM treatment_plans "
        "WHERE status IN ('pending_approval','approved','scheduled','in_progress')"
    ).fetchone()["c"]
    low_stock = conn.execute(
        "SELECT COUNT(*) AS c FROM inventory_items WHERE quantity_on_hand <= minimum_threshold"
    ).fetchone()["c"]
    total_patients = conn.execute("SELECT COUNT(*) AS c FROM patients").fetchone()["c"]

    schedule = []
    for a in sorted(today_appointments,
                    key=lambda x: (x["start_time"], x["patient_name"])):
        tone, label = TONE_BY_STATUS.get(a["status"], ("slate", a["status"]))
        schedule.append({
            "id": a["id"],
            "time": a["start_time"],
            "patient": a["patient_name"],
            "detail": f"{a['title']} • {a['room']}",
            "tone": tone,
            "status": label,
        })

    act_rows = rows_dicts(conn.execute(
        "SELECT * FROM activity_log ORDER BY id DESC LIMIT 8").fetchall())
    activity = []
    for r in act_rows:
        """map activity kind to UI meta"""
        tone, icon, _ = ACTIVITY_META.get(r["kind"], ("activity-slate", "check", "Update"))
        activity.append({
            "kind": r["kind"],
            "tone": tone,
            "icon": icon,
            "text": r["message"],
            "timeAgo": time_ago(r["at"]),
        })

    return {
        "stats": {
            "todayAppointments": len(today_appointments),
            "todayScheduled": today_scheduled,
            "newPatientsWeek": new_week,
            "newPatientsPrevWeek": new_prev,
            "monthlyRevenue": current,
            "prevMonthRevenue": previous,
            "revenuePct": pct,
            "outstanding": summary["outstandingAmount"],
            "activePlans": active_plans,
            "lowStock": low_stock,
            "totalPatients": total_patients,
        },
        "schedule": schedule,
        "activity": activity,
        "revenueTrend": summary["revenueTrend"],
    }