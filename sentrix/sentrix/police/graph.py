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

from sentrix.patrol.log_reader import load_turns_from_log_dir
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


async def investigator_node(state: PoliceState) -> dict[str, Any]:
    """
    Load turns for the flagged stream, run LeadInvestigator, persist to DB + reports/ + console.
    """
    log_dir = state["log_dir"]
    patrol_flag = state["patrol_flag"]
    source_file = state["source_file"]
    investigation_id = state["investigation_id"]
    flag_id = state["flag_id"]

    # Load all turns and filter by source_file (log stream)
    all_turns = load_turns_from_log_dir(log_dir)
    turns = [t for t in all_turns if (t.get("source_file") or "").strip() == source_file]
    if not turns:
        turns = all_turns  # fallback: send all if no match (e.g. single stream)

    try:
        agent = LeadInvestigator()
        case_file: CaseFile | None = await agent.investigate(patrol_flag, turns)
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
    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    report_path = reports_path / f"case_{investigation_id}_{ts}.json"
    report_path.write_text(
        json.dumps({**cf_dict, "investigation_id": investigation_id, "flag_id": flag_id, "source_file": source_file}, indent=2, default=str),
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
