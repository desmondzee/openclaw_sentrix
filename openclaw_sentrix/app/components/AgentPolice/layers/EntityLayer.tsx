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

  const isResponseActive =
    response &&
    response.respondingPatrolId !== null &&
    response.phase !== "idle";

  // Swarm effect: both patrols go to the scene with different offsets
  // p1 goes to left side (-80), p2 goes to right side (+80) of flagged agent
  const p1TargetPos = isResponseActive
    ? { 
        x: (response.patrolTargetPos?.x ?? 0) - 60, 
        y: response.patrolTargetPos?.y ?? 0 
      }
    : null;
  const p2TargetPos = isResponseActive
    ? { 
        x: (response.patrolTargetPos?.x ?? 0) + 140, // opposite side
        y: response.patrolTargetPos?.y ?? 0 
      }
    : null;
  
  const p1ArrivedCb =
    isResponseActive && response.respondingPatrolId === "p1"
      ? response.phase === "returning"
        ? response.onPatrolReturnArrived
        : response.onPatrolArrived
      : () => {};
  const p2ArrivedCb =
    isResponseActive && response.respondingPatrolId === "p2"
      ? response.phase === "returning"
        ? response.onPatrolReturnArrived
        : response.onPatrolArrived
      : () => {};

  const investigatorTargetPos = isResponseActive
    ? response.investigatorTargetPos
    : null;
  const onInvestigatorArrived =
    isResponseActive
      ? response.phase === "returning"
        ? response.onInvestigatorReturnArrived
        : response.onInvestigatorArrived
      : undefined;

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
