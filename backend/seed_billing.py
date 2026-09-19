"""Seed demo billing data.

* Legacy invoices are kept so the patients page and dashboard keep working.
* patient_payments are the chairside payment records (insurance deduction on
  the bill is recorded per payment).
* expenses is the clinic's outgoing ledger (wages, lab, materials, taxes...).
"""

from __future__ import annotations

import sqlite3

from db import iso

EXPENSE_CATEGORIES = ["Wages", "Laboratory", "Materials", "Rent & Utilities",
                      "Equipment", "Taxes", "Marketing", "Other"]


def _inv(conn, inv_id, number, patient, created, due, notes="", lines=(), payments=()):
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


INVOICES = [
    ("INV-2026-0132", "INV-2026-0132", "PT-2023-0612", -150, -120,
     "Scaling & root planing, four quadrants.",
     [("LI-0132-1", "Scaling & Root Planing - Per Quadrant", "D4341", 4, 145, 580, "")],
     [("PAY-0132-1", 580, "insurance", iso(-149), "ERA-7011")]),
    ("INV-2026-0140", "INV-2026-0140", "PT-2025-0144", -95, -65,
     "Periodic exam + prophylaxis.",
     [("LI-0140-1", "Periodic Oral Evaluation", "D0120", 1, 55, 55, ""),
      ("LI-0140-2", "Adult Prophylaxis", "D1110", 1, 110, 110, "")],
     []),
    ("INV-2026-0145", "INV-2026-0145", "PT-2025-0311", -60, -30,
     "Routine hygiene visit.",
     [("LI-0145-1", "Plant Teeth Film - Bitewing", "D0274", 1, 65, 65, ""),
      ("LI-0145-2", "Adult Prophylaxis", "D1110", 1, 110, 110, "")],
     [("PAY-0145-1", 175, "card", iso(-59), "TXN-8710")]),
    ("INV-2026-0148", "INV-2026-0148", "PT-2024-0412", -44, -14,
     "Remaining balance due after claim adjudication.",
     [("LI-0148-1", "Endodontic Retreatment - Molar (#19)", "D3346", 1, 890, 890, "19"),
      ("LI-0148-2", "Core Buildup (#19)", "D2950", 1, 340, 340, "19")],
     [("PAY-0148-1", 250, "card", iso(-43), "TXN-8821")]),
    ("INV-2026-0150", "INV-2026-0150", "PT-2024-0771", -30, 0, "",
     [("LI-0150-1", "Adult Prophylaxis", "D1120", 1, 85, 85, "")],
     [("PAY-0150-1", 85, "card", iso(-8), "TXN-8850")]),
    ("INV-2026-0151", "INV-2026-0151", "PT-2024-0891", -21, +9, "",
     [("LI-0151-1", "Digital Impressions / Scans", "D0370", 1, 250, 250, ""),
      ("LI-0151-2", "Orthodontic Records", "D0350", 1, 120, 120, "")],
     [("PAY-0151-1", 370, "card", iso(-21), "TXN-8830")]),
    ("INV-2026-0155", "INV-2026-0155", "PT-2023-0941", -17, +13, "",
     [("LI-0155-1", "Surgical Implant Placement (#19)", "D6010", 1, 1650, 1650, "19"),
      ("LI-0155-2", "CBCT - Cone Beam Scan", "D0367", 1, 240, 240, ""),
      ("LI-0155-3", "Non-IV Conscious Sedation", "D9248", 1, 210, 210, "")],
     []),
    ("INV-2026-0158", "INV-2026-0158", "PT-2024-0219", -14, +16, "",
     [("LI-0158-1", "Adult Prophylaxis", "D1110", 1, 110, 110, ""),
      ("LI-0158-2", "Periodic Oral Evaluation", "D0120", 1, 55, 55, ""),
      ("LI-0158-3", "Topical Fluoride Varnish", "D1208", 1, 45, 45, "")],
     [("PAY-0158-1", 210, "insurance", iso(-12), "ERA-7712")]),
    ("INV-2026-0161", "INV-2026-0161", "PT-2024-1102", -11, +19, "",
     [("LI-0161-1", "Resin Composite - Facial (#8)", "D2394", 1, 590, 590, "8")],
     [("PAY-0161-1", 590, "cash", iso(-11), "CASH-1188")]),
    ("INV-2026-0164", "INV-2026-0164", "PT-2023-0507", -6, +24, "",
     [("LI-0164-1", "Crown - Porcelain/Ceramic (#30)", "D2740", 1, 1085, 1085, "30"),
      ("LI-0164-2", "Provisional Crown", "D2951", 1, 90, 90, "30")],
     [("PAY-0164-1", 300, "card", iso(-6), "TXN-8899")]),
    ("INV-2026-0167", "INV-2026-0167", "PT-2024-0412", -4, +26, "",
     [("LI-0167-1", "Crown - Porcelain/Ceramic (#3)", "D2740", 1, 1080, 1080, "3")],
     [("PAY-0167-1", 380, "card", iso(-4), "TXN-8905")]),
    ("INV-2026-0170", "INV-2026-0170", "PT-2024-1102", -2, +28, "",
     [("LI-0170-1", "In-Office Bleaching - Per Arch", "D9972", 1, 550, 550, "")],
     [("PAY-0170-1", 550, "card", iso(-2), "TXN-8912")]),
]

# id, procedure_id, amount_paid, insurance_amount, method, date, reference
PROCEDURE_PAYMENTS = [
    ("PPAY-001", "TR-1042-1", 270, 620, "card", iso(-3), "TXN-9010"),
    ("PPAY-002", "TR-1041-1", 250, 0, "card", iso(-21), "TXN-8830"),
    ("PPAY-003", "TR-1101-1", 290, 690, "card", iso(-39), "TXN-9001"),
    ("PPAY-004", "TR-1101-2", 335, 750, "card", iso(-16), "TXN-8899"),
    ("PPAY-005", "TR-1102-1", 110, 110, "card", iso(-6), "TXN-9020"),
    ("PPAY-006", "TR-1102-2", 20, 90, "card", iso(-8), "TXN-9018"),
    ("PPAY-007", "TR-1103-1", 110, 0, "cash", iso(-12), "CASH-1101"),
    ("PPAY-008", "TR-1104-1", 15, 50, "card", iso(-5), "TXN-9022"),
    ("PPAY-009", "TR-1104-2", 5, 40, "card", iso(-5), "TXN-9023"),
    ("PPAY-010", "TR-1105-2", 80, 0, "cash", iso(-1), "CASH-1102"),
    ("PPAY-011", "TR-1106-1", 180, 0, "card", iso(-40), "TXN-9002"),
    ("PPAY-012", "TR-1107-1", 550, 0, "card", iso(-2), "TXN-8912"),
]

# id, category, description, amount, date, paid_to, notes
EXPENSES = [
    ("EXP-001", "Wages", "Staff payroll — hygiene team", 4200, iso(-3), "Payroll", ""),
    ("EXP-002", "Wages", "Staff payroll — hygiene team", 4200, iso(-33), "Payroll", ""),
    ("EXP-003", "Laboratory", "Porcelain crowns — batch", 640, iso(-9), "Sunburst Dental Lab", ""),
    ("EXP-004", "Laboratory", "Implant abutments", 520, iso(-21), "Sunburst Dental Lab", ""),
    ("EXP-005", "Materials", "Composite restock", 380, iso(-11), "Dental Depot", ""),
    ("EXP-006", "Materials", "Anesthesia & disposables", 210, iso(-25), "MedCo Supply", ""),
    ("EXP-007", "Rent & Utilities", "Suite rent", 1800, iso(-1), "Harborview Property Mgmt", ""),
    ("EXP-008", "Rent & Utilities", "Suite rent", 1800, iso(-32), "Harborview Property Mgmt", ""),
    ("EXP-009", "Equipment", "Sterilizer service contract", 725, iso(-15), "MedQuip", ""),
    ("EXP-010", "Taxes", "Payroll taxes", 850, iso(-4), "Gov", ""),
    ("EXP-011", "Taxes", "Payroll taxes", 850, iso(-34), "Gov", ""),
    ("EXP-012", "Marketing", "Local print ads", 300, iso(-12), "CityPress", ""),
    ("EXP-013", "Other", "License renewal", 199, iso(-40), "Board", ""),
]


def seed_billing(conn: sqlite3.Connection) -> None:
    for inv in INVOICES:
        inv_id, number, patient, created, due, notes, lines, payments = inv
        _inv(conn, inv_id, number, patient, iso(created), iso(due), notes, lines, payments)

    conn.executemany(
        "INSERT OR IGNORE INTO patient_payments "
        "(id, procedure_id, amount_paid, insurance_amount, method, date, reference) "
        "VALUES (?,?,?,?,?,?,?)",
        PROCEDURE_PAYMENTS,
    )

    conn.executemany(
        "INSERT OR IGNORE INTO expenses "
        "(id, category, description, amount, date, paid_to, notes) VALUES (?,?,?,?,?,?,?)",
        EXPENSES,
    )