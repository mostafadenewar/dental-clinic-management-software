"""Database backup endpoints: list, create, restore, delete.

Backups live alongside the database in a ``backups`` directory. Creating uses
the SQLite online backup API so WAL data is included; restoring swaps the file
back and clears stale WAL/SHM sidecars.
"""

from __future__ import annotations

import datetime
import os
import shutil
import sqlite3

from db import DB_PATH

BACKUP_EXT = ".db"


def backup_dir() -> str:
    directory = os.path.join(os.path.dirname(DB_PATH), "backups")
    os.makedirs(directory, exist_ok=True)
    return directory


def _validate_name(name: str) -> str:
    if not name or os.sep in name or "/" in name or "\\" in name or ".." in name:
        raise ValueError("invalid backup name")
    if not name.endswith(BACKUP_EXT):
        raise ValueError("backup name must end with .db")
    return name


def _path_for(name: str) -> str:
    name = _validate_name(name)
    return os.path.join(backup_dir(), name)


def _entry(path: str) -> dict:
    stat = os.stat(path)
    return {
        "name": os.path.basename(path),
        "size": stat.st_size,
        "createdAt": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
    }


def list_backups(conn: sqlite3.Connection) -> dict:
    files = [
        f for f in os.listdir(backup_dir())
        if f.endswith(BACKUP_EXT) and os.path.isfile(os.path.join(backup_dir(), f))
    ]
    files.sort(reverse=True)
    entries = [_entry(os.path.join(backup_dir(), f)) for f in files]
    return {"dir": backup_dir(), "backups": entries}


def create_backup(conn: sqlite3.Connection) -> dict:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    name = f"dental_clinic_{timestamp}{BACKUP_EXT}"
    path = os.path.join(backup_dir(), name)
    dest = sqlite3.connect(path)
    try:
        conn.backup(dest)
    finally:
        dest.close()
    return _entry(path)


def restore_backup(conn: sqlite3.Connection, name: str) -> dict:
    """Replace the live database with a saved backup file.

    ``conn`` is flushed and closed before the file is swapped so Windows does
    not hold a lock on the database path. Callers must not reuse the
    connection afterwards.
    """
    path = _path_for(name)
    if not os.path.isfile(path):
        raise ValueError("backup not found")
    check = sqlite3.connect(path)
    try:
        check.execute("PRAGMA integrity_check").fetchall()
    finally:
        check.close()

    conn.execute("PRAGMA wal_checkpoint(FULL)")
    conn.commit()
    tmp = DB_PATH + ".restore.tmp"
    shutil.copyfile(path, tmp)
    conn.close()

    try:
        os.replace(tmp, DB_PATH)
    finally:
        for suffix in ("-wal", "-shm"):
            sidecar = DB_PATH + suffix
            try:
                if os.path.exists(sidecar):
                    os.remove(sidecar)
            except OSError:
                pass

    db = sqlite3.connect(DB_PATH)
    try:
        db.execute("PRAGMA journal_mode = WAL")
    finally:
        db.close()
    return {"ok": True, "name": name}


def delete_backup(conn: sqlite3.Connection, name: str) -> dict:
    path = _path_for(name)
    if not os.path.isfile(path):
        raise ValueError("backup not found")
    os.remove(path)
    return {"ok": True, "name": name}