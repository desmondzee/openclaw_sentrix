"use client";

import { useMemo } from "react";
import type { AgentStatus, PatrolSelection, Agent, PatrolResponseProps } from "../types";
import { rooms, getAgentDeskPosition } from "../config/roomLayout";
import { AgentSprite } from "../entities/AgentSprite";
import { PatrolSprite } from "../entities/PatrolSprite";
import { InvestigatorSprite } from "../entities/InvestigatorSprite";

interface EntityLayerProps {
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  getAgentStatus: (agentId: string) => AgentStatus;
  patrolSelection: PatrolSelection | null;
  onPatrolSelect: (selection: PatrolSelection | null) => void;
  agents: Agent[];
  response?: PatrolResponseProps | null;
  /** Agent ID that is currently flagged for violation (turns red) */
  flaggedAgentId?: string | null;
}

export function EntityLayer({
  selectedAgentId,
  onSelectAgent,
  getAgentStatus,
  patrolSelection,
  onPatrolSelect,
  agents,
  response,
  flaggedAgentId: propFlaggedAgentId,
}: EntityLayerProps) {
  // Use flagged agent from response if available, otherwise from props
  // Agent stays red during both patrol swarm AND investigator phases
  const flaggedAgentId = response?.flaggedAgentId ?? propFlaggedAgentId;
  
  // Sort agents so main agent is first, then subagents
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      // Primary agent always comes first
      if (a.role === "primary") return -1;
      if (b.role === "primary") return 1;
      // Then sort by role (subagents next)
      if (a.role === "subagent" && b.role !== "subagent") return -1;
      if (b.role === "subagent" && a.role !== "subagent") return 1;
      // Finally sort by name for consistent ordering
      return a.name.localeCompare(b.name);
    });
  }, [agents]);

  const agentSprites = useMemo(() => {
    const sprites: React.ReactNode[] = [];
    const room = rooms[0];
    if (!room) return sprites;
    for (let i = 0; i < sortedAgents.length && i < room.desks.length; i++) {
      const agent = sortedAgents[i];
      const desk = room.desks[i];
      const status = (getAgentStatus(agent.id) || "working") as AgentStatus;
      const isFlagged = flaggedAgentId === agent.id;
      sprites.push(
        <AgentSprite
          key={agent.id}
          agentId={agent.id}
          name={agent.name}
          role={agent.role}
          status={status}
          riskScore={agent.riskScore ?? "normal"}
          x={desk.x}
          y={desk.y}
          isSelected={selectedAgentId === agent.id}
          onSelect={onSelectAgent}
          isFlagged={isFlagged}
        />
      );
    }
    return sprites;
  }, [selectedAgentId, onSelectAgent, getAgentStatus, sortedAgents, flaggedAgentId]);

  // Determine which phase we're in
  const phase = response?.phase ?? "idle";
  const isResponseActive = phase !== "idle";
  
  // Patrol targets based on phase:
  // - patrol_swarming: both patrols at agent
  // - patrol_returning: both patrols going home
  // - investigator_*: patrols on normal patrol (no target)
  const isPatrolPhase = phase === "patrol_swarming" || phase === "patrol_returning";
  
  // Patrol 1 target position
  const p1TargetPos = isPatrolPhase && response?.patrolTargetPos
    ? response.patrolTargetPos
    : null;
    
  // Patrol 2 target position (only during swarm phase)
  const p2TargetPos = phase === "patrol_swarming" && response?.patrol2TargetPos
    ? response.patrol2TargetPos
    : phase === "patrol_returning" 
      ? null // p2 just resumes normal patrol
      : null;
  
  // Patrol callbacks - only trigger during patrol phases
  const p1ArrivedCb = isPatrolPhase
    ? (phase === "patrol_returning"
      ? response?.onPatrolReturnArrived
      : response?.onPatrolArrived) ?? (() => {})
    : () => {};
    
  const p2ArrivedCb = isPatrolPhase
    ? (phase === "patrol_returning"
      ? response?.onPatrolReturnArrived
      : response?.onPatrolArrived) ?? (() => {})
    : () => {};

  // Investigator target based on phase:
  // - investigator_moving: going to agent
  // - investigating: at agent
  // - investigator_returning: going home
  const isInvestigatorPhase = phase === "investigator_moving" || phase === "investigating" || phase === "investigator_returning";
  
  const investigatorTargetPos = isInvestigatorPhase
    ? response?.investigatorTargetPos
    : null;
    
  const onInvestigatorArrived = isInvestigatorPhase
    ? (phase === "investigator_returning"
      ? response?.onInvestigatorReturnArrived
      : response?.onInvestigatorArrived) ?? (() => {})
    : () => {};

  return (
    <pixiContainer>
      {agentSprites}

      <PatrolSprite
        patrolId="p1"
        label="Patrol-1"
        targetAgentPos={p1TargetPos}
        onSelect={onPatrolSelect}
        onArrived={p1ArrivedCb}
      />
      <PatrolSprite
        patrolId="p2"
        label="Patrol-2"
        targetAgentPos={p2TargetPos}
        onSelect={onPatrolSelect}
        onArrived={p2ArrivedCb}
      />

      <InvestigatorSprite
        investigatorId="f1"
        label="Investigator-1"
        targetPos={investigatorTargetPos}
        onArrived={onInvestigatorArrived}
        onSelect={onSelectAgent}
      />
    </pixiContainer>
  );
}
