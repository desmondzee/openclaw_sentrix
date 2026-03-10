"""
Patrol orchestrator: assign log streams to patrol agents when N > 2.
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any

from sentrix.patrol.config import PHEROMONE_DECAY_FACTOR, PHEROMONE_DEPOSIT_AMOUNT, QUORUM_FRACTION
from sentrix.patrol.models import PatrolFlag, Severity, ViolationVote, max_severity

logger = logging.getLogger(__name__)


def compute_assignments(
    stream_ids: list[str],
    patrol_agent_names: list[str],
) -> dict[str, list[str]]:
    """
    Assign each stream to one patrol agent (round-robin). Returns
    patrol_agent_name -> list of stream_ids.
    """
    assignments: dict[str, list[str]] = {p: [] for p in patrol_agent_names}
    for i, sid in enumerate(stream_ids):
        assignments[patrol_agent_names[i % len(patrol_agent_names)]].append(sid)
    return assignments


def adjudicate(
    consensus_buffer: dict[str, list[dict]],
    pheromone_map: dict[str, float],
    scan_assignments: dict[str, list[str]],
) -> tuple[list[PatrolFlag], dict[str, float]]:
    """
    Quorum check: for each target, if ceil(assigned_count * QUORUM_FRACTION) votes
    are non-CLEAN, produce a PatrolFlag. Update pheromone; apply decay.
    """
    flags: list[PatrolFlag] = []
    updated_phero = dict(pheromone_map)

    for target_id, vote_dicts in consensus_buffer.items():
        votes: list[ViolationVote] = []
        for vd in vote_dicts:
            try:
                votes.append(ViolationVote(**vd) if isinstance(vd, dict) else vd)
            except Exception:
                pass
        non_clean = [v for v in votes if v.severity != Severity.CLEAN]
        assigned = scan_assignments.get(target_id, [])
        assigned_count = len(assigned) if assigned else len(votes)
        quorum = max(1, math.ceil(assigned_count * QUORUM_FRACTION))
        if len(non_clean) < quorum:
            continue
        consensus_severity = max_severity([v.severity for v in non_clean])
        consensus_confidence = sum(v.confidence for v in non_clean) / len(non_clean)
        pii_union = sorted(set(lbl for v in non_clean for lbl in v.pii_labels_detected))
        categories = sorted(set(v.category for v in non_clean if v.category))
        referral_summary = " | ".join(v.observation for v in non_clean)
        phero = min(1.0, updated_phero.get(target_id, 0.0) + PHEROMONE_DEPOSIT_AMOUNT)
        updated_phero[target_id] = phero
        run_id_ts = getattr(non_clean[0], "run_id_ts", None) or target_id
        flag = PatrolFlag(
            source_file=target_id,
            run_id_ts=str(run_id_ts),
            consensus_severity=consensus_severity,
            consensus_confidence=round(consensus_confidence, 3),
            votes=non_clean,
            pii_labels_union=pii_union,
            referral_summary=referral_summary,
            pheromone_level=phero,
            categories=categories,
        )
        flags.append(flag)
    updated_phero = {k: round(v * PHEROMONE_DECAY_FACTOR, 4) for k, v in updated_phero.items()}
    return flags, updated_phero


def deposit_pheromone(pheromone_map: dict[str, float], agent_id: str) -> dict[str, float]:
    out = dict(pheromone_map)
    out[agent_id] = min(1.0, out.get(agent_id, 0.0) + PHEROMONE_DEPOSIT_AMOUNT)
    return out
