"""Seed the procedure catalog and recent activity log entries."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

from db import now_iso

CATALOG = [
    ("D0150", "Comprehensive Oral Evaluation", "Diagnostic", 85),
    ("D0120", "Periodic Oral Evaluation", "Diagnostic", 55),
    ("D0210", "Full-Mouth X-ray Series", "Diagnostic", 140),
    ("D0330", "Panoramic Image", "Diagnostic", 110),
    ("D0367", "CBCT - Cone Beam Scan", "Diagnostic", 240),
    ("D1110", "Adult Prophylaxis", "Preventive", 110),
    ("D1120", "Adolescent Prophylaxis", "Preventive", 85),
    ("D1208", "Topical Fluoride Varnish", "Preventive", 45),
    ("D1351", "Sealant - Per Tooth", "Preventive", 65),
    ("D2140", "Amalgam - One Surface", "Restorative", 165),
    ("D2391", "Resin Composite - One Surface", "Restorative", 195),
    ("D2394", "Resin-Based Composite - Facial", "Restorative", 590),
    ("D2740", "Crown - Porcelain/Ceramic", "Restorative", 1080),
    ("D2950", "Core Buildup", "Restorative", 340),
    ("D3330", "Molar Root Canal Therapy", "Endodontics", 980),
    ("D3346", "Endodontic Retreatment - Molar", "Endodontics", 890),
    ("D4341", "Scaling & Root Planing - Per Quadrant", "Periodontics", 290),
    ("D6010", "Surgical Implant Placement - Endosteal", "Oral Surgery", 1650),
    ("D6065", "Implant-Supported Crown", "Prosthodontics", 1280),
    ("D8080", "Comprehensive Orthodontics - Adult", "Orthodontics", 3800),
    ("D8680", "Orthodontic Retainer", "Orthodontics", 320),
    ("D9248", "Non-IV Conscious Sedation", "Oral Surgery", 210),
    ("D9971", "Occlusal Adjustment", "Prosthodontics", 120),
    ("D9972", "In-Office Bleaching - Per Arch", "Cosmetic", 550),
]

ACTIVITIES = [
    ("treatment", "Kim Silva completed molar endo & crown", 10),
    ("lab", "Lab report received for Maria Lawson", 45),
    ("stock", "Low stock: Composite Resin A2", 60),
    ("patient", "New patient Grace Nguyen registered", 120),
    ("appointment", "Appointment confirmed for Robert Hayes", 180),
    ("payment", "Payment recorded from James Carter", 300),
]


def seed_catalog(conn: sqlite3.Connection) -> None:
    conn.executemany("INSERT OR IGNORE INTO procedure_catalog VALUES (?,?,?,?)", CATALOG)


def seed_activity(conn: sqlite3.Connection) -> None:
    base = datetime.now()
    for kind, message, minutes_ago in ACTIVITIES:
        at = (base - timedelta(minutes=minutes_ago)).isoformat(timespec="seconds")
        conn.execute("INSERT OR IGNORE INTO activity_log (kind, message, at) VALUES (?,?,?)",
                     (kind, message, at))