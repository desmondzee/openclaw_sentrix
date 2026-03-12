"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { controlRoom, patrolWaypoints } from "../config/roomLayout";
import type { PatrolNotification as Notification } from "./usePatrolFlagNotifications";

const PATROL_SWARM_DURATION_MS = 10_000; // 10 seconds patrol swarm
const INVESTIGATOR_SCENE_DURATION_MS = 8_000; // 8 seconds investigator at scene
const REPORT_DURATION_MS = 2_000;

const OFFSETS = {
  patrol: { dx: -60, dy: 0 },
  patrol2: { dx: 60, dy: 0 },
  investigator: { dx: 80, dy: 0 },
};

const investigatorHome = controlRoom.investigatorPositions[0];
const patrolReturnPos = patrolWaypoints[0];

export type ResponsePhase =
  | "idle"
  | "patrol_swarming"      // Both patrols at agent (10s)
  | "patrol_returning"     // Patrols going back home
  | "investigator_moving"  // Investigator going to agent
  | "investigating"        // Investigator at agent
  | "investigator_returning" // Investigator going home
  | "reporting";

export interface PatrolResponseState {
  phase: ResponsePhase;
  respondingPatrolId: "p1" | "p2" | null;
  patrolTargetPos: { x: number; y: number } | null;
  // Second patrol for swarm effect
  patrol2TargetPos: { x: number; y: number } | null;
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

/** Pick the closest patrol as the "primary" responder */
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
  const [patrol2TargetPos, setPatrol2TargetPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [investigatorTargetPos, setInvestigatorTargetPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patrolReturnedRef = useRef(false);
  const investigatorReturnedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setRespondingPatrolId(null);
    setFlaggedAgentId(null);
    setPatrolTargetPos(null);
    setPatrol2TargetPos(null);
    setInvestigatorTargetPos(null);
    patrolReturnedRef.current = false;
    investigatorReturnedRef.current = false;
  }, [clearTimers]);

  // Step 1: Notification received → start patrol swarm
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
    
    // Both patrols swarm - one on each side
    setPatrolTargetPos({
      x: agentPos.x + OFFSETS.patrol.dx,
      y: agentPos.y + OFFSETS.patrol.dy,
    });
    setPatrol2TargetPos({
      x: agentPos.x + OFFSETS.patrol2.dx,
      y: agentPos.y + OFFSETS.patrol2.dy,
    });
    
    // Investigator stays home during patrol swarm
    setInvestigatorTargetPos(null);
    setPhase("patrol_swarming");
    dismiss();
    
    // Start 10s timer for patrol swarm
    timerRef.current = setTimeout(() => {
      setPhase("patrol_returning");
      setPatrolTargetPos(patrolReturnPos);
      setPatrol2TargetPos(null); // p2 just goes back to its patrol route
    }, PATROL_SWARM_DURATION_MS);
    
  }, [notification, dismiss, getAgentPosition]);

  // Step 2: Patrols return, then investigator moves
  const onPatrolReturnArrived = useCallback(() => {
    if (phase !== "patrol_returning") return;
    patrolReturnedRef.current = true;
    
    // Start investigator phase
    const agentId = flaggedAgentId;
    const agentPos = agentId ? getAgentPosition(agentId) : null;
    if (agentPos) {
      setInvestigatorTargetPos({
        x: agentPos.x + OFFSETS.investigator.dx,
        y: agentPos.y + OFFSETS.investigator.dy,
      });
      setPhase("investigator_moving");
    } else {
      resetToIdle();
    }
  }, [phase, flaggedAgentId, getAgentPosition, resetToIdle]);

  // Step 3: Investigator arrives, stays for investigation period
  const onInvestigatorArrived = useCallback(() => {
    if (phase !== "investigator_moving") return;
    setPhase("investigating");
    
    timerRef.current = setTimeout(() => {
      setPhase("investigator_returning");
      setInvestigatorTargetPos(investigatorHome ? { x: investigatorHome.x, y: investigatorHome.y } : null);
    }, INVESTIGATOR_SCENE_DURATION_MS);
  }, [phase]);

  // Step 4: Investigator returns, then done
  const onInvestigatorReturnArrived = useCallback(() => {
    if (phase !== "investigator_returning") return;
    investigatorReturnedRef.current = true;
    setPhase("reporting");
    
    timerRef.current = setTimeout(() => {
      resetToIdle();
    }, REPORT_DURATION_MS);
  }, [phase, resetToIdle]);

  // Patrol arrival at scene (no-op now, we just use timer)
  const onPatrolArrived = useCallback(() => {
    // Patrol arrived at scene - nothing special, we use timer
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const response: PatrolResponseState | null =
    phase === "idle"
      ? null
      : {
          phase,
          respondingPatrolId,
          patrolTargetPos,
          patrol2TargetPos,
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
