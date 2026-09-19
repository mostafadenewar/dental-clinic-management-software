"""Inventory endpoints: items, adjustments, transactions, and purchase orders."""

from __future__ import annotations

import sqlite3

from db import iso, row_dict, rows_dicts, today


def _item(r: dict) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "brand": r["brand"],
        "sku": r["sku"],
        "category": r["category"],
        "packSize": r["pack_size"],
        "unit": r["unit"],
        "quantityOnHand": r["quantity_on_hand"],
        "minimumThreshold": r["minimum_threshold"],
        "reorderQuantity": r["reorder_quantity"],
        "locationId": r["location_id"],
        "costPerUnit": r["cost_per_unit"],
    }


def list_items(conn: sqlite3.Connection, search=None, category=None) -> list[dict]:
    sql = "SELECT * FROM inventory_items"
    conds, params = [], []
    if search:
        conds.append("(name LIKE ? OR brand LIKE ? OR sku LIKE ?)")
        like = f"%{search}%"
        params += [like, like, like]
    if category and category != "all":
        conds.append("category = ?")
        params.append(category)
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY name"
    return [_item(r) for r in rows_dicts(conn.execute(sql, params).fetchall())]


def list_locations(conn: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in conn.execute("SELECT * FROM storage_locations ORDER BY id").fetchall()]


def create_item(conn: sqlite3.Connection, data: dict) -> dict | None:
    from db import next_sequential_id
    iid = data.get("id") or next_sequential_id(conn, "inventory_items", "id", "SKU-")
    conn.execute(
        "INSERT OR REPLACE INTO inventory_items "
        "(id, name, brand, sku, category, pack_size, unit, quantity_on_hand, "
        "minimum_threshold, reorder_quantity, location_id, cost_per_unit) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (iid, data.get("name"), data.get("brand", ""), data.get("sku", ""),
         data.get("category", "Consumables"), data.get("packSize", ""),
         data.get("unit", "each"), float(data.get("quantityOnHand", 0) or 0),
         float(data.get("minimumThreshold", 0) or 0),
         float(data.get("reorderQuantity", 0) or 0),
         data.get("locationId", "LOC-01"),
         float(data.get("costPerUnit", 0) or 0)),
    )
    return get_item(conn, iid)


def get_item(conn: sqlite3.Connection, iid: str) -> dict | None:
    row = conn.execute("SELECT * FROM inventory_items WHERE id = ?", (iid,)).fetchone()
    return _item(row_dict(row)) if row else None


def update_item(conn: sqlite3.Connection, iid: str, data: dict) -> dict | None:
    for key, col in [("name", "name"), ("brand", "brand"), ("sku", "sku"),
                     ("category", "category"), ("packSize", "pack_size"),
                     ("unit", "unit"), ("quantityOnHand", "quantity_on_hand"),
                     ("minimumThreshold", "minimum_threshold"),
                     ("reorderQuantity", "reorder_quantity"),
                     ("locationId", "location_id"),
                     ("costPerUnit", "cost_per_unit")]:
        if key in data:
            conn.execute(f"UPDATE inventory_items SET {col} = ? WHERE id = ?",
                         (data[key], iid))
    return get_item(conn, iid)


def delete_item(conn: sqlite3.Connection, iid: str) -> bool:
    cur = conn.execute("DELETE FROM inventory_items WHERE id = ?", (iid,))
    return cur.rowcount > 0


def adjust_quantity(conn: sqlite3.Connection, iid: str, delta: float,
                    reason: str, performed_by: str) -> dict | None:
    row = conn.execute("SELECT * FROM inventory_items WHERE id = ?", (iid,)).fetchone()
    if row is None:
        return None
    new_qty = max(0.0, float(row["quantity_on_hand"]) + delta)
    conn.execute("UPDATE inventory_items SET quantity_on_hand = ? WHERE id = ?",
                 (new_qty, iid))
    count = conn.execute("SELECT COUNT(*) AS c FROM inventory_transactions").fetchone()["c"]
    conn.execute(
        "INSERT INTO inventory_transactions (id, item_id, type, quantity, date, reason, performed_by) "
        "VALUES (?,?,?,?,?,?,?)",
        (f"TX-{count + 1:04d}", iid, "inbound" if delta > 0 else "outbound",
         abs(delta), iso(0), reason, performed_by),
    )
    conn.execute("INSERT INTO activity_log (kind, message, at) VALUES (?,?,?)",
                 ("stock", f"{row['name']} adjusted by {delta:g} units", iso(0)))
    return get_item(conn, iid)


def list_transactions(conn: sqlite3.Connection, iid: str) -> list[dict]:
    return [{
        "id": r["id"], "itemId": r["item_id"], "type": r["type"],
        "quantity": r["quantity"], "date": r["date"],
        "reason": r["reason"], "performedBy": r["performed_by"],
    } for r in rows_dicts(conn.execute(
        "SELECT * FROM inventory_transactions WHERE item_id = ? ORDER BY date DESC",
        (iid,)).fetchall())]


def list_orders(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM supplier_orders ORDER BY placed_date DESC").fetchall()
    out = []
    for r in rows:
        out.append(_order(conn, r))
    return out


def _order(conn: sqlite3.Connection, r) -> dict:
    oid = r["id"]
    lines = [{
        "id": l["id"], "orderId": oid, "itemId": l["item_id"],
        "itemName": l["item_name"], "quantity": l["quantity"],
        "unitCost": l["unit_cost"],
    } for l in rows_dicts(conn.execute(
        "SELECT * FROM supplier_order_lines WHERE order_id = ?", (oid,)).fetchall())]
    return {
        "id": oid, "supplier": r["supplier"], "lines": lines,
        "totalCost": r["total_cost"], "placedDate": r["placed_date"],
        "estimatedArrival": r["estimated_arrival"], "status": r["status"],
    }


def create_order(conn: sqlite3.Connection, data: dict) -> dict:
    from db import next_sequential_id
    oid = data.get("id") or next_sequential_id(conn, "supplier_orders", "id", "PO-")
    total = 0.0
    for k, ln in enumerate(data.get("lines") or []):
        row = conn.execute("SELECT name, cost_per_unit FROM inventory_items WHERE id = ?",
                           (ln["itemId"],)).fetchone()
        cost = float(row["cost_per_unit"]) if row else float(ln.get("unitCost", 0))
        total += float(ln.get("quantity", 0)) * cost
    conn.execute(
        "INSERT OR REPLACE INTO supplier_orders "
        "(id, supplier, total_cost, placed_date, estimated_arrival, status) VALUES (?,?,?,?,?,?)",
        (oid, data.get("supplier"), round(total, 2), iso(0),
         data.get("estimatedArrival") or "", data.get("status", "pending")),
    )
    for k, ln in enumerate(data.get("lines") or []):
        row = conn.execute("SELECT name, cost_per_unit FROM inventory_items WHERE id = ?",
                           (ln["itemId"],)).fetchone()
        conn.execute(
            "INSERT OR IGNORE INTO supplier_order_lines "
            "(id, order_id, item_id, item_name, quantity, unit_cost) VALUES (?,?,?,?,?,?)",
            (f"{oid}-{k + 1}", oid, ln["itemId"],
             row["name"] if row else ln.get("itemName", ""),
             ln.get("quantity", 0),
             float(row["cost_per_unit"]) if row else float(ln.get("unitCost", 0))),
        )
    conn.execute("INSERT INTO activity_log (kind, message, at) VALUES (?,?,?)",
                 ("stock", f"Purchase order {oid} created", iso(0)))
    return _order(conn, conn.execute("SELECT * FROM supplier_orders WHERE id = ?", (oid,)).fetchone())


def inventory_summary(conn: sqlite3.Connection) -> dict:
    items = [_item(r) for r in rows_dicts(
        conn.execute("SELECT * FROM inventory_items").fetchall())]
    low = [i for i in items if i["quantityOnHand"] <= i["minimumThreshold"]]
    total_value = round(sum(i["quantityOnHand"] * i["costPerUnit"] for i in items), 2)
    orders = conn.execute(
        "SELECT COALESCE(SUM(total_cost),0) AS t, COUNT(*) AS c FROM supplier_orders "
        "WHERE status IN ('pending','processing')").fetchone()
    return {
        "lowItems": low,
        "totalValue": total_value,
        "openOrdersCount": orders["c"],
        "openOrdersTotal": orders["t"],
        "locations": list_locations(conn),
    }