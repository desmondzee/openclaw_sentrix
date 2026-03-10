"""
LangGraph: setup -> investigator -> end.
Single LeadInvestigator node produces CaseFile and persists to police DB + reports/ + console.
"""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from sentrix.patrol.log_reader import (
    load_turns_for_source_files,
    load_turns_from_log_dir,
    sorted_log_filenames,
)
from sentrix.police.agents.investigator import LeadInvestigator
from sentrix.police.config import police_db_path, reports_dir
from sentrix.police.db import insert_case_file, open_police_db
from sentrix.police.models import CaseFile, case_file_row

logger = logging.getLogger(__name__)


class PoliceState(TypedDict):
    investigation_id: str
    flag_id: str
    source_file: str
    patrol_flag: dict
    log_dir: Path
    case_file: dict | None
    status: str
    error: str | None


def _source_file_from_flag(patrol_flag: dict) -> str:
    """Log stream id from patrol flag (target_agent_id or source_file)."""
    return patrol_flag.get("source_file") or patrol_flag.get("target_agent_id") or "unknown"


def _initial_file_set(sorted_names: list[str], flagged: str) -> list[str]:
    """Return [prev, flagged, next] if exist; else [flagged] or all."""
    if not sorted_names:
        return [flagged] if flagged != "unknown" else []
    try:
        idx = sorted_names.index(flagged)
    except ValueError:
        return [flagged] if flagged != "unknown" else sorted_names[:1]
    start = max(0, idx - 1)
    end = min(len(sorted_names), idx + 2)
    return sorted_names[start:end]


def _expand_file_set(
    sorted_names: list[str],
    current_files: list[str],
    direction: str,
    n: int,
) -> list[str]:
    """Add n files back (earlier) or forward (later); return new ordered list."""
    if not sorted_names or n <= 0:
        return list(current_files)
    current_set = set(current_files)
    if direction == "back":
        first_idx = sorted_names.index(current_files[0]) if current_files else 0
        for i in range(first_idx - 1, max(-1, first_idx - 1 - n), -1):
            current_set.add(sorted_names[i])
        return [s for s in sorted_names if s in current_set]
    if direction == "forward":
        last_idx = sorted_names.index(current_files[-1]) if current_files else len(sorted_names) - 1
        for i in range(last_idx + 1, min(len(sorted_names), last_idx + 1 + n)):
            current_set.add(sorted_names[i])
        return [s for s in sorted_names if s in current_set]
    return list(current_files)


def setup_node(state: PoliceState) -> dict[str, Any]:
    """Create investigation id and set state for investigator."""
    investigation_id = str(uuid.uuid4())
    patrol_flag = state["patrol_flag"]
    return {
        "investigation_id": investigation_id,
        "flag_id": patrol_flag.get("flag_id", ""),
        "source_file": _source_file_from_flag(patrol_flag),
        "status": "in_progress",
    }


MAX_EXPANSION_ROUNDS = 3


async def investigator_node(state: PoliceState) -> dict[str, Any]:
    """
    Load turns for flagged stream + adjacent files (prev/next). Run LeadInvestigator;
    if it returns request_more_context, expand file set and re-call up to MAX_EXPANSION_ROUNDS.
    Then persist to DB + reports/ + console.
    """
    log_dir = state["log_dir"]
    patrol_flag = state["patrol_flag"]
    source_file = state["source_file"]
    investigation_id = state["investigation_id"]
    flag_id = state["flag_id"]

    sorted_names = sorted_log_filenames(log_dir)
    current_files = _initial_file_set(sorted_names, source_file)
    if not current_files:
        all_turns = load_turns_from_log_dir(log_dir)
        turns = [t for t in all_turns if (t.get("source_file") or "").strip() == source_file]
        if not turns:
            turns = all_turns
    else:
        turns = load_turns_for_source_files(log_dir, current_files)
    if not turns:
        turns = load_turns_from_log_dir(log_dir)

    case_file: CaseFile | None = None
    context_note: str | None = None
    try:
        agent = LeadInvestigator()
        for round_num in range(MAX_EXPANSION_ROUNDS + 1):
            case_file, request_more = await agent.investigate(
                patrol_flag, turns, context_note=context_note
            )
            if request_more is None:
                break
            if round_num >= MAX_EXPANSION_ROUNDS:
                break
            direction = request_more.get("direction", "back")
            n = min(10, max(1, int(request_more.get("n", 1))))
            current_files = _expand_file_set(sorted_names, current_files, direction, n)
            turns = load_turns_for_source_files(log_dir, current_files)
            context_note = f"[Additional context: you requested {n} file(s) {direction}. Here are the expanded log turns.]"
        if case_file is None and round_num > 0:
            # Last round may have returned request_more only; try one more time without requesting
            case_file, _ = await agent.investigate(patrol_flag, turns, context_note=None)
    except Exception as exc:
        logger.exception("LeadInvestigator failed: %s", exc)
        return {"case_file": None, "status": "error", "error": str(exc)}

    if case_file is None:
        return {"case_file": None, "status": "error", "error": "LLM returned no valid CaseFile"}

    cf_dict = case_file.model_dump(mode="json")
    row = case_file_row(investigation_id, flag_id, source_file, case_file)

    # Persist to police DB
    db_path = police_db_path(log_dir)
    conn = open_police_db(db_path)
    insert_case_file(conn, row)
    conn.close()

    # Write report JSON to agent_logs/reports/
    reports_path = reports_dir(log_dir)
    reports_path.mkdir(parents=True, exist_ok=True)
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y%m%dT%H%M%SZ")
    concluded_at = now.isoformat().replace("+00:00", "Z")
    report_path = reports_path / f"case_{investigation_id}_{ts}.json"
    report_body = {
        **cf_dict,
        "investigation_id": investigation_id,
        "flag_id": flag_id,
        "source_file": source_file,
        "concluded_at": concluded_at,
    }
    report_path.write_text(
        json.dumps(report_body, indent=2, default=str),
        encoding="utf-8",
    )

    # Print to console
    print(
        f"[police] Case file saved: {report_path.name} "
        f"(crime={case_file.crime_classification}, severity={case_file.severity_score})"
    )

    return {"case_file": cf_dict, "status": "concluded", "error": None}


def build_police_graph():
    """Build graph: setup -> investigator -> end."""
    graph = StateGraph(PoliceState)
    graph.add_node("setup", setup_node)
    graph.add_node("investigator", investigator_node)
    graph.set_entry_point("setup")
    graph.add_edge("setup", "investigator")
    graph.add_edge("investigator", END)
    return graph.compile()
