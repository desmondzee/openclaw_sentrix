"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { PoliceState } from "@/app/claw/page";
import type { Agent, AgentStatus } from "./types";
import { getAgentDeskPosition } from "./config/roomLayout";
import { usePatrolFlagNotifications } from "./hooks/usePatrolFlagNotifications";
import { usePatrolResponseSequence } from "./hooks/usePatrolResponseSequence";

const SpriteWorld = dynamic(() => import("./SpriteWorld"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0e1a]">
      <span className="font-mono text-sm text-gray-500">Loading Sprite View...</span>
    </div>
  ),
});

export interface SpriteViewProps {
  policeState: PoliceState;
}

export function SpriteView({ policeState }: SpriteViewProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [patrolSelection, setPatrolSelection] = useState<{
    patrolId: string;
    patrolLabel: string;
  } | null>(null);

  const { notification, dismiss } = usePatrolFlagNotifications(
    policeState.flags ?? []
  );
  const agents = (policeState.agents ?? []) as Agent[];

  const getAgentPosition = useCallback(
    (agentId: string) => getAgentDeskPosition(agentId, agents),
    [agents]
  );

  // Default to "medium_above" if no escalation level is configured
  const escalationLevel = policeState.escalation_level ?? "medium_above";
  
  const { responseState } = usePatrolResponseSequence(
    notification,
    dismiss,
    getAgentPosition,
    agents,
    escalationLevel
  );

  const getAgentStatus = useCallback(
    (agentId: string): AgentStatus => {
      const a = agents.find((x) => x.id === agentId);
      return (a?.status as AgentStatus) ?? "working";
    },
    [agents]
  );

  const response = useMemo(() => {
    if (!responseState) return null;
    return {
      respondingPatrolId: responseState.respondingPatrolId,
      patrolTargetPos: responseState.patrolTargetPos,
      patrol2TargetPos: responseState.patrol2TargetPos,
      onPatrolArrived: responseState.onPatrolArrived,
      onPatrolReturnArrived: responseState.onPatrolReturnArrived,
      investigatorTargetPos: responseState.investigatorTargetPos,
      onInvestigatorArrived: responseState.onInvestigatorArrived,
      onInvestigatorReturnArrived: responseState.onInvestigatorReturnArrived,
      networkTargetPos: responseState.networkTargetPos,
      networkRoamZone: responseState.networkRoamZone,
      onNetworkArrived: responseState.onNetworkArrived,
      onNetworkReturnArrived: responseState.onNetworkReturnArrived,
      phase: responseState.phase,
      flaggedAgentId: responseState.flaggedAgentId,
    };
  }, [responseState]);

  return (
    <SpriteWorld
      selectedAgentId={selectedAgentId}
      onSelectAgent={setSelectedAgentId}
      getAgentStatus={getAgentStatus}
      patrolSelection={patrolSelection}
      onPatrolSelect={setPatrolSelection}
      agents={agents}
      response={response}
    />
  );
}
