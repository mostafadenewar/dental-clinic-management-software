"""Seed treatment plans, phases, procedures, and care tasks (demo data)."""

from __future__ import annotations

import re
import sqlite3

from db import iso, json_text

CARE_TASKS = ["Present estimate", "Confirm appointment", "Collect consent"]


def _proc(pid, plan, phase, name, code, cat, teeth=None, status="planned",
          planned=None, scheduled=None, completed=None, fee=0, ins=0,
          resp=None, notes="", provider="DOC-01"):
    if resp is None:
        resp = max(0, fee - ins)
    return (pid, plan, phase, name, code, cat, json_text(teeth or []), provider,
            status, planned, scheduled, completed, fee, ins, resp, notes)


PLANS = [
    dict(id="PLAN-1042", title="Full-Mouth Restoration",
         desc="Restore posterior function with full-coverage crowns, endo retreat on #19, and final occlusal seal.",
         status="pending_approval", patient="PT-2024-0412", doctor="DOC-02", coord="COR-02", ins="INS-01",
         created=iso(-12), updated=iso(-1)),
    dict(id="PLAN-1041", title="Clear Aligners Program",
         desc="Full-arch clear aligner therapy for alignment and overbite correction across 14 aligner steps.",
         status="approved", patient="PT-2024-0891", doctor="DOC-01", coord="COR-01", ins="INS-02",
         created=iso(-28), updated=iso(-2)),
    dict(id="PLAN-1043", title="Whitening & Esthetics",
         desc="In-office power whitening with take-home trays and facial composite bonding on #8/#9.",
         status="draft", patient="PT-2024-1102", doctor="DOC-01", coord="COR-01", ins="INS-03",
         created=iso(-6), updated=iso(-5)),
    dict(id="PLAN-1039", title="Implant Restoration #19 & #30",
         desc="Surgical implant placement for missing first molars with implant-supported crowns.",
         status="scheduled", patient="PT-2023-0941", doctor="DOC-04", coord="COR-02", ins="INS-01",
         created=iso(-24), updated=iso(-3)),
    dict(id="PLAN-1040", title="Preventive Care Plan",
         desc="Routine prophylaxis, fluoride, and sealants with a 6-month recall cadence.",
         status="in_progress", patient="PT-2024-0219", doctor="DOC-01", coord="COR-01", ins="INS-03",
         created=iso(-15), updated=iso(-1)),
    dict(id="PLAN-1032", title="Molar Endo & Crown",
         desc="Root canal therapy on #30 with porcelain crown. Completed recently.",
         status="completed", patient="PT-2023-0507", doctor="DOC-03", coord="COR-02", ins="INS-01",
         created=iso(-47), updated=iso(-10)),
]

PROCEDURES = [
    _proc("PR-1042-11", "PLAN-1042", "PH-1042-1", "Comprehensive Oral Evaluation", "D0150", "Diagnostic", None, "completed", iso(-10), None, iso(-10), 85, 60, 25, "Full perio charting completed.", "DOC-02"),
    _proc("PR-1042-12", "PLAN-1042", "PH-1042-1", "Full-Mouth X-ray Series", "D0210", "Diagnostic", None, "completed", iso(-10), None, iso(-10), 140, 98, 42, "", "DOC-02"),
    _proc("PR-1042-21", "PLAN-1042", "PH-1042-2", "Crown - Porcelain/Ceramic", "D2740", "Restorative", [3], "scheduled", iso(-5), iso(7), None, 1080, 700, 380, "Temporization at first prep visit.", "DOC-02"),
    _proc("PR-1042-22", "PLAN-1042", "PH-1042-2", "Crown - Porcelain/Ceramic", "D2740", "Restorative", [14], "scheduled", iso(-5), iso(14), None, 1080, 700, 380, "", "DOC-02"),
    _proc("PR-1042-23", "PLAN-1042", "PH-1042-2", "Endodontic Retreatment - Molar", "D3346", "Endodontics", [19], "planned", iso(21), None, None, 890, 623, 267, "Chronically failing composite; retreat before crown.", "DOC-03"),
    _proc("PR-1042-24", "PLAN-1042", "PH-1042-2", "Crown - Porcelain/Ceramic", "D2740", "Restorative", [2], "planned", iso(42), None, None, 1045, 700, 345, "", "DOC-02"),
    _proc("PR-1042-31", "PLAN-1042", "PH-1042-3", "Recall Examination", "D0120", "Preventive", None, "planned", iso(70), None, None, 55, 39, 16),
    _proc("PR-1041-11", "PLAN-1041", "PH-1041-1", "Digital Impressions / Scans", "D0370", "Diagnostic", None, "completed", iso(-21), None, iso(-21), 250, 0, 250, "", "DOC-01"),
    _proc("PR-1041-12", "PLAN-1041", "PH-1041-1", "Orthodontic Records", "D0350", "Diagnostic", None, "completed", iso(-21), None, iso(-21), 120, 0, 120, "", "DOC-01"),
    _proc("PR-1041-21", "PLAN-1041", "PH-1041-2", "Comprehensive Orthodontic Treatment - Adult", "D8080", "Orthodontics", None, "scheduled", iso(-5), iso(13), None, 3800, 1500, 2300, "14-step plan; 3 refinement rounds budgeted.", "DOC-01"),
    _proc("PR-1041-22", "PLAN-1041", "PH-1041-2", "Retainer", "D8680", "Orthodontics", None, "planned", iso(168), None, None, 320, 150, 170),
    _proc("PR-1043-11", "PLAN-1043", "PH-1043-1", "In-Office Bleaching - Per Arch", "D9972", "Cosmetic", None, "planned", iso(20), None, None, 550, 0, 550, "", "DOC-01"),
    _proc("PR-1043-12", "PLAN-1043", "PH-1043-1", "Whitening Trays - Maxillary & Mandibular", "D9972", "Cosmetic", None, "planned", iso(20), None, None, 220, 0, 220, "", "DOC-01"),
    _proc("PR-1043-13", "PLAN-1043", "PH-1043-1", "Resin-Based Composite - Facial", "D2394", "Restorative", [8, 9], "planned", iso(36), None, None, 590, 0, 590),
    _proc("PR-1039-11", "PLAN-1039", "PH-1039-1", "Surgical Implant Placement - Endosteal", "D6010", "Oral Surgery", [19], "scheduled", iso(-2), iso(2), None, 1650, 1000, 650, "CBCT-guided; bone density D2.", "DOC-04"),
    _proc("PR-1039-12", "PLAN-1039", "PH-1039-1", "Surgical Implant Placement - Endosteal", "D6010", "Oral Surgery", [30], "scheduled", iso(16), iso(22), None, 1650, 1000, 650, "", "DOC-04"),
    _proc("PR-1039-21", "PLAN-1039", "PH-1039-2", "Implant-Supported Crown", "D6065", "Prosthodontics", [19], "planned", iso(70), None, None, 1280, 850, 430, "", "DOC-02"),
    _proc("PR-1039-22", "PLAN-1039", "PH-1039-2", "Implant-Supported Crown", "D6065", "Prosthodontics", [30], "planned", iso(70), None, None, 1280, 850, 430, "", "DOC-02"),
    _proc("PR-1039-23", "PLAN-1039", "PH-1039-2", "Occlusal Adjustment", "D9971", "Prosthodontics", None, "planned", iso(84), None, None, 120, 84, 36),
    _proc("PR-1040-11", "PLAN-1040", "PH-1040-1", "Periodic Oral Evaluation", "D0120", "Diagnostic", None, "completed", iso(-14), None, iso(-14), 55, 55, 0, "", "DOC-01"),
    _proc("PR-1040-12", "PLAN-1040", "PH-1040-1", "Adult Prophylaxis", "D1110", "Preventive", None, "in_progress", iso(-14), None, None, 110, 110, 0, "", "DOC-01"),
    _proc("PR-1040-13", "PLAN-1040", "PH-1040-1", "Topical Fluoride Varnish", "D1208", "Preventive", None, "planned", iso(170), None, None, 45, 45, 0),
    _proc("PR-1040-14", "PLAN-1040", "PH-1040-1", "Sealant - Per Tooth", "D1351", "Preventive", [4, 13], "planned", iso(170), None, None, 130, 104, 26),
    _proc("PR-1032-11", "PLAN-1032", "PH-1032-1", "Molar Root Canal Therapy", "D3330", "Endodontics", [30], "completed", iso(-40), None, iso(-40), 980, 686, 294, "Single visit; warm vertical condensation.", "DOC-03"),
    _proc("PR-1032-21", "PLAN-1032", "PH-1032-2", "Crown - Porcelain/Ceramic", "D2740", "Restorative", [30], "completed", iso(-17), None, iso(-17), 1085, 700, 385, "", "DOC-02"),
]

PHASES = {
    "PLAN-1042": [("PH-1042-1", "Diagnostics & Records", 1, "Initial evaluation, imaging and consent."),
                  ("PH-1042-2", "Restorative Phase", 2, "Full-coverage crowns and endodontic retreat."),
                  ("PH-1042-3", "Maintenance", 3, "Post-restoration recall.")],
    "PLAN-1041": [("PH-1041-1", "Records & Scans", 1, "Digital impressions and case planning."),
                  ("PH-1041-2", "Active Alignment", 2, "Comprehensive orthodontic treatment.")],
    "PLAN-1043": [("PH-1043-1", "Esthetic Phase", 1, "Whitening and anterior bonding.")],
    "PLAN-1039": [("PH-1039-1", "Surgical Phase", 1, "Implant placement and healing."),
                  ("PH-1039-2", "Restorative Phase", 2, "Implant-supported crowns after osseointegration.")],
    "PLAN-1040": [("PH-1040-1", "Preventive Phase", 1, "Cleanings, fluoride and sealants.")],
    "PLAN-1032": [("PH-1032-1", "Endodontics", 1, "Root canal therapy."),
                  ("PH-1032-2", "Restorative", 2, "Final crown.")],
}


def seed_treatment(conn: sqlite3.Connection) -> None:
    for p in PLANS:
        conn.execute(
            "INSERT OR IGNORE INTO treatment_plans VALUES (?,?,?,?,?,?,?,?,?,?)",
            (p["id"], p["title"], p["desc"], p["status"], p["patient"], p["doctor"],
             p["coord"], p["ins"], p["created"], p["updated"]),
        )
        for t in CARE_TASKS:
            key = (re.sub(r"[^A-Z]", "", t.upper()) or "TASK")[:5]
            conn.execute("INSERT OR IGNORE INTO care_tasks VALUES (?,?,?,0)",
                         (f"{p['id']}-{key}", p["id"], t))
        for ph in PHASES[p["id"]]:
            conn.execute("INSERT OR IGNORE INTO plan_phases VALUES (?,?,?,?,?)",
                         (ph[0], p["id"], ph[1], ph[2], ph[3]))

    conn.executemany(
        "INSERT OR IGNORE INTO plan_procedures VALUES "
        "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        PROCEDURES,
    )