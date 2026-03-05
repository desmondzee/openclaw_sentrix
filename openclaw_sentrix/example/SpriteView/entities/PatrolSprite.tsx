'use client';

import { useCallback, useState, useEffect } from 'react';
import { SYSTEM_COLORS, SPRITE_SHEETS, SPRITE_DISPLAY_SIZES } from '../config/spriteConfig';
import { CharacterSprite } from './BaseCharacter';
import { usePatrolTargetMovement } from '../hooks/usePatrolTargetMovement';
import { useMovementDirection } from '../hooks/useMovementDirection';
import type { PatrolSelection } from '../../../../types';

const S = 3;

interface PatrolSpriteProps {
  patrolId: string;
  label: string;
  targetAgentPos: { x: number; y: number } | null;
  onSelect: (selection: PatrolSelection | null) => void;
  onSelectAgent?: (id: string) => void;
  onArrived: () => void;
}

export function PatrolSprite({
  patrolId,
  label,
  targetAgentPos,
  onSelect,
  onSelectAgent,
  onArrived,
}: PatrolSpriteProps) {
  const [isMounted, setIsMounted] = useState(false);
  const position = usePatrolTargetMovement(patrolId, targetAgentPos, onArrived);
  const direction = useMovementDirection(position.x, position.y);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const drawLabel = useCallback(
    (g: any) => {
      g.clear();
      g.setFillStyle({ color: 0x0a0e1a, alpha: 0.8 });
      g.roundRect(-25 * S, 22 * S, 50 * S, 14 * S, 3 * S);
      g.fill();
    },
    [],
  );

  const drawScanEffect = useCallback(
    (g: any) => {
      g.clear();
      if (isMounted) {
        const angle = (Date.now() / 1000) % (Math.PI * 2);
        g.setStrokeStyle({ width: 1 * S, color: SYSTEM_COLORS.patrol.border, alpha: 0.3 });
        g.moveTo(0, 0);
        g.lineTo(Math.cos(angle) * 25 * S, Math.sin(angle) * 25 * S);
        g.stroke();
      }
    },
    [isMounted],
  );

  const drawConnectionLine = useCallback(
    (g: any) => {
      g.clear();
      if (!targetAgentPos) return;

      const dx = targetAgentPos.x - position.x;
      const dy = targetAgentPos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const segments = Math.floor(dist / (10 * S));

      g.setStrokeStyle({ width: 1 * S, color: SYSTEM_COLORS.patrol.border, alpha: 0.5 });
      for (let i = 0; i < segments; i += 2) {
        const t1 = i / segments;
        const t2 = Math.min((i + 1) / segments, 1);
        g.moveTo(dx * t1, dy * t1);
        g.lineTo(dx * t2, dy * t2);
      }
      g.stroke();
    },
    [targetAgentPos, position.x, position.y],
  );

  const handleClick = useCallback((e: any) => {
    e?.stopPropagation();
    onSelect({ patrolId, patrolLabel: label });
    onSelectAgent?.(patrolId);
  }, [onSelect, onSelectAgent, patrolId, label]);

  return (
    <pixiContainer x={position.x} y={position.y}>
      {!targetAgentPos && <pixiGraphics draw={drawScanEffect} />}
      <pixiGraphics draw={drawConnectionLine} />
      <pixiContainer
        eventMode="static"
        cursor="pointer"
        onTap={handleClick}
        onClick={handleClick}
      >
        <CharacterSprite
          sheetPath={SPRITE_SHEETS.patrol}
          direction={direction}
          displaySize={SPRITE_DISPLAY_SIZES.patrol}
        />
      </pixiContainer>
      <pixiGraphics draw={drawLabel} />
      <pixiText
        text={label}
        x={0}
        y={29 * S}
        anchor={0.5}
        style={{
          fontSize: 9 * S,
          fill: SYSTEM_COLORS.patrol.text,
          fontFamily: 'monospace',
        }}
      />
    </pixiContainer>
  );
}
