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
}

export function EntityLayer({
  selectedAgentId,
  onSelectAgent,
  getAgentStatus,
  patrolSelection,
  onPatrolSelect,
  agents,
  response,
}: EntityLayerProps) {
  const agentSprites = useMemo(() => {
    const sprites: React.ReactNode[] = [];
    const room = rooms[0];
    if (!room) return sprites;
    for (let i = 0; i < agents.length && i < room.desks.length; i++) {
      const agent = agents[i];
      const desk = room.desks[i];
      const status = (getAgentStatus(agent.id) || "working") as AgentStatus;
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
        />
      );
    }
    return sprites;
  }, [selectedAgentId, onSelectAgent, getAgentStatus, agents]);

  const isResponseActive =
    response &&
    response.respondingPatrolId !== null &&
    response.phase !== "idle";

  const p1TargetPos =
    isResponseActive && response.respondingPatrolId === "p1"
      ? response.patrolTargetPos
      : null;
  const p1ArrivedCb =
    isResponseActive && response.respondingPatrolId === "p1"
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
