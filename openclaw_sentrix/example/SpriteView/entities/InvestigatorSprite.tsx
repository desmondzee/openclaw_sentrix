'use client';

import { useCallback } from 'react';
import { SYSTEM_COLORS, SPRITE_SHEETS, SPRITE_DISPLAY_SIZES } from '../config/spriteConfig';
import { CharacterSprite } from './BaseCharacter';
import { useInvestigatorMovement } from '../hooks/useInvestigatorMovement';
import { useMovementDirection } from '../hooks/useMovementDirection';

const S = 3;

interface InvestigatorSpriteProps {
  investigatorId: string;
  label: string;
  /** Direct world-space target — used by response sequence */
  targetPos?: { x: number; y: number } | null;
  onArrived?: () => void;
  onSelect?: (id: string) => void;
}

export function InvestigatorSprite({
  investigatorId,
  label,
  targetPos,
  onArrived,
  onSelect,
}: InvestigatorSpriteProps) {
  const position = useInvestigatorMovement(investigatorId, null, onArrived, targetPos);
  const direction = useMovementDirection(position.x, position.y);

  const handleClick = useCallback((e: any) => {
    e?.stopPropagation();
    onSelect?.(investigatorId);
  }, [onSelect, investigatorId]);

  const drawLabel = useCallback(
    (g: any) => {
      g.clear();
      g.setFillStyle({ color: 0x0a0e1a, alpha: 0.8 });
      g.roundRect(-35 * S, 24 * S, 70 * S, 14 * S, 3 * S);
      g.fill();
    },
    [],
  );

  return (
    <pixiContainer x={position.x} y={position.y} eventMode="static" cursor="pointer" onClick={handleClick} onTap={handleClick}>
      <CharacterSprite
        sheetPath={SPRITE_SHEETS.investigator}
        direction={direction}
        displaySize={SPRITE_DISPLAY_SIZES.investigator}
      />
      <pixiGraphics draw={drawLabel} />
      <pixiText
        text={label}
        x={0}
        y={31 * S}
        anchor={0.5}
        style={{
          fontSize: 9 * S,
          fill: SYSTEM_COLORS.investigator.text,
          fontFamily: 'monospace',
        }}
      />
    </pixiContainer>
  );
}
