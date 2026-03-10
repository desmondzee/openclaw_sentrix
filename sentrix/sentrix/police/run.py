"""Run one investigation from a patrol flag."""

from __future__ import annotations

from pathlib import Path

from sentrix.police.graph import build_police_graph


async def run_investigation(patrol_flag: dict, log_dir: Path) -> tuple[dict | None, str | None]:
    """
    Run the police graph for one patrol flag: setup -> investigator -> end.
    Returns (case_file_dict, investigation_id) on success, or (None, None) on error.
    """
    graph = build_police_graph()
    initial = {
        "investigation_id": "",
        "flag_id": patrol_flag.get("flag_id", ""),
        "source_file": patrol_flag.get("target_agent_id") or patrol_flag.get("source_file") or "",
        "patrol_flag": patrol_flag,
        "log_dir": Path(log_dir),
        "case_file": None,
        "status": "open",
        "error": None,
    }
    final = await graph.ainvoke(initial)
    if final.get("status") != "concluded":
        return None, None
    return final.get("case_file"), final.get("investigation_id")
