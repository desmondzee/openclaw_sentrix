"""
LangGraph for the patrol swarm: assign -> patrol nodes (parallel) -> adjudicate.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from langgraph.graph import StateGraph

from sentrix.patrol.agents.log_patrol import LogPatrolAgent
from sentrix.patrol.blackboard import BlackboardState
from sentrix.patrol.models import PatrolFlag, SweepResult, ViolationVote
from sentrix.patrol.orchestrator import adjudicate, compute_assignments, deposit_pheromone

logger = logging.getLogger(__name__)


def build_patrol_graph(
    patrol_agent_names: list[str],
    use_orchestrator: bool,
) -> Any:
    """
    Build the LangGraph. N patrol nodes run in parallel; adjudicate runs after
    with merged state. When only one patrol agent, its votes become flags
    directly (no quorum).
    """
    agents = {name: LogPatrolAgent(name=name) for name in patrol_agent_names}
    graph = StateGraph(BlackboardState)

    async def orchestrator_assign(state: BlackboardState) -> dict:
        pending = state.get("pending_actions") or {}
        stream_ids = [k for k in pending.keys() if pending.get(k)]
        if not stream_ids:
            stream_ids = ["main"] if "main" in pending else []
        assignments = compute_assignments(stream_ids, patrol_agent_names)
        cycle = state.get("current_cycle", 0) + 1
        logger.info("Patrol cycle %d: assignments %s", cycle, {k: len(v) for k, v in assignments.items()})
        return {
            "current_cycle": cycle,
            "current_scan_assignments": assignments,
            "patrol_flags": [],
            "sweep_results": [],
        }

    def make_patrol_node(patrol_name: str):
        async def _node(state: BlackboardState) -> dict:
            assignments = state.get("current_scan_assignments") or {}
            my_streams = assignments.get(patrol_name, [])
            pending = state.get("pending_actions") or {}
            agent_registry = state.get("agent_registry") or {}
            pheromone_map = dict(state.get("pheromone_map") or {})

            new_signals: dict = {}
            new_votes: dict = {}
            agent = agents[patrol_name]

            for stream_id in my_streams:
                actions = pending.get(stream_id, [])
                if not actions:
                    continue
                try:
                    signal, vote = await agent.scan(
                        source_file=stream_id,
                        actions=actions,
                        agent_profile=agent_registry.get(stream_id, {}),
                        pheromone_level=pheromone_map.get(stream_id, 0.0),
                    )
                except Exception as exc:
                    logger.exception("Patrol %s failed for stream %s: %s", patrol_name, stream_id, exc)
                    continue
                new_signals.setdefault(stream_id, []).append(signal.model_dump(mode="json"))
                if vote:
                    vote_dict = vote.model_dump(mode="json")
                    run_id_ts = next((a.get("runId_ts") for a in actions if a.get("runId_ts")), stream_id)
                    vote_dict["run_id_ts"] = run_id_ts
                    new_votes.setdefault(stream_id, []).append(vote_dict)
                    pheromone_map = deposit_pheromone(pheromone_map, stream_id)

            return {
                "threat_signals": new_signals,
                "consensus_buffer": new_votes,
                "pheromone_map": pheromone_map,
            }
        return _node

    async def orchestrator_adjudicate(state: BlackboardState) -> dict:
        cycle = state.get("current_cycle", 0)
        t0 = time.perf_counter()
        consensus = state.get("consensus_buffer") or {}
        pheromone = state.get("pheromone_map") or {}
        scan_assignments = state.get("current_scan_assignments") or {}

        if use_orchestrator and len(patrol_agent_names) > 1:
            flags, updated_phero = adjudicate(consensus, pheromone, scan_assignments)
        else:
            flags = []
            for target_id, vote_dicts in consensus.items():
                for vd in vote_dicts:
                    try:
                        vd = dict(vd) if isinstance(vd, dict) else vd.model_dump()
                    except Exception:
                        continue
                    run_id_ts = vd.get("run_id_ts", target_id)
                    try:
                        v = ViolationVote(**vd)
                    except Exception:
                        continue
                    flag = PatrolFlag(
                        source_file=target_id,
                        run_id_ts=str(run_id_ts),
                        consensus_severity=v.severity,
                        consensus_confidence=v.confidence,
                        votes=[v],
                        pii_labels_union=list(v.pii_labels_detected),
                        referral_summary=v.observation,
                        categories=[v.category] if v.category else [],
                    )
                    flags.append(flag)
            updated_phero = pheromone

        duration_ms = (time.perf_counter() - t0) * 1000
        signals_count = sum(len(v) for v in (state.get("threat_signals") or {}).values())
        votes_count = sum(len(v) for v in consensus.values())
        sweep = SweepResult(
            cycle_number=cycle,
            agents_scanned=list(scan_assignments.keys()),
            signals_posted=signals_count,
            votes_posted=votes_count,
            flags_produced=len(flags),
            pheromone_snapshot=updated_phero,
            duration_ms=round(duration_ms, 1),
        )
        return {
            "patrol_flags": [f.model_dump(mode="json") for f in flags],
            "pheromone_map": updated_phero,
            "consensus_buffer": {},
            "sweep_results": [sweep.model_dump(mode="json")],
        }

    graph.add_node("orchestrator_assign", orchestrator_assign)
    for pname in patrol_agent_names:
        graph.add_node(f"patrol_{pname}", make_patrol_node(pname))
    graph.add_node("orchestrator_adjudicate", orchestrator_adjudicate)

    graph.set_entry_point("orchestrator_assign")
    for pname in patrol_agent_names:
        graph.add_edge("orchestrator_assign", f"patrol_{pname}")
    for pname in patrol_agent_names:
        graph.add_edge(f"patrol_{pname}", "orchestrator_adjudicate")

    return graph.compile()
