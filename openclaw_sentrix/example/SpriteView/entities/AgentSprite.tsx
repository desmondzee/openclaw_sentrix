'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { AgentStatus, RiskLevel, AgentRecord } from '../../../../types';
import { STATUS_COLORS, SIZES, SPRITE_SHEETS, RISK_SPRITE_MAP, SPRITE_DISPLAY_SIZES } from '../config/spriteConfig';
import { CharacterSprite } from './BaseCharacter';
import { useAgentMovement } from '../hooks/useAgentMovement';
import { useMovementDirection } from '../hooks/useMovementDirection';
import { useQuarantineRoaming } from '../hooks/useQuarantineRoaming';

const S = 3;

interface AgentSpriteProps {
  agentId: string;
  name: string;
  role: string;
  status: AgentStatus;
  riskScore: RiskLevel;
  record: AgentRecord;
  x: number;
  y: number;
  isSelected: boolean;
  onSelect: (agentId: string) => void;
}

const RECORD_COLORS: Record<string, string> = {
  clear:     '#3b82f6',
  low_risk:  '#eab308',
  high_risk: '#ff3355',
};

const ROLE_LABELS: Record<string, string> = {
  EMAIL_AGENT: 'Email',
  CODING_AGENT: 'Coding',
  DOCUMENT_AGENT: 'Document',
  DATA_QUERY_AGENT: 'Data Query',
};

export function AgentSprite({
  agentId,
  name,
  role,
  status,
  riskScore,
  record,
  x,
  y,
  isSelected,
  onSelect,
}: AgentSpriteProps) {
  const colors = STATUS_COLORS[status];
  const [isHovered, setIsHovered] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Suspended agents roam aimlessly in quarantine
  const isSuspended = status === 'suspended';
  const roamingPos = useQuarantineRoaming(isSuspended, x, y);
  const targetPos = isSuspended ? roamingPos : { x, y };
  
  const animatedPos = useAgentMovement(targetPos.x, targetPos.y);
  const direction = useMovementDirection(animatedPos.x, animatedPos.y);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const spriteSheet = status === 'suspended'
    ? SPRITE_SHEETS.restricted
    : SPRITE_SHEETS[RISK_SPRITE_MAP[riskScore]];

  // No shake — removed (was tied to 'critical' which no longer exists)
  const shakeX = 0;

  const drawAura = useCallback(
    (g: any) => {
      g.clear();
      if (status === 'restricted') {
        // Pulsing orange aura for restricted agents
        const alpha = isMounted ? 0.1 + Math.sin(Date.now() / 500) * 0.05 : 0.1;
        g.setFillStyle({ color: colors.border, alpha });
        g.circle(0, 0, SIZES.auraRadius);
        g.fill();
      } else if (status === 'working') {
        // Subtle green aura for actively working agents
        g.setFillStyle({ color: colors.border, alpha: 0.08 });
        g.circle(0, 0, SIZES.auraRadius);
        g.fill();
      } else if (status === 'idle') {
        // Dim blue aura for idle agents
        g.setFillStyle({ color: colors.border, alpha: 0.05 });
        g.circle(0, 0, SIZES.auraRadius);
        g.fill();
      }
    },
    [status, colors.border, isMounted],
  );

  const drawSelection = useCallback(
    (g: any) => {
      g.clear();
      if (!isSelected) return;
      g.setStrokeStyle({ width: 2 * S, color: 0x00d4ff });
      g.circle(0, 0, SIZES.selectionRingRadius);
      g.stroke();
      g.setStrokeStyle({ width: 1 * S, color: 0x00d4ff, alpha: 0.3 });
      g.circle(0, 0, SIZES.selectionRingRadius + 4 * S);
      g.stroke();
    },
    [isSelected],
  );

  const drawAlert = useCallback(
    (g: any) => {
      g.clear();
      if (status !== 'restricted') return;
      const bounce = isMounted ? Math.sin(Date.now() / 300) * 3 * S : 0;

      // Warning triangle (orange for restricted)
      g.setFillStyle({ color: 0xffaa00 });
      g.moveTo(0, -38 * S + bounce);
      g.lineTo(-5 * S, -28 * S + bounce);
      g.lineTo(5 * S, -28 * S + bounce);
      g.closePath();
      g.fill();

      g.setFillStyle({ color: 0x0a0e1a });
      g.rect(-1 * S, -36 * S + bounce, 2 * S, 4 * S);
      g.fill();
      g.rect(-1 * S, -31 * S + bounce, 2 * S, 2 * S);
      g.fill();
    },
    [status, isMounted],
  );

  const handleClick = useCallback((e: any) => {
    e?.stopPropagation();
    onSelect(agentId);
  }, [onSelect, agentId]);

  const handlePointerOver = useCallback(() => setIsHovered(true), []);
  const handlePointerOut = useCallback(() => setIsHovered(false), []);

  const displayName = useMemo(() => {
    const parts = name.split('-');
    return parts.length > 1 ? `${parts[0]}-${parts[parts.length - 1]}` : name;
  }, [name]);

  const drawNameLabel = useCallback(
    (g: any) => {
      g.clear();
      const labelWidth = displayName.length * 6 * S + 8 * S;
      g.setFillStyle({ color: 0x0a0e1a, alpha: 0.8 });
      g.roundRect(-labelWidth / 2, 28 * S, labelWidth, 16 * S, 3 * S);
      g.fill();
    },
    [displayName],
  );

  const roleLabel = ROLE_LABELS[role] || role;
  const tooltipLines = useMemo(() => [
    agentId,
    `Record: ${record}`,
    `Role: ${roleLabel}`,
    `Status: ${status}`,
  ], [agentId, record, roleLabel, status]);

  const tooltipWidth = 130 * S;
  const tooltipLineHeight = 14 * S;
  const tooltipPadding = 8 * S;
  const tooltipHeight = tooltipLines.length * tooltipLineHeight + tooltipPadding * 2;

  const drawTooltipBg = useCallback(
    (g: any) => {
      g.clear();
      if (!isHovered) return;
      g.setFillStyle({ color: 0x111827, alpha: 0.95 });
      g.setStrokeStyle({ width: 1 * S, color: 0x374151 });
      g.roundRect(-tooltipWidth / 2, -tooltipHeight - 30 * S, tooltipWidth, tooltipHeight, 5 * S);
      g.fill();
      g.stroke();
    },
    [isHovered, tooltipWidth, tooltipHeight],
  );

  return (
    <pixiContainer
      x={animatedPos.x + shakeX}
      y={animatedPos.y}
      eventMode="static"
      cursor="pointer"
      onTap={handleClick}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <pixiGraphics draw={drawAura} />
      <pixiGraphics draw={drawSelection} />
      <CharacterSprite
        sheetPath={spriteSheet}
        direction={direction}
        displaySize={SPRITE_DISPLAY_SIZES.agent}
      />
      <pixiGraphics draw={drawAlert} />
      <pixiGraphics draw={drawNameLabel} />
      <pixiText
        text={displayName}
        x={0}
        y={36 * S}
        anchor={0.5}
        style={{
          fontSize: 10 * S,
          fill: colors.text,
          fontFamily: 'monospace',
        }}
      />
      {isHovered && (
        <>
          <pixiGraphics draw={drawTooltipBg} />
          {tooltipLines.map((line, i) => (
            <pixiText
              key={i}
              text={line}
              x={0}
              y={-tooltipHeight - 30 * S + tooltipPadding + i * tooltipLineHeight + 2 * S}
              anchor={{ x: 0.5, y: 0 }}
              style={{
                fontSize: 10 * S,
                fill: i === 0 ? '#ffffff' : i === 1 ? RECORD_COLORS[record] : i === 3 ? colors.text : '#9ca3af',
                fontFamily: 'monospace',
                fontWeight: i === 0 ? 'bold' : 'normal',
              }}
            />
          ))}
        </>
      )}
    </pixiContainer>
  );
}
