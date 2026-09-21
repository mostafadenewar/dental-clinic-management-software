"""SQLite connection, schema, and shared helpers for the DCMS backend.

Zero third-party dependencies — stdlib ``sqlite3`` only — so the backend can
be deployed anywhere Python 3.8+ is available. The database is created on
first run and seeded with realistic demo data (see ``seed.py``), which makes
the app usable immediately after deployment.
"""

from __future__ import annotations

import datetime
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.environ.get("DCMS_DB", os.path.join(DATA_DIR, "dental_clinic.db"))


def today() -> datetime.date:
    """Application 'today'. Override with DCMS_SIM_DATE for deterministic tests."""
    sim = os.environ.get("DCMS_SIM_DATE")
    if sim:
        return datetime.date.fromisoformat(sim)
    return datetime.date.today()


def iso(offset_days: int = 0) -> str:
    return (today() + datetime.timedelta(days=offset_days)).isoformat()


def now_iso() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS coordinators (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS insurance (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, policy_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '', gender TEXT NOT NULL DEFAULT 'Other', dob TEXT,
  address TEXT NOT NULL DEFAULT '', insurance_id TEXT, status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, provider_id TEXT NOT NULL DEFAULT 'DOC-01',
  title TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, start_time TEXT NOT NULL,
  end_time TEXT NOT NULL, room TEXT NOT NULL DEFAULT 'Room 1',
  status TEXT NOT NULL DEFAULT 'scheduled', notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff', active INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL, at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0,
  ref_id TEXT NOT NULL DEFAULT '', UNIQUE(kind, ref_id)
);
CREATE TABLE IF NOT EXISTS treatment_plans (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS treatment_procedures (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, plan_id TEXT,
  procedure_name TEXT NOT NULL, code TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General', teeth TEXT NOT NULL DEFAULT '[]',
  provider_id TEXT NOT NULL DEFAULT 'DOC-01', status TEXT NOT NULL DEFAULT 'planned',
  done_date TEXT, fee REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS patient_payments (
  id TEXT PRIMARY KEY, procedure_id TEXT NOT NULL,
  amount_paid REAL NOT NULL DEFAULT 0, insurance_amount REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash', date TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0, date TEXT NOT NULL,
  paid_to TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, number TEXT NOT NULL, patient_id TEXT NOT NULL,
  created_date TEXT NOT NULL, due_date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, description TEXT NOT NULL, code TEXT NOT NULL DEFAULT '',
  quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0, tooth TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'other', date TEXT NOT NULL, reference TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS storage_locations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, capacity INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Consumables',
  pack_size TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT 'each',
  quantity_on_hand REAL NOT NULL DEFAULT 0, minimum_threshold REAL NOT NULL DEFAULT 0,
  reorder_quantity REAL NOT NULL DEFAULT 0, location_id TEXT NOT NULL DEFAULT 'LOC-01',
  cost_per_unit REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'inbound',
  quantity REAL NOT NULL DEFAULT 0, date TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '', performed_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS supplier_orders (
  id TEXT PRIMARY KEY, supplier TEXT NOT NULL, total_cost REAL NOT NULL DEFAULT 0,
  placed_date TEXT NOT NULL, estimated_arrival TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE TABLE IF NOT EXISTS supplier_order_lines (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL, item_id TEXT NOT NULL,
  item_name TEXT NOT NULL DEFAULT '', quantity REAL NOT NULL DEFAULT 0, unit_cost REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS procedure_catalog (
  code TEXT PRIMARY KEY, name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Diagnostic', default_fee REAL NOT NULL DEFAULT 0
);
"""


# Tables that existed in earlier schema versions. When the schema version
# changes we drop everything and rebuild (this app is demo-data driven, so a
# destructive version bump keeps things simple and correct).
TABLE_NAMES = [
    "providers", "coordinators", "insurance", "patients",
    "appointments", "users", "sessions", "notifications",
    "treatment_plans", "plan_phases",
    "plan_procedures", "care_tasks", "insurance_benefits", "treatment_templates",
    "treatment_procedures", "patient_payments", "expenses", "invoices",
    "invoice_line_items", "invoice_payments", "payments", "insurance_claims",
    "storage_locations", "inventory_items", "inventory_transactions",
    "supplier_orders", "supplier_order_lines", "activity_log", "procedure_catalog",
]

SCHEMA_VERSION = "5"


def init_db() -> None:
    conn = connect()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        row = conn.execute("SELECT value FROM app_meta WHERE key = 'schema_version'").fetchone()
        version = row["value"] if row else None
        if version != SCHEMA_VERSION:
            conn.execute("PRAGMA foreign_keys = OFF")
            for table in TABLE_NAMES:
                conn.execute(f"DROP TABLE IF EXISTS {table}")
            conn.executescript(SCHEMA)
            conn.execute(
                "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?)",
                (SCHEMA_VERSION,),
            )
            conn.commit()
        else:
            conn.executescript(SCHEMA)
            conn.commit()
    finally:
        conn.close()


def is_seeded() -> bool:
    conn = connect()
    try:
        count = conn.execute("SELECT COUNT(*) AS c FROM patients").fetchone()["c"]
        return count > 0
    finally:
        conn.close()


def row_dict(row: sqlite3.Row | None) -> dict:
    return dict(row) if row is not None else {}


def rows_dicts(rows) -> list[dict]:
    return [dict(r) for r in rows]


def json_text(value) -> str:
    import json

    return json.dumps(value, separators=(",", ":"))


def parse_teeth(raw: str) -> list[int]:
    import json

    try:
        return json.loads(raw or "[]")
    except (ValueError, TypeError):
        return []


def next_sequential_id(conn: sqlite3.Connection, table: str, column: str, prefix: str) -> str:
    row = conn.execute(f"SELECT {column} FROM {table} ORDER BY {column} DESC LIMIT 1").fetchone()
    if row is None:
        return f"{prefix}0001"
    current = str(row[column] or "")
    digits = "".join(ch for ch in current if ch.isdigit())
    try:
        nxt = int(digits) + 1 if digits else 1
    except ValueError:
        nxt = 1
    return f"{prefix}{nxt:04d}"