"""
Sweep: load turns from log_reader, filter by cleared state, run graph, emit flags.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Callable

from sentrix.patrol.config import (
    MODEL_VERSION,
    RULESET_VERSION,
    patrol_agent_count,
    patrol_state_db_path,
)
from sentrix.patrol.graph import build_patrol_graph
from sentrix.patrol.log_reader import load_turns_from_log_dir
from sentrix.patrol.models import PatrolFlag
from sentrix.patrol.state import (
    filter_pending_turns,
    mark_cleared,
    open_patrol_state_db,
)

logger = logging.getLogger(__name__)


def _group_turns_by_stream(turns: list[dict]) -> dict[str, list[dict]]:
    """Group turns by source_file (stream). Use 'main' if single stream."""
    by_file: dict[str, list[dict]] = {}
    for t in turns:
        src = t.get("source_file") or "main"
        by_file.setdefault(src, []).append(t)
    return by_file


async def run_sweep_cycle(
    log_dir: Path,
    state_conn: sqlite3.Connection,
    min_ts: int = 0,
) -> tuple[list[PatrolFlag], list[str]]:
    """
    One sweep: load turns, filter pending by cleared state + version, run graph,
    return flags and list of runId_ts that were reviewed (to mark cleared).
    """
    turns = load_turns_from_log_dir(log_dir, min_ts=min_ts)
    pending = filter_pending_turns(turns, state_conn, RULESET_VERSION, MODEL_VERSION)
    if not pending:
        logger.debug(
            "Patrol sweep: no pending turns (loaded %d, all already cleared or none after min_ts)",
            len(turns),
        )
        return [], []

    logger.info(
        "Patrol sweep: loaded %d turns, %d pending (not yet cleared for this ruleset/model)",
        len(turns),
        len(pending),
    )
    by_stream = _group_turns_by_stream(pending)
    stream_ids = list(by_stream.keys())
    n_streams = max(1, len(stream_ids))
    n_patrol = patrol_agent_count(n_streams)
    use_orchestrator = n_patrol > 2
    patrol_names = [f"log_patrol_{i}" for i in range(n_patrol)]
    pending_actions: dict[str, list[dict]] = dict(by_stream)

    graph = build_patrol_graph(patrol_names, use_orchestrator)
    initial: dict[str, Any] = {
        "threat_signals": {},
        "pheromone_map": {},
        "consensus_buffer": {},
        "current_scan_assignments": {},
        "current_cycle": 0,
        "patrol_flags": [],
        "agent_registry": {},
        "pending_actions": pending_actions,
        "sweep_results": [],
    }
    final = await graph.ainvoke(initial)

    flags: list[PatrolFlag] = []
    for fd in final.get("patrol_flags", []):
        try:
            flags.append(PatrolFlag(**fd) if isinstance(fd, dict) else fd)
        except Exception as exc:
            logger.exception("Failed to deserialise PatrolFlag: %s", exc)

    # Mark every pending turn as cleared so we never re-queue it (same ruleset/model).
    reviewed_run_id_ts: list[str] = []
    for t in pending:
        run_id_ts = t.get("runId_ts") or f"{t.get('run_id', '')}_{t.get('ts', '')}"
        reviewed_run_id_ts.append(run_id_ts)
        severity = "CLEAN"
        for f in flags:
            if f.run_id_ts == run_id_ts or run_id_ts in (getattr(v, "run_id_ts", None) for v in f.votes):
                severity = str(f.consensus_severity)
                break
        mark_cleared(state_conn, run_id_ts, severity, RULESET_VERSION, MODEL_VERSION)
    logger.info(
        "Patrol sweep: marked %d turns cleared (ruleset=%s, model=%s)",
        len(reviewed_run_id_ts),
        RULESET_VERSION,
        MODEL_VERSION,
    )

    return flags, reviewed_run_id_ts


async def run_patrol_loop(
    log_dir: Path,
    poll_secs: float = 30.0,
    flags_path: Path | None = None,
    on_flags: Callable[[list[PatrolFlag]], None] | None = None,
    min_ts: int = 0,
) -> None:
    """
    Loop: run sweep when there is pending work; idle otherwise. Write flags to
    console and to patrol_flags.jsonl. on_flags(flags) called when flags produced.
    """
    db_path = patrol_state_db_path(log_dir)
    conn = open_patrol_state_db(db_path)
    flags_path = flags_path or (log_dir / "patrol_flags.jsonl")
    while True:
        try:
            flags, _ = await run_sweep_cycle(log_dir, conn, min_ts=min_ts)
            if flags:
                for f in flags:
                    line = json.dumps(f.to_jsonl_dict(), ensure_ascii=False) + "\n"
                    flags_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(flags_path, "a", encoding="utf-8") as out:
                        out.write(line)
                    print(f"[patrol] FLAG: {f.consensus_severity} {f.run_id_ts} — {f.referral_summary[:200]}...")
                if on_flags:
                    on_flags(flags)
        except Exception as exc:
            logger.exception("Sweep cycle error: %s", exc)
        await asyncio.sleep(poll_secs)
