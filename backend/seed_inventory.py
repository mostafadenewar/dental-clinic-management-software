"""Seed storage locations, inventory items, transactions, and supplier orders."""

from __future__ import annotations

import sqlite3

from db import iso

LOCATIONS = [
    ("LOC-01", "Main Cabinet", 120, 82, "Clinical consumables, syringes, burs"),
    ("LOC-02", "Cold Storage", 48, 20, "Anesthetics, composites, materials (4°C)"),
    ("LOC-03", "Instrument Room", 60, 39, "Sterile instruments and trays"),
]

# id, name, brand, sku, category, pack, unit, qty, min, reorder, loc, cost
ITEMS = [
    ("SKU-1001", "Composite Resin A2", "3M Filtek", "3M-5220", "Consumables", "Syringe - 4 g", "syringe", 9, 12, 12, "LOC-02", 42.5),
    ("SKU-1002", "Dental Floss", "GUM Butler", "GUM-441", "Consumables", "Box - 12 pcs", "box", 46, 15, 12, "LOC-01", 8.9),
    ("SKU-1003", "Impression Tray - Maxillary", "COE", "COE-218", "Instruments", "Pack - 10", "pack", 8, 10, 6, "LOC-01", 18.4),
    ("SKU-1004", "Anesthetic Cartridges 2% Lido", "Septodont", "SEP-885", "Consumables", "Box - 50", "box", 21, 8, 10, "LOC-02", 24.9),
    ("SKU-1005", "Nitrile Exam Gloves (M)", "Medline", "MDL-2201", "PPE & Hygiene", "Box - 100", "box", 34, 10, 15, "LOC-01", 12.7),
    ("SKU-1006", "Surgical Masks - Level 3", "Halyard", "HYD-4810", "PPE & Hygiene", "Box - 50", "box", 6, 12, 10, "LOC-01", 9.6),
    ("SKU-1007", "Sterile Drape Sheets", "Dynarex", "DYN-7001", "PPE & Hygiene", "Box - 25", "box", 3, 8, 8, "LOC-01", 15.2),
    ("SKU-1008", "Polyvinyl Siloxane Impression", "Kerr", "KER-2203", "Consumables", "Cartridge - 380 ml", "cartridge", 14, 6, 6, "LOC-02", 33.1),
    ("SKU-1009", "Hygienist Hand Prophy Angle", "NSK", "NSK-75", "Instruments", "Each", "each", 6, 4, 4, "LOC-03", 58.0),
    ("SKU-1010", "Periodontal Probes", "Hu-Friedy", "HUF-1302", "Instruments", "Set - 6", "set", 2, 4, 3, "LOC-03", 76.5),
    ("SKU-1011", "Alginate Refill", "GC America", "GCA-1100", "Laboratory", "Can - 453 g", "can", 11, 5, 6, "LOC-01", 21.3),
    ("SKU-1012", "Casting Investment", "Whip Mix", "WMX-3000", "Laboratory", "Box - 12 lb", "box", 7, 3, 4, "LOC-01", 47.8),
    ("SKU-1013", "Dental Stone - Die", "Kerr", "KER-2900", "Laboratory", "Bag - 25 lb", "bag", 5, 3, 3, "LOC-01", 39.6),
    ("SKU-1014", "Matrix Bands (Sectional)", "Garrison", "GAR-1044", "Consumables", "Box - 30", "box", 19, 8, 6, "LOC-01", 14.2),
    ("SKU-1015", "Saliva Ejectors", "Henry Schein", "HS-3331", "Consumables", "Box - 100", "box", 52, 20, 10, "LOC-01", 6.4),
]

TXNS = [
    ("TX-9001", "SKU-1001", "outbound", 3, -6, "Restorative procedures", "Dr. Smith"),
    ("TX-9002", "SKU-1004", "inbound", 10, -7, "Purchase order PO-1182", "Maya Gomez"),
    ("TX-9003", "SKU-1006", "outbound", 4, -9, "Operatories restock", "Nina Reed"),
    ("TX-9004", "SKU-1003", "outbound", 2, -11, "Implant case #19", "Dr. Chen"),
    ("TX-9005", "SKU-1010", "inbound", 2, -13, "Physical inventory return", "Luke Adams"),
]

ORDERS = [
    ("PO-1182", "Henry Schein Dental", 345, -10, -3, "shipped",
     [("SKU-1004", "Anesthetic Cartridges 2% Lido", 10, 24.9),
      ("SKU-1006", "Surgical Masks - Level 3", 10, 9.6)]),
    ("PO-1185", "Patterson Dental", 708.6, -7, 0, "pending",
     [("SKU-1001", "Composite Resin A2", 12, 42.5),
      ("SKU-1008", "Polyvinyl Siloxane Impression", 6, 33.1)]),
    ("PO-1188", "Burkhart Dental", 127.8, -6, +2, "pending",
     [("SKU-1011", "Alginate Refill", 6, 21.3)]),
]


def seed_inventory(conn: sqlite3.Connection) -> None:
    conn.executemany("INSERT OR IGNORE INTO storage_locations VALUES (?,?,?,?,?)", LOCATIONS)
    conn.executemany(
        "INSERT OR IGNORE INTO inventory_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        ITEMS,
    )
    tx_rows = [(t[0], t[1], t[2], t[3], iso(t[4]), t[5], t[6]) for t in TXNS]
    conn.executemany("INSERT OR IGNORE INTO inventory_transactions VALUES (?,?,?,?,?,?,?)", tx_rows)

    for oid, supplier, total, placed, arrival, status, lines in ORDERS:
        conn.execute(
            "INSERT OR IGNORE INTO supplier_orders VALUES (?,?,?,?,?,?)",
            (oid, supplier, total, iso(placed), iso(arrival), status),
        )
        for lidx, line in enumerate(lines):
            conn.execute(
                "INSERT OR IGNORE INTO supplier_order_lines VALUES (?,?,?,?,?,?)",
                (f"{oid}-{lidx + 1}", oid, line[0], line[1], line[2], line[3]),
            )