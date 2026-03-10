"""
Escalation: when to auto-invoke investigator, and priority queue for flags.

Queue order: HIGH first (chronological within), then MEDIUM, then LOW.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from sentrix.config import ESCALATION_HIGH_ONLY, ESCALATION_LOW_ABOVE, ESCALATION_MEDIUM_ABOVE
from sentrix.police.config import police_db_path
from sentrix.police.db import is_investigated, mark_investigated, open_police_db
from sentrix.police.run import run_investigation

logger = logging.getLogger(__name__)

# Severity rank for queue: lower = higher priority (process first)
_SEVERITY_RANK = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
# Severities that escalate per level
_ESCALATION_MAP = {
    ESCALATION_LOW_ABOVE: ("LOW", "MEDIUM", "HIGH"),
    ESCALATION_MEDIUM_ABOVE: ("MEDIUM", "HIGH"),
    ESCALATION_HIGH_ONLY: ("HIGH",),
}


def severity_meets_escalation(severity_str: str, escalation_level: str | None) -> bool:
    """True if this severity should trigger auto-investigation."""
    if not escalation_level or severity_str == "CLEAN":
        return False
    allowed = _ESCALATION_MAP.get(escalation_level, ())
    return severity_str.upper() in allowed


def _queue_sort_key(item: tuple[dict, str, float]) -> tuple[int, float]:
    """Sort by (severity_rank, enqueued_at)."""
    _flag, severity, enqueued_at = item
    rank = _SEVERITY_RANK.get(severity.upper(), 99)
    return (rank, enqueued_at)


async def run_investigation_consumer(
    log_dir: Path,
    queue: asyncio.Queue[tuple[dict, str, float]],
    escalation_level: str | None = None,
) -> None:
    """
    Background task: consume from queue (priority HIGH > MEDIUM > LOW, chronological within rank),
    run investigation, mark flag complete in police DB. Runs until cancelled.
    """
    db_path = police_db_path(log_dir)
    conn = open_police_db(db_path)
    try:
        while True:
            # Collect all pending items and pick highest priority
            pending: list[tuple[dict, str, float]] = []
            try:
                while True:
                    pending.append(queue.get_nowait())
            except asyncio.QueueEmpty:
                pass
            if not pending:
                await asyncio.sleep(2.0)
                continue
            pending.sort(key=_queue_sort_key)
            flag_dict, severity, _ = pending.pop(0)
            for rest in pending:
                queue.put_nowait(rest)

            flag_id = flag_dict.get("flag_id") or ""
            if is_investigated(conn, flag_id):
                continue
            try:
                case_file, investigation_id = await run_investigation(flag_dict, log_dir)
                if investigation_id:
                    mark_investigated(conn, flag_id, investigation_id)
                    logger.info("[police] flag %s marked complete (investigation %s)", flag_id[:8], investigation_id[:8])
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.exception("Investigation failed for flag %s: %s", flag_id[:8], exc)
    finally:
        conn.close()


def enqueue_flags_for_investigation(
    flags: list[Any],
    escalation_level: str | None,
    log_dir: Path,
    queue: asyncio.Queue[tuple[dict, str, float]],
) -> None:
    """
    For each flag: if not already investigated and severity meets escalation, add to queue.
    """
    if not escalation_level:
        return
    db_path = police_db_path(log_dir)
    conn = open_police_db(db_path)
    try:
        import time
        now = time.monotonic()
        for f in flags:
            flag_id = getattr(f, "flag_id", None) or (f.get("flag_id") if isinstance(f, dict) else None)
            severity = getattr(f, "consensus_severity", None) or (f.get("consensus_severity") if isinstance(f, dict) else None)
            if not flag_id or not severity:
                continue
            if severity == "CLEAN":
                continue
            if not severity_meets_escalation(str(severity), escalation_level):
                continue
            if is_investigated(conn, flag_id):
                continue
            flag_dict = f.to_jsonl_dict() if hasattr(f, "to_jsonl_dict") else f
            if isinstance(flag_dict, dict):
                queue.put_nowait((flag_dict, str(severity), now))
    finally:
        conn.close()
