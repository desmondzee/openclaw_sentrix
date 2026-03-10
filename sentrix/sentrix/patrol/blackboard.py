"""
LangGraph blackboard state for the patrol swarm.
"""

from __future__ import annotations

from typing import Annotated, TypedDict


def _merge_dicts(a: dict, b: dict) -> dict:
    result = dict(a)
    for k, v in b.items():
        if k in result and isinstance(result[k], list) and isinstance(v, list):
            result[k] = result[k] + v
        else:
            result[k] = v
    return result


def _merge_pheromone(a: dict, b: dict) -> dict:
    result = dict(a)
    for k, v in b.items():
        result[k] = max(result.get(k, 0.0), float(v))
    return result


def _merge_lists(a: list, b: list) -> list:
    return a + b


class BlackboardState(TypedDict, total=False):
    """State for LangGraph: log patrol swarm."""

    threat_signals: Annotated[dict, _merge_dicts]
    pheromone_map: Annotated[dict, _merge_pheromone]
    consensus_buffer: Annotated[dict, _merge_dicts]
    scan_history: dict
    current_scan_assignments: dict  # patrol_agent_id -> list of source_file or stream id
    current_cycle: int
    patrol_flags: Annotated[list, _merge_lists]
    agent_registry: dict
    pending_actions: dict  # stream_id or "main" -> list of turn dicts
    sweep_results: Annotated[list, _merge_lists]
