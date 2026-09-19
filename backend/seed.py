"""Seed demo data into a fresh SQLite database (idempotent, INSERT OR IGNORE)."""

from __future__ import annotations

import sqlite3
from datetime import timedelta

from db import iso, today
from seed_billing import seed_billing
from seed_catalog import seed_activity, seed_catalog
from seed_inventory import seed_inventory
from seed_treatment import seed_treatment

# ---------------------------------------------------------------------------
# Reference / lookups
# ---------------------------------------------------------------------------

PROVIDERS = [
    ("DOC-01", "Dr. Smith", "Lead Dentist", "DDS"),
    ("DOC-02", "Dr. Lee", "Prosthodontist", "DDS, MPH"),
    ("DOC-03", "Dr. Patel", "Endodontist", "DDS"),
    ("DOC-04", "Dr. Chen", "Oral Surgeon", "DMD"),
]

COORDINATORS = [
    ("COR-01", "Maya Gomez", "Treatment Coordinator", ""),
    ("COR-02", "Luke Adams", "Insurance Coordinator", ""),
]

INSURANCE = [
    ("INS-01", "Delta Dental Premier", "PPO 88123", "DEL-4471", 70, 2000, 1250, "verified", "requested", iso(-4)),
    ("INS-02", "Cigna Dental 1000", "DHMO 22914", "CIG-9012", 50, 1000, 320, "verified", "approved", iso(-8)),
    ("INS-03", "MetLife PDP", "MET-77310", "MTL-2234", 80, 1500, 900, "pending", "not_required", iso(-20)),
]

# id, name, phone, email, gender, dob, address, insurance_id, status, notes, created_at_offset
PATIENTS = [
    ("PT-2024-0891", "Maria Lawson", "+1 (555) 012-3456", "maria.lawson@example.com", "Female", "1998-04-12", "12 Pinewood Ave", "INS-02", "active", "Aligners in progress.", -365),
    ("PT-2024-0412", "James Carter", "+1 (555) 789-0123", "j.carter@example.com", "Male", "1981-09-03", "88 Harbor Lane", "INS-01", "active", "Full-mouth restoration.", -430),
    ("PT-2024-1102", "Priya Nair", "+1 (555) 234-5678", "priya.nair@example.com", "Female", "1994-01-27", "27 Birchwood Rd", "INS-03", "active", "Whitening + esthetics.", -140),
    ("PT-2023-0941", "Robert Hayes", "+1 (555) 345-6789", "r.hayes@example.com", "Male", "1968-07-15", "301 Cedar Court", "INS-01", "active", "Implant case.", -900),
    ("PT-2024-0219", "Emily Brooks", "+1 (555) 678-9012", "emily.brooks@example.com", "Female", "2004-11-30", "9 Maple St", "INS-03", "active", "Preventive care.", -260),
    ("PT-2023-0507", "Kim Silva", "+1 (555) 987-6543", "kim.silva@example.com", "Female", "1987-05-21", "450 Elm Drive", "INS-01", "active", "Endo + crown complete.", -800),
    ("PT-2026-1201", "Daniel Reyes", "+1 (555) 011-2233", "d.reyes@example.com", "Male", "2017-03-14", "60 Sunset Blvd", None, "active", "Pediatric recall.", -2),
    ("PT-2024-0771", "Sarah Kim", "+1 (555) 022-3344", "sarah.kim@example.com", "Female", "1992-08-02", "130 Juniper Ave", "INS-02", "active", "Composite restoration.", -120),
    ("PT-2023-0612", "Lucas Bennett", "+1 (555) 033-4455", "l.bennett@example.com", "Male", "1965-11-19", "5 Wexler Rd", "INS-01", "active", "Periodontal maintenance.", -700),
    ("PT-2026-0902", "Grace Nguyen", "+1 (555) 044-5566", "grace.nguyen@example.com", "Female", "1985-04-22", "77 Oak Avenue", "INS-03", "active", "Registered this week.", -3),
    ("PT-2025-0311", "Tom Anderson", "+1 (555) 055-6677", "t.anderson@example.com", "Male", "1978-06-30", "215 Hillcrest", None, "active", "Routine care.", -510),
    ("PT-2026-0905", "Peter Walsh", "+1 (555) 066-7788", "peter.walsh@example.com", "Male", "1971-09-08", "48 Harborview", "INS-03", "active", "Registered this week.", -1),
    ("PT-2025-0144", "Sofia Rivera", "+1 (555) 077-8899", "sofia.rivera@example.com", "Female", "1990-12-05", "22 Lakeshore Dr", None, "inactive", "Last seen over a year ago.", -700),
]


def seed_providers(conn: sqlite3.Connection) -> None:
    conn.executemany("INSERT OR IGNORE INTO providers VALUES (?,?,?,?)", PROVIDERS)


def seed_coordinators(conn: sqlite3.Connection) -> None:
    conn.executemany("INSERT OR IGNORE INTO coordinators VALUES (?,?,?,?)", COORDINATORS)


def seed_insurance(conn: sqlite3.Connection) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO insurance VALUES (?,?,?,?,?,?,?,?,?,?)",
        INSURANCE,
    )


def seed_patients(conn: sqlite3.Connection) -> None:
    rows = []
    for p in PATIENTS:
        pid, name, phone, email, gender, dob, address, ins, status, notes, offset = p
        rows.append((pid, name, phone, email, gender, dob, address, ins, status, notes, iso(offset)))
    conn.executemany(
        "INSERT OR IGNORE INTO patients (id,name,phone,email,gender,dob,address,insurance_id,status,notes,created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        rows,
    )


def seed_appointments(conn: sqlite3.Connection) -> None:
    """Full week + a few extra, relative to today."""
    monday = (today() - timedelta(days=today().weekday())).isoformat()

    def b(day, patient, title, start, end, room, status, notes="", provider="DOC-01"):
        d = (today() - timedelta(days=today().weekday()) + timedelta(days=day)).isoformat()
        counter[0] += 1
        return (f"APT-{today().year}-{counter[0]:04d}", patient, provider, title, d, start, end, room, status, notes)

    counter = [1000]
    rows = [
        b(0, "PT-2026-1201", "Pediatric Exam", "08:30", "09:00", "Room 2", "completed", "Fluoride varnish applied."),
        b(0, "PT-2024-0891", "Routine Checkup", "09:00", "10:30", "Room 1", "confirmed", "Recall hygiene + exam."),
        b(0, "PT-2024-0412", "Root Canal", "10:30", "12:00", "Room 3", "scheduled", "Final obturation.", "DOC-03"),
        b(0, "PT-2024-0771", "Teeth Cleaning", "11:00", "11:45", "Room 1", "scheduled"),
        b(0, "PT-2024-1102", "Teeth Whitening", "12:00", "13:30", "Room 2", "confirmed", "In-office power whitening."),
        b(0, "PT-2026-0902", "New Patient Exam", "13:00", "13:45", "Room 1", "scheduled", "Intake + comprehensive exam."),
        b(0, "PT-2023-0941", "Implant Consult", "14:15", "15:15", "Room 1", "confirmed", "Treatment plan discussion."),
        b(0, "PT-2024-0219", "Follow-up", "16:00", "16:30", "Room 2", "cancelled", "Rescheduled by patient."),
        b(0, "PT-2025-0311", "New Patient Exam", "17:00", "17:30", "Room 3", "scheduled"),
        b(1, "PT-2023-0507", "Post-Treatment Review", "09:30", "10:15", "Room 1", "confirmed"),
        b(1, "PT-2024-0891", "Aligner Check", "11:00", "11:30", "Room 2", "scheduled"),
        b(1, "PT-2025-0311", "Restorative Consult", "13:00", "13:45", "Room 3", "scheduled", "", "DOC-02"),
        b(2, "PT-2024-0219", "Sealants", "09:00", "09:45", "Room 2", "scheduled"),
        b(2, "PT-2023-0612", "Periodontal Maintenance", "10:00", "11:00", "Room 1", "scheduled"),
        b(2, "PT-2026-1201", "Pediatric Hygiene", "14:00", "14:30", "Room 2", "scheduled"),
        b(3, "PT-2024-0219", "Follow-up", "12:30", "13:45", "Room 2", "scheduled"),
        b(3, "PT-2024-0771", "Composite Restoration", "10:30", "11:15", "Room 1", "scheduled"),
        b(3, "PT-2026-0905", "Exam + Cleaning", "15:00", "15:45", "Room 3", "scheduled"),
        b(4, "PT-2023-0941", "Implant Placement #19", "09:00", "10:30", "Operating Room", "scheduled", "CBCT-guided.", "DOC-04"),
        b(4, "PT-2024-1102", "Whitening Follow-up", "11:30", "12:00", "Room 2", "scheduled"),
        b(5, "PT-2023-0507", "Denture Adjustment", "10:00", "10:30", "Room 3", "scheduled"),
        b(6, "PT-2024-0891", "Ortho Review", "09:00", "09:30", "Room 2", "scheduled"),
        b(6, "PT-2024-0412", "Crown Delivery", "13:30", "14:15", "Room 1", "scheduled", "", "DOC-02"),
        b(7, "PT-2026-0902", "Recall Check", "10:00", "10:30", "Room 1", "scheduled"),
        b(8, "PT-2026-0905", "Hygiene", "09:30", "10:15", "Room 2", "scheduled"),
    ]
    conn.executemany(
        "INSERT OR IGNORE INTO appointments (id,patient_id,provider_id,title,date,start_time,end_time,room,status,notes) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        rows,
    )


def seed_all(conn: sqlite3.Connection) -> None:
    seed_providers(conn)
    seed_coordinators(conn)
    seed_insurance(conn)
    seed_patients(conn)
    seed_appointments(conn)
    seed_treatment(conn)
    seed_billing(conn)
    seed_inventory(conn)
    seed_catalog(conn)
    seed_activity(conn)
    conn.commit()