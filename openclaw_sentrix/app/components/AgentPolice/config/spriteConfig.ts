import type { AgentStatus } from "../types";

export const STATUS_COLORS: Record<AgentStatus, { bg: number; border: number; text: string }> = {
  working: { bg: 0x003a1a, border: 0x00c853, text: "#00c853" },
  idle: { bg: 0x1e3a5f, border: 0x4a9eff, text: "#4a9eff" },
  restricted: { bg: 0x3a2a00, border: 0xffaa00, text: "#ffaa00" },
  suspended: { bg: 0x1f2937, border: 0x6b7280, text: "#6b7280" },
};

export const SYSTEM_COLORS = {
  patrol: { bg: 0x1a1a3a, border: 0x9b59b6, text: "#9b59b6" },
  investigator: { bg: 0x1a1a3a, border: 0x9b59b6, text: "#9b59b6" },
};

export const WORLD_COLORS = {
  background: 0x0a0e1a,
  roomFloor: 0x111827,
  roomBorder: 0x1f2937,
  controlRoomFloor: 0x0f1520,
  controlRoomBorder: 0x2d1b4e,
  desk: 0x1f2937,
  corridor: 0x0d1117,
};

const S = 3;

export const SIZES = {
  agentBody: 20 * S,
  patrolBody: 16 * S,
  investigatorBody: 18 * S,
  selectionRingRadius: 28 * S,
  auraRadius: 32 * S,
};

export const MOVEMENT = {
  investigatorSpeed: 0.06,
  agentTransitionSpeed: 0.04,
};

export const SPRITE_SHEETS = {
  normal_agent: "/assets/normal_agent.png",
  low_risk_agent: "/assets/normal_agent.png",
  high_risk_agent: "/assets/high_risk_agent.png",
  primary_agent: "/assets/normal_agent.png",
  restricted: "/assets/restricted.png",
  investigator: "/assets/investigator.png",
  patrol: "/assets/patrol.png",
} as const;

export const FURNITURE_SPRITES = {
  table: "/sprites/table.png",
  chair: "/sprites/chair.png",
  monitor: "/sprites/monitor-rear.png",
} as const;

export const FURNITURE_SIZES = {
  table: { width: 70, height: 40 },
  chair: { width: 30, height: 30 },
  monitor: { width: 32, height: 24 },
};

export const SPRITE_FRAMES = {
  FRONT: 0,
  BACK: 1,
  LEFT: 2,
  RIGHT: 3,
} as const;

export type SpriteDirection = (typeof SPRITE_FRAMES)[keyof typeof SPRITE_FRAMES];

export const SPRITE_DISPLAY_SIZES = {
  agent: 40 * S,
  patrol: 40 * S,
  investigator: 40 * S,
};

export type RiskLevel = "normal" | "low" | "high";
export type AgentRole = "primary" | "subagent";
export const RISK_SPRITE_MAP: Record<RiskLevel, keyof typeof SPRITE_SHEETS> = {
  normal: "normal_agent",
  low: "low_risk_agent",
  high: "high_risk_agent",
};

/** Get the appropriate sprite based on role and risk level */
export function getAgentSprite(
  role: AgentRole | undefined,
  riskLevel: RiskLevel,
  status: AgentStatus
): keyof typeof SPRITE_SHEETS {
  if (status === "suspended") {
    return "restricted";
  }
  if (role === "primary") {
    return "primary_agent";
  }
  return RISK_SPRITE_MAP[riskLevel];
}
