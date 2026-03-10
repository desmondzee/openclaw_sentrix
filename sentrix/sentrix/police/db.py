"""Police DB: SQLite with WAL for case_files table."""

from __future__ import annotations

import sqlite3
from pathlib import Path


def open_police_db(db_path: Path) -> sqlite3.Connection:
    """Open or create police DB with WAL mode."""
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS case_files (
            investigation_id TEXT PRIMARY KEY,
            flag_id TEXT NOT NULL,
            source_file TEXT NOT NULL,
            concluded_at TEXT NOT NULL,
            case_file_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS investigated_flags (
            flag_id TEXT PRIMARY KEY,
            investigated_at TEXT NOT NULL,
            investigation_id TEXT NOT NULL
        );
    """)
    conn.commit()
    return conn


def is_investigated(conn: sqlite3.Connection, flag_id: str) -> bool:
    """Return True if this flag_id already has a report (marked complete)."""
    cur = conn.execute("SELECT 1 FROM investigated_flags WHERE flag_id = ?", (flag_id,))
    return cur.fetchone() is not None


def mark_investigated(
    conn: sqlite3.Connection,
    flag_id: str,
    investigation_id: str,
    investigated_at: str | None = None,
) -> None:
    """Mark a flag as investigated (report written)."""
    from datetime import datetime, timezone
    at = investigated_at or (datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    conn.execute(
        """INSERT OR REPLACE INTO investigated_flags (flag_id, investigated_at, investigation_id)
           VALUES (?, ?, ?)""",
        (flag_id, at, investigation_id),
    )
    conn.commit()


def insert_case_file(conn: sqlite3.Connection, row: dict) -> None:
    """Insert one case file row."""
    conn.execute(
        """INSERT INTO case_files (investigation_id, flag_id, source_file, concluded_at, case_file_json)
           VALUES (:investigation_id, :flag_id, :source_file, :concluded_at, :case_file_json)""",
        row,
    )
    conn.commit()


def list_case_files(
    conn: sqlite3.Connection,
    limit: int = 50,
) -> list[dict]:
    """List recent case files, most recent first."""
    cur = conn.execute(
        """SELECT investigation_id, flag_id, source_file, concluded_at, case_file_json
           FROM case_files ORDER BY concluded_at DESC LIMIT ?""",
        (limit,),
    )
    rows = cur.fetchall()
    return [
        {
            "investigation_id": r[0],
            "flag_id": r[1],
            "source_file": r[2],
            "concluded_at": r[3],
            "case_file_json": r[4],
        }
        for r in rows
    ]
