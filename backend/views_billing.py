"""Billing endpoints: invoices list/get/create, payments, summary."""

from __future__ import annotations

import sqlite3
from datetime import date, timedelta

from db import iso, rows_dicts, today
from helpers import invoice_totals, patient_summary

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
          "Oct", "Nov", "Dec"]


def _compose_invoice(conn: sqlite3.Connection, r: dict) -> dict:
    inv_id = r["id"]
    lines = [{
        "id": li["id"], "description": li["description"], "code": li["code"],
        "quantity": li["quantity"], "unitPrice": li["unit_price"],
        "amount": li["amount"], "tooth": li["tooth"] or "",
    } for li in rows_dicts(conn.execute(
        "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY id",
        (inv_id,)).fetchall())]
    payments = [{
        "id": p["id"], "invoiceId": inv_id, "amount": p["amount"],
        "method": p["method"], "date": p["date"], "reference": p["reference"] or "",
    } for p in rows_dicts(conn.execute(
        "SELECT * FROM payments WHERE invoice_id = ? ORDER BY date", (inv_id,)
    ).fetchall())]
    c = conn.execute("SELECT * FROM insurance_claims WHERE invoice_id = ?",
                     (inv_id,)).fetchone()
    claim = None
    if c:
        claim = {"id": c["id"], "invoiceId": inv_id, "payer": c["payer"],
                 "amount": c["amount"], "status": c["status"],
                 "filedDate": c["filed_date"]}
    return {
        "id": inv_id,
        "number": r["number"],
        "patient": patient_summary(conn, r["patient_id"]),
        "createdDate": r["created_date"],
        "dueDate": r["due_date"],
        "lineItems": lines,
        "payments": payments,
        "claim": claim,
        "notes": r["notes"] or "",
        "totals": invoice_totals(conn, inv_id),
    }


def next_invoice_number(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT number FROM invoices").fetchall()
    nums = [int(r["number"].rsplit("-", 1)[1]) for r in rows if r["number"]]
    return f"INV-{today().year}-{max(nums) + 1 if nums else 1000:04d}"


def list_invoices(conn: sqlite3.Connection, search=None, status=None) -> list[dict]:
    sql = "SELECT * FROM invoices"
    conds, params = [], []
    if search:
        conds.append("(patient_id IN (SELECT id FROM patients WHERE name LIKE ?) OR number LIKE ?)")
        like = f"%{search}%"
        params += [like, like]
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY created_date DESC"
    rows = rows_dicts(conn.execute(sql, params).fetchall())
    out = [_compose_invoice(conn, r) for r in rows]
    if status and status != "all":
        out = [i for i in out if i["totals"]["status"] == status]
    return out


def create_invoice(conn: sqlite3.Connection, data: dict) -> dict | None:
    inv_id = data.get("id") or next_invoice_number(conn)
    number = data.get("number") or inv_id
    due_offset = int(data.get("dueOffsetDays", 30))
    created = data.get("createdDate") or iso(0)
    conn.execute(
        "INSERT OR REPLACE INTO invoices (id, number, patient_id, created_date, due_date, notes) "
        "VALUES (?,?,?,?,?,?)",
        (inv_id, number, data.get("patientId"), created,
         iso(due_offset), data.get("notes") or ""),
    )
    count = conn.execute("SELECT COUNT(*) AS c FROM invoice_line_items").fetchone()["c"]
    for k, it in enumerate(data.get("items") or []):
        qty = int(it.get("quantity", 1))
        unit = float(it.get("unitPrice", 0))
        conn.execute(
            "INSERT INTO invoice_line_items "
            "(id, invoice_id, description, code, quantity, unit_price, amount, tooth) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (f"LI-{count + k + 1:04d}", inv_id,
             it.get("description"), it.get("code") or "",
             qty, unit, round(qty * unit, 2), str(it.get("tooth") or "")),
        )
    return _compose_invoice(conn, conn.execute(
        "SELECT * FROM invoices WHERE id = ?", (inv_id,)).fetchone())


def record_payment(conn: sqlite3.Connection, invoice_id: str, data: dict) -> dict | None:
    count = conn.execute("SELECT COUNT(*) AS c FROM payments").fetchone()["c"]
    pid = data.get("id") or f"PAY-{count + 1:04d}"
    conn.execute(
        "INSERT INTO payments (id, invoice_id, amount, method, date, reference) "
        "VALUES (?,?,?,?,?,?)",
        (pid, invoice_id, float(data.get("amount", 0)),
         data.get("method", "card"), data.get("date") or iso(0),
         data.get("reference") or ""),
    )
    return _compose_invoice(conn, conn.execute(
        "SELECT * FROM invoices WHERE id = ?", (invoice_id,)).fetchone())


def billing_summary(conn: sqlite3.Connection) -> dict:
    t = today()
    def first_of(offset: int) -> str:
        d = t.replace(day=1)
        y = d.year + (d.month - 1 + offset) // 12
        m = (d.month - 1 + offset) % 12 + 1
        return f"{y:04d}-{m:02d}-01"

    cur_start, prev_start = first_of(0), first_of(-1)
    next_start = first_of(1)
    revenue = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM payments WHERE date >= ? AND date < ?",
        (cur_start, next_start)).fetchone()[0]
    prev_rev = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM payments WHERE date >= ? AND date < ?",
        (prev_start, cur_start)).fetchone()[0]

    lines = []
    for c, n in [(cur_start, next_start), (prev_start, cur_start)]:
        billed = conn.execute(
            "SELECT COALESCE(SUM(li.amount),0) FROM invoice_line_items li "
            "JOIN invoices i ON i.id = li.invoice_id WHERE i.created_date >= ? AND i.created_date < ?",
            (c, n)).fetchone()[0]
        collected = conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM payments WHERE date >= ? AND date < ?",
            (c, n)).fetchone()[0]
        lines.append({"billed": billed, "collected": collected})

    invoices = [_compose_invoice(conn, r) for r in rows_dicts(
        conn.execute("SELECT * FROM invoices").fetchall())]
    outstanding = [i for i in invoices if i["totals"]["status"] in ("unpaid", "partial", "overdue")]
    aging = [0, 0, 0, 0]
    for i in outstanding:
        if i["totals"]["status"] == "overdue":
            days = (t - date.fromisoformat(i["dueDate"])).days
            idx = 0 if days <= 30 else 1 if days <= 60 else 2 if days <= 90 else 3
            aging[idx] += i["totals"]["balance"]
    aging = [round(x, 2) for x in aging]

    claims = []
    for i in invoices:
        if i["claim"] and i["claim"]["status"] not in ("approved", "paid"):
            claims.append(i["claim"])

    trend = []
    for off in range(-5, 1):
        s = first_of(off)
        e = first_of(off + 1)
        billed = conn.execute(
            "SELECT COALESCE(SUM(li.amount),0) FROM invoice_line_items li "
            "JOIN invoices i ON i.id = li.invoice_id WHERE i.created_date >= ? AND i.created_date < ?",
            (s, e)).fetchone()[0]
        collected = conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM payments WHERE date >= ? AND date < ?",
            (s, e)).fetchone()[0]
        y, m = date.fromisoformat(s).year, date.fromisoformat(s).month
        trend.append({"month": MONTHS[m - 1], "revenue": billed, "collected": collected})

    return {
        "netRevenue": revenue,
        "prevMonthRevenue": prev_rev,
        "outstandingAmount": round(sum(i["totals"]["balance"] for i in outstanding), 2),
        "outstandingCount": len(outstanding),
        "activeClaims": claims,
        "aging": aging,
        "revenueTrend": trend,
    }