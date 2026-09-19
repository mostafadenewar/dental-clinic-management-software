"""Seed invoices, line items, payments, and insurance claims (demo data)."""

from __future__ import annotations

import sqlite3

from db import iso


def _inv(conn, inv_id, number, patient, created, due, notes="", lines=(), payments=(), claim=None):
    conn.execute(
        "INSERT OR IGNORE INTO invoices VALUES (?,?,?,?,?,?)",
        (inv_id, number, patient, created, due, notes),
    )
    for li in lines:
        conn.execute(
            "INSERT OR IGNORE INTO invoice_line_items VALUES (?,?,?,?,?,?,?,?)",
            (li[0], inv_id, li[1], li[2], li[3], li[4], li[5], li[6]),
        )
    for p in payments:
        conn.execute(
            "INSERT OR IGNORE INTO payments VALUES (?,?,?,?,?,?)",
            (p[0], inv_id, p[1], p[2], p[3], p[4]),
        )
    if claim:
        conn.execute(
            "INSERT OR IGNORE INTO insurance_claims VALUES (?,?,?,?,?,?)",
            (claim[0], inv_id, claim[1], claim[2], claim[3], claim[4]),
        )


INVOICES = [
    # id, number, patient, created_offset, due_offset
    ("INV-2026-0132", "INV-2026-0132", "PT-2023-0612", -150, -120,
     "Scaling & root planing, four quadrants.",
     [("LI-0132-1", "Scaling & Root Planing - Per Quadrant", "D4341", 4, 145, 580, "")],
     [("PAY-0132-1", 580, "insurance", iso(-149), "ERA-7011")],
     ("CLM-4401", "Delta Dental", 400, "approved", iso(-148))),
    ("INV-2026-0140", "INV-2026-0140", "PT-2025-0144", -95, -65,
     "Periodic exam + prophylaxis.",
     [("LI-0140-1", "Periodic Oral Evaluation", "D0120", 1, 55, 55, ""),
      ("LI-0140-2", "Adult Prophylaxis", "D1110", 1, 110, 110, "")],
     [],
     None),
    ("INV-2026-0145", "INV-2026-0145", "PT-2025-0311", -60, -30,
     "Routine hygiene visit.",
     [("LI-0145-1", "Plant Teeth Film - Bitewing", "D0274", 1, 65, 65, ""),
      ("LI-0145-2", "Adult Prophylaxis", "D1110", 1, 110, 110, "")],
     [("PAY-0145-1", 175, "card", iso(-59), "TXN-8710")],
     None),
    ("INV-2026-0148", "INV-2026-0148", "PT-2024-0412", -44, -14,
     "Remaining balance due after claim adjudication.",
     [("LI-0148-1", "Endodontic Retreatment - Molar (#19)", "D3346", 1, 890, 890, "19"),
      ("LI-0148-2", "Core Buildup (#19)", "D2950", 1, 340, 340, "19")],
     [("PAY-0148-1", 250, "card", iso(-43), "TXN-8821")],
     ("CLM-4412", "Delta Dental", 820, "processing", iso(-42))),
    ("INV-2026-0150", "INV-2026-0150", "PT-2024-0771", -30, 0,
     "",
     [("LI-0150-1", "Adult Prophylaxis", "D1120", 1, 85, 85, "")],
     [("PAY-0150-1", 85, "card", iso(-8), "TXN-8850")],
     None),
    ("INV-2026-0151", "INV-2026-0151", "PT-2024-0891", -21, +9,
     "",
     [("LI-0151-1", "Digital Impressions / Scans", "D0370", 1, 250, 250, ""),
      ("LI-0151-2", "Orthodontic Records", "D0350", 1, 120, 120, "")],
     [("PAY-0151-1", 370, "card", iso(-21), "TXN-8830")],
     ("CLM-4419", "Cigna", 150, "submitted", iso(-20))),
    ("INV-2026-0155", "INV-2026-0155", "PT-2023-0941", -17, +13,
     "",
     [("LI-0155-1", "Surgical Implant Placement (#19)", "D6010", 1, 1650, 1650, "19"),
      ("LI-0155-2", "CBCT - Cone Beam Scan", "D0367", 1, 240, 240, ""),
      ("LI-0155-3", "Non-IV Conscious Sedation", "D9248", 1, 210, 210, "")],
     [],
     ("CLM-4426", "Delta Dental", 980, "pending", iso(-16))),
    ("INV-2026-0158", "INV-2026-0158", "PT-2024-0219", -14, +16,
     "",
     [("LI-0158-1", "Adult Prophylaxis", "D1110", 1, 110, 110, ""),
      ("LI-0158-2", "Periodic Oral Evaluation", "D0120", 1, 55, 55, ""),
      ("LI-0158-3", "Topical Fluoride Varnish", "D1208", 1, 45, 45, "")],
     [("PAY-0158-1", 210, "insurance", iso(-12), "ERA-7712")],
     ("CLM-4430", "MetLife", 210, "approved", iso(-13))),
    ("INV-2026-0161", "INV-2026-0161", "PT-2024-1102", -11, +19,
     "",
     [("LI-0161-1", "Resin Composite - Facial (#8)", "D2394", 1, 590, 590, "8")],
     [("PAY-0161-1", 590, "cash", iso(-11), "CASH-1188")],
     None),
    ("INV-2026-0164", "INV-2026-0164", "PT-2023-0507", -6, +24,
     "",
     [("LI-0164-1", "Crown - Porcelain/Ceramic (#30)", "D2740", 1, 1085, 1085, "30"),
      ("LI-0164-2", "Provisional Crown", "D2951", 1, 90, 90, "30")],
     [("PAY-0164-1", 300, "card", iso(-6), "TXN-8899")],
     ("CLM-4436", "Delta Dental", 700, "processing", iso(-5))),
    ("INV-2026-0167", "INV-2026-0167", "PT-2024-0412", -4, +26,
     "",
     [("LI-0167-1", "Crown - Porcelain/Ceramic (#3)", "D2740", 1, 1080, 1080, "3")],
     [("PAY-0167-1", 380, "card", iso(-4), "TXN-8905")],
     ("CLM-4439", "Delta Dental", 700, "pending", iso(-3))),
    ("INV-2026-0170", "INV-2026-0170", "PT-2024-1102", -2, +28,
     "",
     [("LI-0170-1", "In-Office Bleaching - Per Arch", "D9972", 1, 550, 550, "")],
     [("PAY-0170-1", 550, "card", iso(-2), "TXN-8912")],
     None),
]


def seed_billing(conn: sqlite3.Connection) -> None:
    for inv in INVOICES:
        inv_id, number, patient, created, due, notes, lines, payments, claim = inv
        _inv(conn, inv_id, number, patient, iso(created), iso(due), notes, lines, payments, claim)