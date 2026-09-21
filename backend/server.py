"""DCMS API server (stdlib only).

Serves JSON over HTTP on 127.0.0.1, enabling CORS, and prints a single
``DCMS_BACKEND_PORT=<port>`` line to stdout that Electron's main process
parses to forward the URL to the renderer.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from db import connect, init_db, is_seeded
from seed import seed_all
from views_appointments import (
    create_appointment, delete_appointment, get_appointment, list_appointments,
    set_appointment_status, update_appointment,
)
from views_auth import (
    authenticate, change_password, login, logout, update_profile,
)
from views_backup import (
    create_backup, delete_backup, list_backups, restore_backup,
)
from views_billing import billing_summary, create_invoice, list_invoices, record_payment
from views_dashboard import dashboard
from views_inventory import (
    adjust_quantity, create_item, create_order, delete_item, get_item,
    inventory_summary, list_items, list_locations, list_orders, list_transactions,
    update_item,
)
from views_notifications import (
    list_notifications, mark_all_read, mark_read, sync_notifications, unread_count,
)
from views_patients import (
    create_patient, delete_patient, get_patient, list_patients, patient_history,
    update_patient,
)
from views_treatment import (
    billing_overview, billing_payments, create_expense, create_patient_procedure,
    create_plan_group, delete_expense, delete_patient_procedure, delete_plan_group,
    list_expenses, list_plan_groups, list_patient_procedures,
    record_patient_payment, update_patient_procedure,
)

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "DCMS/1.0"

    def log_message(self, fmt, *args):
        pass

    def _send(self, status: int, payload) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        self._route("GET")

    def do_POST(self):
        self._route("POST")

    def do_PUT(self):
        self._route("PUT")

    def do_PATCH(self):
        self._route("PATCH")

    def do_DELETE(self):
        self._route("DELETE")

    # -- routing ------------------------------------------------------------

    def _auth_token(self) -> str:
        header = (self.headers.get("Authorization") or "").strip()
        if header.lower().startswith("bearer "):
            return header[7:].strip()
        return ""

    def _route(self, method: str):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = parse_qs(parsed.query)
        seg = [s for s in path.split("/") if s]
        public = (
            seg == ["api", "auth", "login"]
            or seg == ["api", "health"]
            or (seg and seg[0] != "api")
        )
        restoring = (
            method == "POST"
            and len(seg) == 4
            and seg[:2] == ["api", "backups"]
            and seg[3] == "restore"
        )
        body = self._read_body() if method in ("POST", "PUT", "PATCH") else {}
        conn = connect()
        try:
            if not public:
                token = self._auth_token() or (query.get("token") or [""])[0]
                user = authenticate(conn, token)
                if user is None:
                    self._send(401, {"error": "authentication required"})
                    return
                self.auth_user = user
            else:
                self.auth_user = None

            if restoring:
                # restore_backup flushes and closes `conn` as part of swapping
                # the database file, so it is handled here rather than in
                # _dispatch (whose response helpers re-commit on `conn`).
                try:
                    payload = restore_backup(conn, seg[2])
                except ValueError as exc:
                    self._send(400, {"error": str(exc)})
                except sqlite3.Error:
                    self._send(500, {"error": "database error"})
                except Exception as exc:  # noqa: BLE001
                    self._send(500, {"error": str(exc)})
                else:
                    self._send(200, payload)
                return

            self._dispatch(conn, method, path, query, body)
        except ValueError as exc:
            conn.rollback()
            self._send(400, {"error": str(exc)})
        except sqlite3.Error:
            conn.rollback()
            self._send(500, {"error": "database error"})
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            self._send(500, {"error": str(exc)})
        finally:
            conn.close()

    def _dispatch(self, conn, method, path, query, body):
        seg = [s for s in path.split("/") if s]

        def ok(payload=None, status=200):
            conn.commit()
            if payload is None:
                self._send(status, {"ok": True})
            else:
                self._send(status, payload)

        # /api/health
        if seg == ["api", "health"] and method == "GET":
            count = conn.execute("SELECT COUNT(*) AS c FROM patients").fetchone()["c"]
            return ok({"ok": True, "seeded": is_seeded(), "patients": count})

        # /api/auth/*
        if seg == ["api", "auth", "login"] and method == "POST":
            return ok(login(conn, body))

        if seg == ["api", "auth", "logout"] and method == "POST":
            logout(conn, self._auth_token())
            return ok()

        if seg == ["api", "auth", "me"] and method == "GET":
            return ok(self.auth_user)

        if seg == ["api", "auth", "profile"] and method in ("PATCH", "PUT"):
            u = update_profile(conn, self.auth_user["id"], body)
            return ok(u) if u else self._send(404, {"error": "not found"})

        if seg == ["api", "auth", "password"] and method == "POST":
            change_password(conn, self.auth_user["id"], body)
            return ok()

        # /api/notifications
        if seg == ["api", "notifications"] and method == "GET":
            sync_notifications(conn)
            return ok({"notifications": list_notifications(conn), "unread": unread_count(conn)})

        if seg == ["api", "notifications", "unread"] and method == "GET":
            sync_notifications(conn)
            return ok({"count": unread_count(conn)})

        if len(seg) == 4 and seg[0] == "api" and seg[1] == "notifications" and seg[3] == "read":
            if method == "POST":
                mark_read(conn, seg[2])
                return ok({"unread": unread_count(conn)})

        if seg == ["api", "notifications", "read-all"] and method == "POST":
            mark_all_read(conn)
            return ok()

        # /api/backups
        if seg == ["api", "backups"] and method == "GET":
            return ok(list_backups(conn))

        if seg == ["api", "backups"] and method == "POST":
            return ok(create_backup(conn), 201)

        if len(seg) == 4 and seg[0] == "api" and seg[1] == "backups" and seg[3] == "restore":
            pass  # handled in _route (closes the connection during swap)

        if len(seg) == 3 and seg[0] == "api" and seg[1] == "backups":
            if method == "DELETE":
                return ok(delete_backup(conn, seg[2]))

        if seg == ["api", "dashboard"] and method == "GET":
            return ok(dashboard(conn))

        if seg == ["api", "pat"] or seg == ["api", "patients"]:
            if method == "GET":
                return ok(list_patients(conn))
            if method == "POST":
                return ok(create_patient(conn, body), 201)

        if len(seg) == 4 and seg[0] == "api" and seg[1] in ("pat", "patients") and seg[3] == "history":
            if method == "GET":
                p = get_patient(conn, seg[2])
                if p is None:
                    return self._send(404, {"error": "not found"})
                return ok(patient_history(conn, seg[2]))

        if len(seg) == 3 and seg[0] == "api" and seg[1] in ("pat", "patients"):
            pid = seg[2]
            if method == "GET":
                p = get_patient(conn, pid)
                return ok(p) if p else self._send(404, {"error": "not found"})
            if method == "PATCH" or method == "PUT":
                p = update_patient(conn, pid, body)
                return ok(p) if p else self._send(404, {"error": "not found"})
            if method == "DELETE":
                if delete_patient(conn, pid):
                    return ok()
                return self._send(404, {"error": "not found"})

        if seg == ["api", "appointments"]:
            if method == "GET":
                start = (query.get("start") or [None])[0]
                end = (query.get("end") or [None])[0]
                return ok(list_appointments(conn, start, end))
            if method == "POST":
                return ok(create_appointment(conn, body), 201)

        if len(seg) == 3 and seg[0] == "api" and seg[1] == "appointments":
            aid = seg[2]
            if method == "GET":
                a = get_appointment(conn, aid)
                return ok(a) if a else self._send(404, {"error": "not found"})
            if method == "PATCH" or method == "PUT":
                a = update_appointment(conn, aid, body)
                return ok(a) if a else self._send(404, {"error": "not found"})
            if method == "DELETE":
                if delete_appointment(conn, aid):
                    return ok()
                return self._send(404, {"error": "not found"})

        if len(seg) == 4 and seg[0] == "api" and seg[1] == "appointments" and seg[3] == "status":
            if method in ("PATCH", "PUT", "POST"):
                a = set_appointment_status(conn, seg[2], body.get("status", ""))
                return ok(a) if a else self._send(404, {"error": "not found"})

        if seg == ["api", "treatments"]:
            if method == "GET":
                patient_id = (query.get("patientId") or [None])[0]
                return ok(list_patient_procedures(conn, patient_id))
            if method == "POST":
                return ok(create_patient_procedure(conn, body), 201)

        if len(seg) == 3 and seg[0] == "api" and seg[1] == "treatments":
            if method in ("PATCH", "PUT"):
                p = update_patient_procedure(conn, seg[2], body)
                return ok(p) if p else self._send(404, {"error": "not found"})
            if method == "DELETE":
                if delete_patient_procedure(conn, seg[2]):
                    return ok()
                return self._send(404, {"error": "not found"})

        if len(seg) == 4 and seg[0] == "api" and seg[1] == "treatments" and seg[3] == "payments":
            if method == "POST":
                p = record_patient_payment(conn, seg[2], body)
                return ok(p) if p else self._send(404, {"error": "not found"})

        if seg == ["api", "plan-groups"]:
            if method == "GET":
                return ok(list_plan_groups(conn))
            if method == "POST":
                return ok(create_plan_group(conn, body), 201)

        if len(seg) == 3 and seg[0] == "api" and seg[1] == "plan-groups":
            if method == "DELETE":
                if delete_plan_group(conn, seg[2]):
                    return ok()
                return self._send(404, {"error": "not found"})

        if seg == ["api", "billing", "overview"] and method == "GET":
            return ok(billing_overview(conn))

        if seg == ["api", "billing", "payments"] and method == "GET":
            patient_id = (query.get("patientId") or [None])[0]
            return ok(billing_payments(conn, patient_id))

        if seg == ["api", "expenses"]:
            if method == "GET":
                month = (query.get("month") or [None])[0]
                return ok(list_expenses(conn, month))
            if method == "POST":
                return ok(create_expense(conn, body), 201)

        if len(seg) == 3 and seg[0] == "api" and seg[1] == "expenses":
            if method == "DELETE":
                if delete_expense(conn, seg[2]):
                    return ok()
                return self._send(404, {"error": "not found"})

        if seg == ["api", "billing", "summary"] and method == "GET":
            return ok(billing_summary(conn))

        if seg == ["api", "invoices"]:
            if method == "GET":
                return ok(list_invoices(conn))
            if method == "POST":
                return ok(create_invoice(conn, body), 201)

        if len(seg) == 4 and seg[0] == "api" and seg[1] == "invoices" and seg[3] == "payments":
            if method == "POST":
                inv = record_payment(conn, seg[2], body)
                return ok(inv) if inv else self._send(404, {"error": "not found"})

        if seg == ["api", "inventory"] and method == "GET":
            search = (query.get("search") or [None])[0]
            category = (query.get("category") or ["all"])[0]
            return ok(list_items(conn, search, category))

        if seg == ["api", "inventory", "items"] and method == "POST":
            return ok(create_item(conn, body), 201)

        if seg == ["api", "inventory", "orders"]:
            if method == "GET":
                return ok(list_orders(conn))
            if method == "POST":
                return ok(create_order(conn, body), 201)

        if seg == ["api", "inventory", "summary"] and method == "GET":
            return ok(inventory_summary(conn))

        if seg == ["api", "inventory", "locations"] and method == "GET":
            return ok(list_locations(conn))

        if len(seg) == 4 and seg[0] == "api" and seg[1] == "inventory" and seg[2] == "items":
            iid = seg[3]
            if method == "GET":
                it = get_item(conn, iid)
                return ok(it) if it else self._send(404, {"error": "not found"})
            if method in ("PATCH", "PUT"):
                it = update_item(conn, iid, body)
                return ok(it) if it else self._send(404, {"error": "not found"})
            if method == "DELETE":
                if delete_item(conn, iid):
                    return ok()
                return self._send(404, {"error": "not found"})

        if len(seg) == 5 and seg[0] == "api" and seg[1] == "inventory" and seg[2] == "items" and seg[4] == "adjust":
            if method == "POST":
                it = adjust_quantity(conn, seg[3], float(body.get("delta", 0)),
                                     body.get("reason", ""), body.get("performedBy", "Admin"))
                return ok(it) if it else self._send(404, {"error": "not found"})

        if len(seg) == 5 and seg[0] == "api" and seg[1] == "inventory" and seg[2] == "items" and seg[4] == "transactions":
            if method == "GET":
                return ok(list_transactions(conn, seg[3]))

        if seg == ["api", "catalog"] and method == "GET":
            rows = conn.execute(
                "SELECT code, name, category, default_fee FROM procedure_catalog ORDER BY name"
            ).fetchall()
            return ok([{"code": r["code"], "name": r["name"], "category": r["category"],
                        "defaultFee": r["default_fee"]} for r in rows])

        if seg == ["api", "providers"] and method == "GET":
            return ok([{"id": r["id"], "fullName": r["name"], "role": r["role"], "title": r["title"]}
                       for r in conn.execute("SELECT * FROM providers").fetchall()])

        if seg == ["api", "coordinators"] and method == "GET":
            return ok([{"id": r["id"], "fullName": r["name"], "role": r["role"], "title": r["title"]}
                       for r in conn.execute("SELECT * FROM coordinators").fetchall()])

        if seg == ["api", "insurance"] and method == "GET":
            rows = conn.execute("SELECT * FROM insurance").fetchall()
            return ok([{"id": r["id"], "provider": r["provider"], "policyNumber": r["policy_number"],
                        "notes": r["notes"] or ""} for r in rows])

        self._send(404, {"error": "not found"})


def run(port: int) -> None:
    init_db()
    conn = connect()
    try:
        if not is_seeded():
            seed_all(conn)
        conn.commit()
    finally:
        conn.close()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    actual_port = server.server_address[1]
    print(f"DCMS_BACKEND_PORT={actual_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8419)
    args = parser.parse_args()
    run(args.port)


if __name__ == "__main__":
    main()