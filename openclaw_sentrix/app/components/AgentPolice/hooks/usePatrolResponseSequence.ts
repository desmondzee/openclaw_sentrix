"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { controlRoom, patrolWaypoints } from "../config/roomLayout";
import type { PatrolNotification as Notification } from "./usePatrolFlagNotifications";

const AT_SCENE_TIMEOUT_MS = 10_000; // 10 seconds for swarm effect
const REPORT_DURATION_MS = 3_000;

const OFFSETS = {
  patrol: { dx: -80, dy: 0 },
  investigator: { dx: 80, dy: 0 },
};

const investigatorHome = controlRoom.investigatorPositions[0];
const patrolReturnPos = patrolWaypoints[0];

export type ResponsePhase =
  | "idle"
  | "patrol_moving"
  | "summoning"
  | "at_scene"
  | "returning"
  | "reporting";

export interface PatrolResponseState {
  phase: ResponsePhase;
  respondingPatrolId: "p1" | "p2" | null;
  patrolTargetPos: { x: number; y: number } | null;
  investigatorTargetPos: { x: number; y: number } | null;
  networkTargetPos: { x: number; y: number } | null;
  networkRoamZone: { x: number; y: number; width: number; height: number } | null;
  onPatrolArrived: () => void;
  onPatrolReturnArrived: () => void;
  onInvestigatorArrived: () => void;
  onInvestigatorReturnArrived: () => void;
  onNetworkArrived: () => void;
  onNetworkReturnArrived: () => void;
  /** Agent ID that is currently flagged for violation (turns red) */
  flaggedAgentId: string | null;
}

export type GetAgentPosition = (
  agentId: string
) => { x: number; y: number } | null;

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function pickClosestPatrol(agentPos: { x: number; y: number }): "p1" | "p2" {
  const p1Pos = patrolWaypoints[0];
  const p2Pos = patrolWaypoints[Math.floor(patrolWaypoints.length / 2)];
  return dist(p1Pos, agentPos) <= dist(p2Pos, agentPos) ? "p1" : "p2";
}

export function usePatrolResponseSequence(
  notification: Notification | null,
  dismiss: () => void,
  getAgentPosition: GetAgentPosition,
  agents: Array<{ id: string }>
) {
  const [phase, setPhase] = useState<ResponsePhase>("idle");
  const [respondingPatrolId, setRespondingPatrolId] = useState<"p1" | "p2" | null>(
    null
  );
  const [flaggedAgentId, setFlaggedAgentId] = useState<string | null>(null);
  const [patrolTargetPos, setPatrolTargetPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [investigatorTargetPos, setInvestigatorTargetPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const atSceneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnArrivedRef = useRef({ patrol: false, investigator: false });

  const clearTimers = useCallback(() => {
    if (atSceneTimerRef.current) {
      clearTimeout(atSceneTimerRef.current);
      atSceneTimerRef.current = null;
    }
    if (reportTimerRef.current) {
      clearTimeout(reportTimerRef.current);
      reportTimerRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setRespondingPatrolId(null);
    setFlaggedAgentId(null);
    setPatrolTargetPos(null);
    setInvestigatorTargetPos(null);
    returnArrivedRef.current = { patrol: false, investigator: false };
  }, [clearTimers]);

  const startReturning = useCallback(() => {
    clearTimers();
    returnArrivedRef.current = { patrol: false, investigator: false };
    setPhase("returning");
    setPatrolTargetPos(patrolReturnPos);
    setInvestigatorTargetPos(investigatorHome ? { x: investigatorHome.x, y: investigatorHome.y } : null);
  }, [clearTimers]);

  useEffect(() => {
    if (!notification) return;
    const agentId = notification.agentId;
    const agentPos = getAgentPosition(agentId);
    if (!agentPos) {
      dismiss();
      return;
    }
    const patrolId = pickClosestPatrol(agentPos);
    setRespondingPatrolId(patrolId);
    setFlaggedAgentId(agentId);
    setPatrolTargetPos({
      x: agentPos.x + OFFSETS.patrol.dx,
      y: agentPos.y + OFFSETS.patrol.dy,
    });
    setInvestigatorTargetPos(null);
    setPhase("patrol_moving");
    dismiss();
  }, [notification, dismiss, getAgentPosition]);

  const onPatrolArrived = useCallback(() => {
    if (phase !== "patrol_moving") return;
    const agentId = flaggedAgentId;
    const agentPos = agentId ? getAgentPosition(agentId) : null;
    if (!agentPos) {
      resetToIdle();
      return;
    }
    setInvestigatorTargetPos({
      x: agentPos.x + OFFSETS.investigator.dx,
      y: agentPos.y + OFFSETS.investigator.dy,
    });
    setPhase("summoning");
  }, [phase, flaggedAgentId, getAgentPosition, resetToIdle]);

  const onInvestigatorArrived = useCallback(() => {
    if (phase !== "summoning") return;
    setPhase("at_scene");
    atSceneTimerRef.current = setTimeout(() => {
      startReturning();
    }, AT_SCENE_TIMEOUT_MS);
  }, [phase, startReturning]);

  const onPatrolReturnArrived = useCallback(() => {
    if (phase !== "returning") return;
    returnArrivedRef.current.patrol = true;
    if (returnArrivedRef.current.investigator) transitionToReporting();
  }, [phase]);

  const onInvestigatorReturnArrived = useCallback(() => {
    if (phase !== "returning") return;
    returnArrivedRef.current.investigator = true;
    if (returnArrivedRef.current.patrol) transitionToReporting();
  }, [phase]);

  function transitionToReporting() {
    returnArrivedRef.current = { patrol: false, investigator: false };
    setPhase("reporting");
    reportTimerRef.current = setTimeout(() => {
      resetToIdle();
    }, REPORT_DURATION_MS);
  }

  useEffect(() => () => clearTimers(), [clearTimers]);

  const response: PatrolResponseState | null =
    phase === "idle"
      ? null
      : {
          phase,
          respondingPatrolId,
          patrolTargetPos,
          investigatorTargetPos,
          networkTargetPos: null,
          networkRoamZone: null,
          onPatrolArrived,
          onPatrolReturnArrived,
          onInvestigatorArrived,
          onInvestigatorReturnArrived,
          onNetworkArrived: () => {},
          onNetworkReturnArrived: () => {},
          flaggedAgentId,
        };

  return { responseState: response, resetToIdle };
}
