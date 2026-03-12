"""Patrol cleared state: SQLite with WAL, key runId_ts.

Cleared state is permanent; re-queue only when ruleset_version or
model_version changes. On DB init run PRAGMA journal_mode=WAL for
concurrent readers/writers.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def open_patrol_state_db(path: Path) -> sqlite3.Connection:
    """Open or create patrol_state.db and enable WAL mode."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS cleared (
            run_id_ts TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            reviewed_at TEXT NOT NULL,
            ruleset_version TEXT NOT NULL,
            model_version TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def is_cleared(
    conn: sqlite3.Connection,
    run_id_ts: str,
    ruleset_version: str,
    model_version: str,
) -> bool:
    """True if this turn was cleared with the same ruleset and model version."""
    row = conn.execute(
        """
        SELECT 1 FROM cleared
        WHERE run_id_ts = ? AND ruleset_version = ? AND model_version = ?
        """,
        (run_id_ts, ruleset_version, model_version),
    ).fetchone()
    return row is not None


def mark_cleared(
    conn: sqlite3.Connection,
    run_id_ts: str,
    status: str,
    ruleset_version: str,
    model_version: str,
) -> None:
    """Record a turn as cleared (CLEAN or flag severity)."""
    reviewed_at = _utc_now()
    conn.execute(
        """
        INSERT OR REPLACE INTO cleared (run_id_ts, status, reviewed_at, ruleset_version, model_version)
        VALUES (?, ?, ?, ?, ?)
        """,
        (run_id_ts, status, reviewed_at, ruleset_version, model_version),
    )
    conn.commit()


def filter_pending_turns(
    turns: list[dict[str, Any]],
    conn: sqlite3.Connection,
    ruleset_version: str,
    model_version: str,
) -> list[dict[str, Any]]:
    """Return only turns that are not cleared or were cleared with a different version. run_id_ts must match log_reader normalise_turn (run_id + '_' + ts) so cleared entries are found."""
    pending = []
    for t in turns:
        run_id_ts = t.get("runId_ts") or f"{t.get('run_id', '')}_{t.get('ts', 0)}"
        if not is_cleared(conn, run_id_ts, ruleset_version, model_version):
            pending.append(t)
    return pending
