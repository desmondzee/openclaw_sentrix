'use client';

import { useMemo, useCallback } from 'react';
import type { AgentStatus, PatrolSelection, Agent } from '../../../../types';
import { rooms, controlRoom, getQuarantineCellPosition, getEntertainmentSeatPosition } from '../config/roomLayout';
import { AgentSprite } from '../entities/AgentSprite';
import { PatrolSprite } from '../entities/PatrolSprite';
import { SuperintendentSprite } from '../entities/SuperintendentSprite';
import { InvestigatorSprite } from '../entities/InvestigatorSprite';
import { NetworkSprite } from '../entities/NetworkSprite';

export interface PatrolResponseProps {
  respondingPatrolId: 'p1' | 'p2' | null;
  patrolTargetPos: { x: number; y: number } | null;
  onPatrolArrived: () => void;
  onPatrolReturnArrived: () => void;
  investigatorTargetPos: { x: number; y: number } | null;
  onInvestigatorArrived: () => void;
  onInvestigatorReturnArrived: () => void;
  networkTargetPos: { x: number; y: number } | null;
  networkRoamZone: { x: number; y: number; width: number; height: number } | null;
  onNetworkArrived: () => void;
  onNetworkReturnArrived: () => void;
  phase: string;
}

interface EntityLayerProps {
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  getAgentStatus: (agentId: string) => AgentStatus;
  historicalAgentStates?: Record<string, AgentStatus>;
  isLive?: boolean;
  patrolSelection: PatrolSelection | null;
  onPatrolSelect: (selection: PatrolSelection | null) => void;
  agents: Agent[];
  response?: PatrolResponseProps;
}

/** Role order for consistent desk assignment when using live API (agents don't match mock IDs) */
const ROLE_ORDER: Record<string, number> = {
  EMAIL_AGENT: 0,
  CODING_AGENT: 1,
  DOCUMENT_AGENT: 2,
  DATA_QUERY_AGENT: 3,
};

export function EntityLayer({
  selectedAgentId,
  onSelectAgent,
  getAgentStatus,
  historicalAgentStates,
  isLive,
  patrolSelection,
  onPatrolSelect,
  agents,
  response,
}: EntityLayerProps) {
  const getEffectiveStatus = useCallback(
    (agentId: string): AgentStatus => {
      if (!isLive && historicalAgentStates?.[agentId]) {
        return historicalAgentStates[agentId];
      }
      return getAgentStatus(agentId);
    },
    [isLive, historicalAgentStates, getAgentStatus],
  );

  // Agent-to-desk assignment: supports both mock IDs (exact match) and live API (by cluster + slot)
  const agentToDesk = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const room of rooms) {
      const clusterAgents = agents
        .filter((a) => (a as Agent & { clusterId?: string }).clusterId === room.id)
        .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
      for (let i = 0; i < room.desks.length; i++) {
        const desk = room.desks[i];
        const agent =
          agents.find((a) => a.id === desk.agentId) ?? clusterAgents[i];
        if (agent) map.set(agent.id, { x: desk.x, y: desk.y });
      }
    }
    return map;
  }, [agents]);

  // Build agent sprites from room layout, routing suspended agents to quarantine
  const agentSprites = useMemo(() => {
    const sprites: React.JSX.Element[] = [];
    let quarantineSlot = 0;
    let entertainmentSlot = 0;

    for (const room of rooms) {
      const clusterAgents = agents
        .filter((a) => (a as Agent & { clusterId?: string }).clusterId === room.id)
        .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
      for (let i = 0; i < room.desks.length; i++) {
        const desk = room.desks[i];
        const agent =
          agents.find((a) => a.id === desk.agentId) ?? clusterAgents[i];
        if (!agent) continue;

        const status = getEffectiveStatus(agent.id);
        let targetX = desk.x;
        let targetY = desk.y;

        if (status === 'suspended') {
          const cellPos = getQuarantineCellPosition(quarantineSlot);
          targetX = cellPos.x;
          targetY = cellPos.y;
          quarantineSlot++;
        } else if (status === 'idle') {
          const seatPos = getEntertainmentSeatPosition(entertainmentSlot);
          targetX = seatPos.x;
          targetY = seatPos.y;
          entertainmentSlot++;
        }

        sprites.push(
          <AgentSprite
            key={agent.id}
            agentId={agent.id}
            name={agent.name}
            role={agent.role}
            status={status}
            riskScore={agent.riskScore}
            record={agent.record}
            x={targetX}
            y={targetY}
            isSelected={selectedAgentId === agent.id}
            onSelect={onSelectAgent}
          />,
        );
      }
    }
    return sprites;
  }, [selectedAgentId, onSelectAgent, getEffectiveStatus, agents]);

  // Patrol targets come only from response sequence (notification or triggerManual) (notification or triggerManual)
  const isResponseActive = response && response.respondingPatrolId !== null && response.phase !== 'idle';

  const p1TargetPos = isResponseActive && response.respondingPatrolId === 'p1' ? response.patrolTargetPos : null;
  const p2TargetPos = isResponseActive && response.respondingPatrolId === 'p2' ? response.patrolTargetPos : null;

  const p1ArrivedCb = isResponseActive && response.respondingPatrolId === 'p1'
    ? (response.phase === 'returning' ? response.onPatrolReturnArrived : response.onPatrolArrived)
    : () => {};
  const p2ArrivedCb = isResponseActive && response.respondingPatrolId === 'p2'
    ? (response.phase === 'returning' ? response.onPatrolReturnArrived : response.onPatrolArrived)
    : () => {};

  return (
    <pixiContainer>
      {/* Agent sprites */}
      {agentSprites}

      {/* Patrol sprites (clickable to select agent for investigation) */}
      <PatrolSprite
        patrolId="p1"
        label="Patrol-1"
        targetAgentPos={p1TargetPos}
        onSelect={onPatrolSelect}
        onSelectAgent={onSelectAgent}
        onArrived={p1ArrivedCb}
      />
      <PatrolSprite
        patrolId="p2"
        label="Patrol-2"
        targetAgentPos={p2TargetPos}
        onSelect={onPatrolSelect}
        onSelectAgent={onSelectAgent}
        onArrived={p2ArrivedCb}
      />

      {/* Superintendent */}
      <SuperintendentSprite onSelect={onSelectAgent} />

      {/* Network — driven by response sequence when active */}
      <NetworkSprite
        x={controlRoom.networkPos.x}
        y={controlRoom.networkPos.y}
        targetPos={isResponseActive ? response.networkTargetPos : null}
        roamZone={isResponseActive && response.phase !== 'returning' ? response.networkRoamZone : null}
        onArrived={isResponseActive
          ? (response.phase === 'returning' ? response.onNetworkReturnArrived : response.onNetworkArrived)
          : undefined}
        onSelect={onSelectAgent}
      />

      {/* Investigators — f1 driven by response sequence, f2 always roams */}
      <InvestigatorSprite
        investigatorId="f1"
        label="Investigator-1"
        targetPos={isResponseActive ? response.investigatorTargetPos : null}
        onArrived={isResponseActive
          ? (response.phase === 'returning' ? response.onInvestigatorReturnArrived : response.onInvestigatorArrived)
          : undefined}
        onSelect={onSelectAgent}
      />
      <InvestigatorSprite
        investigatorId="f2"
        label="Investigator-2"
        onSelect={onSelectAgent}
      />
    </pixiContainer>
  );
}
