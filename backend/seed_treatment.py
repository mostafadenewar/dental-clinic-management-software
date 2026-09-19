"""Seed patient treatment records and optional named plan groups (demo data).

Treatments are recorded directly on a patient — a plan is only an optional
named group a procedure can be attached to. No phases, no approval workflow.
"""

from __future__ import annotations

import sqlite3

from db import iso, json_text


def _rec(rid, patient, plan, name, code, cat, teeth=None, status="planned",
         done=None, fee=0, notes="", provider="DOC-01", created=None):
    return (rid, patient, plan, name, code, cat, json_text(teeth or []),
            provider, status, done, fee, notes,
            created or iso(-14))

PLAN_GROUPS = [
    ("PLAN-1042", "PT-2024-0412", "Full-Mouth Restoration",
     "Crowns, an endo retreat and final occlusal seal.", iso(-12)),
    ("PLAN-1041", "PT-2024-0891", "Clear Aligners Program",
     "Full-arch clear aligner therapy.", iso(-28)),
    ("PLAN-1039", "PT-2023-0941", "Implant Restoration #19 & #30",
     "Surgical placement with implant-supported crowns.", iso(-24)),
]

RECORDS = [
    _rec("TR-1042-1", "PT-2024-0412", "PLAN-1042", "Root Canal Therapy — Molar", "D3330", "Endodontics", [19], "done", iso(-3), 890, "Single visit.", "DOC-03"),
    _rec("TR-1042-2", "PT-2024-0412", "PLAN-1042", "Crown — Porcelain/Ceramic", "D2740", "Restorative", [3], "planned", None, 1080, "", "DOC-02"),
    _rec("TR-1042-3", "PT-2024-0412", "PLAN-1042", "Crown — Porcelain/Ceramic", "D2740", "Restorative", [14], "planned", None, 1080, "", "DOC-02"),
    _rec("TR-1042-4", "PT-2024-0412", "PLAN-1042", "Crown — Porcelain/Ceramic", "D2740", "Restorative", [2], "planned", None, 1045, "", "DOC-02"),
    _rec("TR-1042-5", "PT-2024-0412", "PLAN-1042", "Recall Examination", "D0120", "Diagnostic", None, "planned", None, 55, "", "DOC-01"),
    _rec("TR-1041-1", "PT-2024-0891", "PLAN-1041", "Digital Impressions / Scans", "D0370", "Diagnostic", None, "done", iso(-21), 250, "", "DOC-01"),
    _rec("TR-1041-2", "PT-2024-0891", "PLAN-1041", "Comprehensive Orthodontic Treatment — Adult", "D8080", "Orthodontics", None, "planned", None, 3800, "", "DOC-01"),
    _rec("TR-1041-3", "PT-2024-0891", "PLAN-1041", "Retainer", "D8680", "Orthodontics", None, "planned", None, 320, "", "DOC-01"),
    _rec("TR-1039-1", "PT-2023-0941", "PLAN-1039", "Surgical Implant Placement", "D6010", "Oral Surgery", [19], "planned", None, 1650, "CBCT-guided.", "DOC-04"),
    _rec("TR-1039-2", "PT-2023-0941", "PLAN-1039", "Surgical Implant Placement", "D6010", "Oral Surgery", [30], "planned", None, 1650, "", "DOC-04"),
    _rec("TR-1039-3", "PT-2023-0941", "PLAN-1039", "Implant-Supported Crown", "D6065", "Prosthodontics", [19], "planned", None, 1280, "", "DOC-02"),
    _rec("TR-1101-1", "PT-2023-0507", None, "Molar Root Canal Therapy", "D3330", "Endodontics", [30], "done", iso(-40), 980, "Warm vertical condensation.", "DOC-03"),
    _rec("TR-1101-2", "PT-2023-0507", None, "Crown — Porcelain/Ceramic", "D2740", "Restorative", [30], "done", iso(-17), 1085, "", "DOC-02"),
    _rec("TR-1102-1", "PT-2024-0771", None, "Composite Restoration", "D2391", "Restorative", [8], "done", iso(-6), 220, "", "DOC-01"),
    _rec("TR-1102-2", "PT-2024-0771", None, "Adult Prophylaxis", "D1110", "Preventive", None, "done", iso(-8), 110, "", "DOC-01"),
    _rec("TR-1103-1", "PT-2025-0311", None, "Adult Prophylaxis", "D1110", "Preventive", None, "done", iso(-12), 110, "", "DOC-01"),
    _rec("TR-1104-1", "PT-2024-0219", None, "Sealant — Per Tooth", "D1351", "Preventive", ["A", "L"], "done", iso(-5), 65, "Child dentition.", "DOC-01"),
    _rec("TR-1104-2", "PT-2024-0219", None, "Topical Fluoride Varnish", "D1208", "Preventive", None, "done", iso(-5), 45, "", "DOC-01"),
    _rec("TR-1105-1", "PT-2026-1201", None, "Sealant — Per Tooth", "D1351", "Preventive", ["K", "T"], "planned", None, 65, "Child dentition.", "DOC-01"),
    _rec("TR-1105-2", "PT-2026-1201", None, "Pediatric Cleaning", "D1120", "Preventive", None, "done", iso(-1), 80, "", "DOC-01"),
    _rec("TR-1106-1", "PT-2026-1201", None, "Composite Restoration", "D2391", "Restorative", ["G"], "done", iso(-40), 180, "", "DOC-01"),
    _rec("TR-1107-1", "PT-2024-1102", None, "In-Office Bleaching — Per Arch", "D9972", "Cosmetic", None, "done", iso(-2), 550, "", "DOC-01"),
    _rec("TR-1107-2", "PT-2024-1102", None, "Whitening Trays", "D9972", "Cosmetic", None, "planned", None, 220, "", "DOC-01"),
]


def seed_treatment(conn: sqlite3.Connection) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO treatment_plans (id, patient_id, name, notes, created_at) "
        "VALUES (?,?,?,?,?)",
        PLAN_GROUPS,
    )
    conn.executemany(
        "INSERT OR IGNORE INTO treatment_procedures "
        "(id, patient_id, plan_id, procedure_name, code, category, teeth, "
        "provider_id, status, done_date, fee, notes, created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        RECORDS,
    )