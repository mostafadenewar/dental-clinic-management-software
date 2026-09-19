"""Treatment workbench + practice billing ledger views.

Treatments are recorded on a patient (optionally grouped by a named plan).
Billing is a per-procedure payment record (with optional insurance deduction)
plus a clinic expenses ledger. Legacy invoices are untouched (still used by
the patients page and dashboard).
"""

from __future__ import annotations

import json
import sqlite3
import time
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from db import iso, today
from helpers import patient_summary

try:
    TZ = ZoneInfo("America/New_York")
except (ZoneInfoNotFoundError, ValueError):
    # Windows/Python without the IANA tz database (e.g. no `tzdata` package):
    # fall back to the machine's local timezone.
    TZ = datetime.now().astimezone().tzinfo or timezone.utc


def _json_list(text: str) -> list:
    try:
        v = json.loads(text)
        return v if isinstance(v, list) else []
    except (ValueError, TypeError):
        return []


def _new_id(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000) % 1000000}"


def _patient_insurance(conn: sqlite3.Connection, patient_id: str) -> str:
    row = conn.execute(
        "SELECT i.provider FROM patients p LEFT JOIN insurance i ON i.id = p.insurance_id "
        "WHERE p.id = ?",
        (patient_id,),
    ).fetchone()
    return row["provider"] if row and row["provider"] else ""


def procedure_payments(conn: sqlite3.Connection, procedure_id: str) -> list[dict]:
    return [{
        "id": r["id"], "amountPaid": r["amount_paid"],
        "insuranceAmount": r["insurance_amount"], "method": r["method"],
        "date": r["date"], "reference": r["reference"] or "",
    } for r in conn.execute(
        "SELECT * FROM patient_payments WHERE procedure_id = ? ORDER BY date", (procedure_id,)
    ).fetchall()]


def _compose_procedure(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    pid = row["id"]
    paid = conn.execute(
        "SELECT COALESCE(SUM(amount_paid), 0) AS a, COALESCE(SUM(insurance_amount), 0) AS b "
        "FROM patient_payments WHERE procedure_id = ?",
        (pid,),
    ).fetchone()
    plan_name = ""
    if row["plan_id"]:
        p = conn.execute("SELECT name FROM treatment_plans WHERE id = ?", (row["plan_id"],)).fetchone()
        plan_name = p["name"] if p else ""
    return {
        "id": pid,
        "patient": patient_summary(conn, row["patient_id"]),
        "insuranceProvider": _patient_insurance(conn, row["patient_id"]),
        "planId": row["plan_id"],
        "planName": plan_name,
        "procedureName": row["procedure_name"],
        "code": row["code"] or "",
        "category": row["category"] or "General",
        "teeth": _json_list(row["teeth"]),
        "providerId": row["provider_id"],
        "status": row["status"],
        "doneDate": row["done_date"],
        "fee": row["fee"] or 0,
        "amountPaid": round(paid["a"], 2),
        "insuranceAmount": round(paid["b"], 2),
        "notes": row["notes"] or "",
        "applied": round(paid["a"] + paid["b"], 2),
        "balance": round(max(0.0, (row["fee"] or 0) - (paid["a"] + paid["b"])), 2),
        "payments": procedure_payments(conn, pid),
    }


def list_patient_procedures(conn: sqlite3.Connection, patient_id: str | None = None) -> list[dict]:
    q = "SELECT * FROM treatment_procedures"
    args: tuple = ()
    if patient_id:
        q += " WHERE patient_id = ?"
        args = (patient_id,)
    q += " ORDER BY created_at DESC"
    return [_compose_procedure(conn, r) for r in conn.execute(q, args).fetchall()]


def create_patient_procedure(conn: sqlite3.Connection, data: dict) -> dict:
    pid = _new_id("TR")
    row = (
        pid,
        data.get("patientId", ""),
        data.get("planId") or None,
        data.get("procedureName", "Treatment"),
        data.get("code", "") or "",
        data.get("category", "General") or "General",
        json.dumps(data.get("teeth") or []),
        data.get("providerId", "DOC-01") or "DOC-01",
        data.get("status", "planned") or "planned",
        data.get("doneDate") or (iso(0) if data.get("status") == "done" else None),
        float(data.get("fee", 0) or 0),
        data.get("notes", "") or "",
        today().isoformat() + " " + datetime.now(TZ).strftime("%H:%M:%S"),
    )
    conn.execute(
        "INSERT INTO treatment_procedures "
        "(id, patient_id, plan_id, procedure_name, code, category, teeth, "
        "provider_id, status, done_date, fee, notes, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        row,
    )
    return _compose_procedure(conn, conn.execute(
        "SELECT * FROM treatment_procedures WHERE id = ?", (pid,)
    ).fetchone())


def update_patient_procedure(conn: sqlite3.Connection, pid: str, data: dict) -> dict | None:
    cur = conn.execute("SELECT * FROM treatment_procedures WHERE id = ?", (pid,))
    if cur.fetchone() is None:
        return None
    fields = []
    args: list = []
    for api, col in (("procedureName", "procedure_name"), ("code", "code"),
                     ("category", "category"), ("notes", "notes"),
                     ("teeth", "teeth"), ("status", "status"),
                     ("fee", "fee"), ("planId", "plan_id"),
                     ("providerId", "provider_id"), ("doneDate", "done_date")):
        if api in data:
            if api == "planId":
                fields.append(f"{col} = ?")
                args.append(data[api] or None)
            elif api == "teeth":
                fields.append(f"{col} = ?")
                args.append(json.dumps(data[api] or []))
            elif api == "fee":
                fields.append(f"{col} = ?")
                args.append(float(data[api] or 0))
            else:
                fields.append(f"{col} = ?")
                args.append(data[api])
    if "status" in data and data["status"] == "done" and not data.get("doneDate"):
        fields.append("done_date = ?")
        args.append(iso(0))
    elif "status" in data and data["status"] != "done":
        fields.append("done_date = ?")
        args.append(None)
    if fields:
        conn.execute(
            f"UPDATE treatment_procedures SET {', '.join(fields)} WHERE id = ?",
            (*args, pid),
        )
    return _compose_procedure(conn, conn.execute(
        "SELECT * FROM treatment_procedures WHERE id = ?", (pid,)
    ).fetchone())


def delete_patient_procedure(conn: sqlite3.Connection, pid: str) -> bool:
    cur = conn.execute("SELECT id FROM treatment_procedures WHERE id = ?", (pid,))
    if cur.fetchone() is None:
        return False
    conn.execute("DELETE FROM patient_payments WHERE procedure_id = ?", (pid,))
    conn.execute("DELETE FROM treatment_procedures WHERE id = ?", (pid,))
    return True


def record_patient_payment(conn: sqlite3.Connection, pid: str, data: dict) -> dict | None:
    row = conn.execute("SELECT id, fee FROM treatment_procedures WHERE id = ?", (pid,))
    proc = row.fetchone()
    if proc is None:
        return None
    amt = float(data.get("amountPaid", 0) or 0)
    ins = float(data.get("insuranceAmount", 0) or 0)
    pay_id = _new_id("PPAY")
    conn.execute(
        "INSERT INTO patient_payments "
        "(id, procedure_id, amount_paid, insurance_amount, method, date, reference) "
        "VALUES (?,?,?,?,?,?,?)",
        (pay_id, pid, amt, ins, data.get("method", "cash") or "cash",
         data.get("date") or iso(0), data.get("reference", "") or ""),
    )
    if ins > 0 or amt > 0:
        conn.execute(
            "UPDATE treatment_procedures SET status = 'done', done_date = COALESCE(done_date, ?) "
            "WHERE id = ?",
            (data.get("date") or iso(0), pid),
        )
    return _compose_procedure(conn, conn.execute(
        "SELECT * FROM treatment_procedures WHERE id = ?", (pid,)
    ).fetchone())


def list_plan_groups(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT p.*, "
        "(SELECT COUNT(*) FROM treatment_procedures tp WHERE tp.plan_id = p.id) AS proc_count "
        "FROM treatment_plans p ORDER BY p.created_at DESC"
    ).fetchall()
    return [{
        "id": r["id"],
        "patient": patient_summary(conn, r["patient_id"]),
        "name": r["name"],
        "notes": r["notes"] or "",
        "procedureCount": r["proc_count"],
        "createdAt": r["created_at"],
    } for r in rows]


def create_plan_group(conn: sqlite3.Connection, data: dict) -> dict:
    gid = _new_id("PLAN")
    conn.execute(
        "INSERT INTO treatment_plans (id, patient_id, name, notes, created_at) VALUES (?,?,?,?,?)",
        (gid, data.get("patientId", ""), data.get("name", "Treatment Plan"),
         data.get("notes", "") or "", today().isoformat() + " " + datetime.now(TZ).strftime("%H:%M:%S")),
    )
    row = conn.execute("SELECT * FROM treatment_plans WHERE id = ?", (gid,)).fetchone()
    return {
        "id": row["id"], "patient": patient_summary(conn, row["patient_id"]),
        "name": row["name"], "notes": row["notes"] or "", "procedureCount": 0,
        "createdAt": row["created_at"],
    }


def delete_plan_group(conn: sqlite3.Connection, gid: str) -> bool:
    cur = conn.execute("SELECT id FROM treatment_plans WHERE id = ?", (gid,))
    if cur.fetchone() is None:
        return False
    conn.execute("UPDATE treatment_procedures SET plan_id = NULL WHERE plan_id = ?", (gid,))
    conn.execute("DELETE FROM treatment_plans WHERE id = ?", (gid,))
    return True


EXPENSE_CATEGORIES = ["Wages", "Laboratory", "Materials", "Rent & Utilities",
                      "Equipment", "Taxes", "Marketing", "Other"]


def list_expenses(conn: sqlite3.Connection, month: str | None = None) -> list[dict]:
    q = "SELECT * FROM expenses"
    args: tuple = ()
    if month:
        q += " WHERE substr(date, 1, 7) = ?"
        args = (month,)
    q += " ORDER BY date DESC"
    return [{
        "id": r["id"], "category": r["category"], "description": r["description"],
        "amount": r["amount"], "date": r["date"], "paidTo": r["paid_to"],
        "notes": r["notes"] or "",
    } for r in conn.execute(q, args).fetchall()]


def create_expense(conn: sqlite3.Connection, data: dict) -> dict:
    eid = _new_id("EXP")
    cat = data.get("category", "Other") or "Other"
    if cat not in EXPENSE_CATEGORIES:
        cat = "Other"
    conn.execute(
        "INSERT INTO expenses (id, category, description, amount, date, paid_to, notes) "
        "VALUES (?,?,?,?,?,?,?)",
        (eid, cat, data.get("description", "Expense") or "Expense",
         float(data.get("amount", 0) or 0), data.get("date") or iso(0),
         data.get("paidTo", "") or "", data.get("notes", "") or ""),
    )
    row = conn.execute("SELECT * FROM expenses WHERE id = ?", (eid,)).fetchone()
    return {
        "id": row["id"], "category": row["category"], "description": row["description"],
        "amount": row["amount"], "date": row["date"], "paidTo": row["paid_to"],
        "notes": row["notes"] or "",
    }


def delete_expense(conn: sqlite3.Connection, eid: str) -> bool:
    cur = conn.execute("SELECT id FROM expenses WHERE id = ?", (eid,))
    if cur.fetchone() is None:
        return False
    conn.execute("DELETE FROM expenses WHERE id = ?", (eid,))
    return True


def _month_range(offset: int = 0) -> tuple[str, str]:
    d = date.today().replace(day=1)
    if offset:
        y = d.year + ((d.month - 1 + offset) // 12)
        m = (d.month - 1 + offset) % 12 + 1
        d = d.replace(year=y, month=m)
    start = d.isoformat()
    if d.month == 12:
        end = d.replace(year=d.year + 1, month=1).isoformat()
    else:
        end = d.replace(month=d.month + 1).isoformat()
    return start, end


def billing_overview(conn: sqlite3.Connection) -> dict:
    start, end = _month_range()
    p_start, p_end = _month_range(-1)

    collected = conn.execute(
        "SELECT COALESCE(SUM(amount_paid),0) AS a, COALESCE(SUM(insurance_amount),0) AS b "
        "FROM patient_payments WHERE date >= ? AND date < ?",
        (start, end),
    ).fetchone()
    revenue = round(collected["a"] + collected["b"], 2)
    patient_collected = round(collected["a"], 2)
    insurance_portion = round(collected["b"], 2)

    prev = conn.execute(
        "SELECT COALESCE(SUM(amount_paid),0) + COALESCE(SUM(insurance_amount),0) AS t "
        "FROM patient_payments WHERE date >= ? AND date < ?",
        (p_start, p_end),
    ).fetchone()["t"]

    wages = conn.execute(
        "SELECT COALESCE(SUM(amount),0) AS t FROM expenses "
        "WHERE category = 'Wages' AND date >= ? AND date < ?",
        (start, end),
    ).fetchone()["t"]
    other_exp = conn.execute(
        "SELECT COALESCE(SUM(amount),0) AS t FROM expenses "
        "WHERE category != 'Wages' AND date >= ? AND date < ?",
        (start, end),
    ).fetchone()["t"]
    expenses_total = round(wages + other_exp, 2)

    outstanding = conn.execute(
        """
        SELECT COALESCE(SUM(
          CASE WHEN tp.fee > (paid.a + paid.b)
               THEN tp.fee - (paid.a + paid.b) ELSE 0 END), 0) AS t
        FROM treatment_procedures tp
        LEFT JOIN
          (SELECT pp.procedure_id,
                  COALESCE(SUM(pp.amount_paid),0) AS a,
                  COALESCE(SUM(pp.insurance_amount),0) AS b
           FROM patient_payments pp GROUP BY pp.procedure_id) paid
          ON paid.procedure_id = tp.id
        """
    ).fetchone()[0]

    return {
        "patientCollected": patient_collected,
        "insurancePortion": insurance_portion,
        "revenue": revenue,
        "prevMonthRevenue": round(prev, 2),
        "wagesExpenses": round(wages, 2),
        "otherExpenses": round(other_exp, 2),
        "expensesTotal": expenses_total,
        "netProfit": round(revenue - expenses_total, 2),
        "outstandingTreatments": round(outstanding, 2),
    }


def billing_payments(conn: sqlite3.Connection, patient_id: str | None = None) -> list[dict]:
    q = """
        SELECT pp.*, tp.procedure_name, tp.fee, tp.patient_id
        FROM patient_payments pp
        JOIN treatment_procedures tp ON tp.id = pp.procedure_id
    """
    args: tuple = ()
    if patient_id:
        q += " WHERE tp.patient_id = ?"
        args = (patient_id,)
    q += " ORDER BY pp.date DESC"
    return [{
        "id": r["id"],
        "patient": patient_summary(conn, r["patient_id"]),
        "procedureName": r["procedure_name"],
        "procedureFee": r["fee"],
        "amountPaid": r["amount_paid"],
        "insuranceAmount": r["insurance_amount"],
        "method": r["method"],
        "date": r["date"],
        "reference": r["reference"] or "",
    } for r in conn.execute(q, args).fetchall()]