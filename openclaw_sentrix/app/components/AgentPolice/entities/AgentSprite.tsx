"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import type { AgentStatus } from "../types";
import type { RiskLevel } from "../config/spriteConfig";
import {
  STATUS_COLORS,
  SIZES,
  SPRITE_SHEETS,
  SPRITE_DISPLAY_SIZES,
  getAgentSprite,
  type AgentRole,
} from "../config/spriteConfig";
import { CharacterSprite } from "./BaseCharacter";
import { useAgentMovement } from "../hooks/useAgentMovement";
import { useMovementDirection } from "../hooks/useMovementDirection";
import { useQuarantineRoaming } from "../hooks/useQuarantineRoaming";

const S = 3;

interface AgentSpriteProps {
  agentId: string;
  name: string;
  role?: string;
  status: AgentStatus;
  riskScore?: RiskLevel;
  x: number;
  y: number;
  isSelected: boolean;
  onSelect: (agentId: string) => void;
  /** Whether this agent is currently flagged for violation (turns red) */
  isFlagged?: boolean;
}

export function AgentSprite({
  agentId,
  name,
  role,
  status,
  riskScore = "normal",
  x,
  y,
  isSelected,
  onSelect,
  isFlagged = false,
}: AgentSpriteProps) {
  // When flagged, show red colors regardless of status
  const colors = isFlagged 
    ? { bg: 0x5a1a1a, border: 0xff4444, text: "#ff4444" }
    : STATUS_COLORS[status];
  const [isMounted, setIsMounted] = useState(false);

  const isSuspended = status === "suspended";
  const roamingPos = useQuarantineRoaming(isSuspended, x, y);
  const targetPos = isSuspended ? roamingPos : { x, y };

  const animatedPos = useAgentMovement(targetPos.x, targetPos.y);
  const direction = useMovementDirection(animatedPos.x, animatedPos.y);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const spriteSheet = SPRITE_SHEETS[getAgentSprite(role as AgentRole, riskScore, status)];

  const isPrimary = role === "primary";

  const drawAura = useCallback(
    (g: unknown) => {
      const gr = g as { clear: () => void; setFillStyle: (o: object) => void; circle: (a: number, b: number, c: number) => void; fill: () => void };
      gr.clear();
      if (status === "restricted") {
        const alpha = isMounted ? 0.1 + Math.sin(Date.now() / 500) * 0.05 : 0.1;
        gr.setFillStyle({ color: colors.border, alpha });
        gr.circle(0, 0, SIZES.auraRadius);
        gr.fill();
      } else if (status === "working") {
        // Primary agent gets a stronger aura
        const alpha = isPrimary ? 0.15 : 0.08;
        gr.setFillStyle({ color: colors.border, alpha });
        gr.circle(0, 0, SIZES.auraRadius);
        gr.fill();
        // Primary agent gets an outer glow ring
        if (isPrimary) {
          gr.setFillStyle({ color: 0x00d4ff, alpha: 0.05 });
          gr.circle(0, 0, SIZES.auraRadius + 8 * S);
          gr.fill();
        }
      } else if (status === "idle") {
        gr.setFillStyle({ color: colors.border, alpha: 0.05 });
        gr.circle(0, 0, SIZES.auraRadius);
        gr.fill();
      }
    },
    [status, colors.border, isMounted, isPrimary]
  );

  const drawSelection = useCallback(
    (g: unknown) => {
      const gr = g as { clear: () => void; setStrokeStyle: (o: object) => void; circle: (a: number, b: number, c: number) => void; stroke: () => void };
      gr.clear();
      if (!isSelected) return;
      gr.setStrokeStyle({ width: 2 * S, color: 0x00d4ff });
      gr.circle(0, 0, SIZES.selectionRingRadius);
      gr.stroke();
      gr.setStrokeStyle({ width: 1 * S, color: 0x00d4ff, alpha: 0.3 });
      gr.circle(0, 0, SIZES.selectionRingRadius + 4 * S);
      gr.stroke();
    },
    [isSelected]
  );

  const handleClick = useCallback(
    (e: unknown) => {
      (e as { stopPropagation?: () => void })?.stopPropagation?.();
      onSelect(agentId);
    },
    [onSelect, agentId]
  );

  const displayName = useMemo(() => {
    const parts = name.split("-");
    return parts.length > 1 ? `${parts[0]}-${parts[parts.length - 1]}` : name;
  }, [name]);

  const drawNameLabel = useCallback(
    (g: unknown) => {
      const gr = g as { clear: () => void; setFillStyle: (o: object) => void; roundRect: (a: number, b: number, c: number, d: number, e: number) => void; fill: () => void };
      gr.clear();
      const labelWidth = displayName.length * 6 * S + 8 * S;
      gr.setFillStyle({ color: 0x0a0e1a, alpha: 0.8 });
      gr.roundRect(-labelWidth / 2, 28 * S, labelWidth, 16 * S, 3 * S);
      gr.fill();
    },
    [displayName]
  );

  return (
    <pixiContainer
      x={animatedPos.x}
      y={animatedPos.y}
      eventMode="static"
      cursor="pointer"
      onTap={handleClick}
      onClick={handleClick}
    >
      <pixiGraphics draw={drawAura} />
      <pixiGraphics draw={drawSelection} />
      <CharacterSprite
        sheetPath={spriteSheet}
        direction={direction}
        displaySize={SPRITE_DISPLAY_SIZES.agent}
      />
      <pixiGraphics draw={drawNameLabel} />
      <pixiText
        text={displayName}
        x={0}
        y={36 * S}
        anchor={0.5}
        style={{
          fontSize: 10 * S,
          fill: colors.text,
          fontFamily: "monospace",
        }}
      />
    </pixiContainer>
  );
}
