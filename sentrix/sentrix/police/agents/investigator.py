"""
Unified LeadInvestigator: reads patrol flag + raw log turns, outputs CaseFile.
"""

from __future__ import annotations

import json
from typing import Any

from sentrix.police.agents.base import BasePoliceAgent
from sentrix.police.config import POLICE_FIRST_FRACTION, POLICE_MAX_TURN_CHARS
from sentrix.police.models import CaseFile, case_file_from_llm_dict
from sentrix.police.prompts import LEAD_INVESTIGATOR_SYSTEM


def _truncate_turns_sandwich(turns: list[dict], max_chars: int, first_frac: float) -> str:
    """Serialize turns to a string; if over max_chars, keep first 20% and last 80% of content."""
    raw = json.dumps(turns, ensure_ascii=False, default=str)
    if len(raw) <= max_chars:
        return raw
    first_chars = int(max_chars * first_frac)
    last_chars = max_chars - first_chars
    return (
        raw[:first_chars]
        + "\n\n... [truncated for length] ...\n\n"
        + raw[-last_chars:]
    )


def _build_human_message(patrol_flag: dict, turns: list[dict]) -> str:
    """Build the human message for the LeadInvestigator: flag summary + serialised turns."""
    referral = patrol_flag.get("referral_summary", "")
    severity = patrol_flag.get("consensus_severity", "MEDIUM")
    confidence = patrol_flag.get("consensus_confidence", 0.5)
    categories = patrol_flag.get("categories") or []
    run_id_ts = patrol_flag.get("run_id_ts", "")

    parts = [
        "## Patrol flag",
        f"Referral summary: {referral}",
        f"Consensus severity: {severity}",
        f"Consensus confidence: {confidence}",
        f"Categories: {categories}",
        f"Run/turn ID: {run_id_ts}",
        "",
        "## Agent log turns (normalised)",
        _truncate_turns_sandwich(turns, POLICE_MAX_TURN_CHARS, POLICE_FIRST_FRACTION),
    ]
    return "\n".join(parts)


def _build_human_message_with_context_note(patrol_flag: dict, turns: list[dict], context_note: str | None = None) -> str:
    """Build human message; optional context_note when this is a follow-up with more files."""
    base = _build_human_message(patrol_flag, turns)
    if context_note:
        base = context_note + "\n\n" + base
    return base


class LeadInvestigator(BasePoliceAgent):
    """
    Single agent that consumes a patrol flag and raw log turns and produces the final CaseFile.
    Can request more context via request_more_context in the JSON response.
    """

    async def investigate(
        self,
        patrol_flag: dict,
        turns: list[dict],
        context_note: str | None = None,
    ) -> tuple[CaseFile | None, dict | None]:
        """
        Run investigation: call LLM with flag + turns.
        Returns (CaseFile, request_more_context | None). If request_more_context is not None,
        the caller should expand the file set and call again with more turns.
        """
        human = _build_human_message_with_context_note(patrol_flag, turns, context_note)
        out = await self._call_llm(LEAD_INVESTIGATOR_SYSTEM, human)
        if not out or not isinstance(out, dict):
            return None, None
        request_more = out.pop("request_more_context", None)
        if request_more and isinstance(request_more, dict) and request_more.get("direction") and isinstance(request_more.get("n"), (int, float)):
            n = int(request_more["n"])
            if n > 0 and request_more.get("direction") in ("back", "forward"):
                # Return request_more so caller can expand; do not return a CaseFile until no more request
                return None, {"direction": request_more["direction"], "n": min(n, 10)}
        try:
            cf = case_file_from_llm_dict(out)
        except Exception:
            return None, None
        return cf, None
