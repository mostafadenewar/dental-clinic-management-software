"""Treatment plan endpoints with nested phases, procedures, and care tasks."""

from __future__ import annotations

import sqlite3

from db import iso, rows_dicts, today
from helpers import patient_summary

DEFAULT_TASKS = ["Present estimate", "Confirm appointment", "Collect consent"]


def _teeth(raw) -> list[int]:
    from db import parse_teeth
    return parse_teeth(raw) if isinstance(raw, str) else (raw or [])


def _procedure(r: dict) -> dict:
    return {
        "id": r["id"],
        "planId": r["plan_id"],
        "phaseId": r["phase_id"],
        "procedureName": r["procedure_name"],
        "code": r["code"],
        "category": r["category"],
        "toothSelection": {"numbering": "universal", "teeth": _teeth(r["teeth"])},
        "providerId": r["provider_id"],
        "status": r["status"],
        "plannedDate": r["planned_date"],
        "scheduledDate": r["scheduled_date"],
        "completedDate": r["completed_date"],
        "fee": r["fee"],
        "insuranceEstimate": r["insurance_estimate"],
        "patientResponsibility": r["patient_responsibility"],
        "notes": r["notes"] or "",
    }


def _phase(conn, pid: str, plan_id: str) -> dict:
    return {
        "id": pid,
        "planId": plan_id,
        "name": "Plan",
        "order": 1,
        "description": "",
        "procedures": [],
    }


def _compose_plan(conn: sqlite3.Connection, r: dict) -> dict:
    plan_id = r["id"]
    phases = []
    for ph in rows_dicts(conn.execute(
        "SELECT * FROM plan_phases WHERE plan_id = ? ORDER BY ordr", (plan_id,)
    ).fetchall()):
        procs = [_procedure(p) for p in rows_dicts(conn.execute(
            "SELECT * FROM plan_procedures WHERE plan_id = ? AND phase_id = ? "
            "ORDER BY id", (plan_id, ph["id"])
        ).fetchall())]
        phases.append({
            "id": ph["id"],
            "planId": plan_id,
            "name": ph["name"],
            "order": ph["ordr"],
            "description": ph["description"],
            "procedures": procs,
        })
    if not phases:
        phases = [_phase(conn, f"PH-{plan_id}-1", plan_id)]
    tasks = [{"id": t["id"], "label": t["label"], "done": bool(t["done"])}
             for t in rows_dicts(conn.execute(
                 "SELECT * FROM care_tasks WHERE plan_id = ?", (plan_id,)
             ).fetchall())]
    if not tasks:
        tasks = [{"id": f"t{i + 1}", "label": lbl, "done": False}
                 for i, lbl in enumerate(DEFAULT_TASKS)]
    return {
        "id": plan_id,
        "title": r["title"],
        "description": r["description"],
        "status": r["status"],
        "patient": patient_summary(conn, r["patient_id"]),
        "doctorId": r["doctor_id"],
        "coordinatorId": r["coordinator_id"],
        "insuranceId": r["insurance_id"],
        "createdAt": r["created_at"],
        "updatedAt": r["updated_at"],
        "phases": phases,
        "careTasks": tasks,
    }


def next_plan_id(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT id FROM treatment_plans").fetchall()
    nums = [int(r["id"].split("-")[1]) for r in rows]
    return f"PLAN-{max(nums) + 1 if nums else 1000}"


def list_plans(conn: sqlite3.Connection, status=None, search=None) -> list[dict]:
    sql = "SELECT * FROM treatment_plans"
    conds, params = [], []
    if status and status != "all":
        conds.append("status = ?")
        params.append(status)
    if search:
        conds.append("(title LIKE ? OR description LIKE ? OR patient_id IN "
                     "(SELECT id FROM patients WHERE name LIKE ?))")
        like = f"%{search}%"
        params += [like, like, like]
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY updated_at DESC"
    return [_compose_plan(conn, r) for r in rows_dicts(conn.execute(sql, params).fetchall())]


def get_plan(conn: sqlite3.Connection, plan_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM treatment_plans WHERE id = ?", (plan_id,)).fetchone()
    if row is None:
        return None
    return _compose_plan(conn, dict(row)) if row else None


def create_plan(conn: sqlite3.Connection, data: dict) -> dict | None:
    plan_id = data.get("id") or next_plan_id(conn)
    now = iso(0)
    conn.execute(
        "INSERT OR REPLACE INTO treatment_plans "
        "(id, title, description, status, patient_id, doctor_id, "
        "coordinator_id, insurance_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (plan_id, data.get("title") or "New Treatment Plan",
         data.get("description") or "", data.get("status", "draft"),
         data.get("patientId"), data.get("doctorId"), data.get("coordinatorId"),
         data.get("insuranceId"), data.get("createdAt") or now, now),
    )
    ph = "PH-" + plan_id + "-1"
    conn.execute("INSERT OR IGNORE INTO plan_phases VALUES (?,?,?,?,?)",
                 (ph, plan_id, "Phase 1", 1, ""))
    for i, lbl in enumerate(DEFAULT_TASKS):
        conn.execute("INSERT OR IGNORE INTO care_tasks VALUES (?,?,?,0)",
                     (f"{plan_id}-{i + 1}", plan_id, lbl))
    return get_plan(conn, plan_id)


def update_plan(conn: sqlite3.Connection, plan_id: str, data: dict) -> dict | None:
    for key, col in [("title", "title"), ("description", "description"),
                     ("status", "status"), ("doctorId", "doctor_id"),
                     ("coordinatorId", "coordinator_id"), ("insuranceId", "insurance_id")]:
        if key in data:
            conn.execute(f"UPDATE treatment_plans SET {col} = ? WHERE id = ?",
                         (data[key], plan_id))
    conn.execute("UPDATE treatment_plans SET updated_at = ? WHERE id = ?",
                 (iso(0), plan_id))
    return get_plan(conn, plan_id)


def _next_proc_num(conn: sqlite3.Connection, plan_id: str) -> int:
    rows = conn.execute(
        "SELECT id FROM plan_procedures WHERE plan_id = ?", (plan_id,)
    ).fetchall()
    nums = [int(r["id"].rsplit("-", 1)[1]) for r in rows]
    return (max(nums) if nums else 0) + 1


def create_procedure(conn: sqlite3.Connection, plan_id: str, data: dict) -> dict | None:
    from db import json_text
    phase = data.get("phaseId")
    if not phase:
        p = conn.execute("SELECT id FROM plan_phases WHERE plan_id = ? LIMIT 1",
                         (plan_id,)).fetchone()
        phase = p["id"] if p else "PH-" + plan_id + "-1"
    proc_id = data.get("id") or f"{plan_id}-{_next_proc_num(conn, plan_id)}"
    fee = float(data.get("fee", 0) or 0)
    ins = float(data.get("insuranceEstimate", 0) or 0)
    conn.execute(
        "INSERT OR IGNORE INTO plan_procedures "
        "(id, plan_id, phase_id, procedure_name, code, category, teeth, "
        "provider_id, status, planned_date, scheduled_date, completed_date, "
        "fee, insurance_estimate, patient_responsibility, notes) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (proc_id, plan_id, phase, data.get("procedureName"),
         data.get("code"), data.get("category"),
         json_text(data.get("teeth") or []), data.get("providerId", "DOC-01"),
         data.get("status", "planned"), data.get("plannedDate"),
         data.get("scheduledDate"), data.get("completedDate"),
         fee, ins, max(0.0, fee - ins), data.get("notes") or ""),
    )
    conn.execute("UPDATE treatment_plans SET updated_at = ? WHERE id = ?", (iso(0), plan_id))
    return get_plan(conn, plan_id)


def update_procedure(conn: sqlite3.Connection, proc_id: str, data: dict) -> dict | None:
    for key, col in [("procedureName", "procedure_name"), ("code", "code"),
                     ("category", "category"), ("providerId", "provider_id"),
                     ("status", "status"), ("plannedDate", "planned_date"),
                     ("scheduledDate", "scheduled_date"),
                     ("completedDate", "completed_date"),
                     ("fee", "fee"), ("insuranceEstimate", "insurance_estimate"),
                     ("notes", "notes")]:
        if key in data:
            conn.execute(f"UPDATE plan_procedures SET {col} = ? WHERE id = ?",
                         (data[key], proc_id))
    if "teeth" in data:
        from db import json_text
        conn.execute("UPDATE plan_procedures SET teeth = ? WHERE id = ?",
                     (json_text(data["teeth"] or []), proc_id))
    if "fee" in data or "insuranceEstimate" in data:
        row = conn.execute("SELECT fee, insurance_estimate FROM plan_procedures WHERE id = ?",
                           (proc_id,)).fetchone()
        resp = max(0.0, float(row["fee"]) - float(row["insurance_estimate"]))
        conn.execute("UPDATE plan_procedures SET patient_responsibility = ? WHERE id = ?",
                     (resp, proc_id))
    row = conn.execute("SELECT plan_id FROM plan_procedures WHERE id = ?", (proc_id,)).fetchone()
    if row:
        conn.execute("UPDATE treatment_plans SET updated_at = ? WHERE id = ?",
                     (iso(0), row["plan_id"]))
        return get_plan(conn, row["plan_id"])
    return None


def set_procedure_status(conn: sqlite3.Connection, proc_id: str, status: str) -> dict | None:
    data = {"status": status}
    if status == "completed":
        data["completedDate"] = today().isoformat()
    if status == "scheduled" or status == "in_progress":
        row = conn.execute("SELECT scheduled_date FROM plan_procedures WHERE id = ?",
                           (proc_id,)).fetchone()
        if row and not row["scheduled_date"]:
            data["scheduledDate"] = iso(0)
    return update_procedure(conn, proc_id, data)


def delete_procedure(conn: sqlite3.Connection, proc_id: str) -> bool:
    row = conn.execute("SELECT plan_id FROM plan_procedures WHERE id = ?", (proc_id,)).fetchone()
    cur = conn.execute("DELETE FROM plan_procedures WHERE id = ?", (proc_id,))
    if row and cur.rowcount:
        conn.execute("UPDATE treatment_plans SET updated_at = ? WHERE id = ?",
                     (iso(0), row["plan_id"]))
    return cur.rowcount > 0


def toggle_care_task(conn: sqlite3.Connection, task_id: str) -> dict | None:
    row = conn.execute("SELECT plan_id, done FROM care_tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        return None
    conn.execute("UPDATE care_tasks SET done = ? WHERE id = ?",
                 (0 if row["done"] else 1, task_id))
    return get_plan(conn, row["plan_id"])