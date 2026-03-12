/** Minimal types for agent police sprite view (aligned with bridge policeState). */

export type AgentStatus = "working" | "idle" | "restricted" | "suspended";

export interface Agent {
  id: string;
  name: string;
  role?: string;
  status: AgentStatus;
  riskScore?: "normal" | "low" | "high";
}

export interface PatrolSelection {
  patrolId: string;
  patrolLabel: string;
}

export interface PatrolResponseProps {
  respondingPatrolId: "p1" | "p2" | null;
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
  /** Agent ID that is currently flagged for violation (turns red) */
  flaggedAgentId: string | null;
}
