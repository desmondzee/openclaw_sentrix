'use client';

import { useCallback, useState, useEffect } from 'react';
import { SYSTEM_COLORS, SPRITE_SHEETS, SPRITE_FRAMES, SPRITE_DISPLAY_SIZES } from '../config/spriteConfig';
import { CharacterSprite } from './BaseCharacter';
import { controlRoom } from '../config/roomLayout';

const S = 3;

interface SuperintendentSpriteProps {
  onSelect?: (id: string) => void;
}

export function SuperintendentSprite({ onSelect }: SuperintendentSpriteProps) {
  const { superintendentPos } = controlRoom;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const drawPulse = useCallback((g: any) => {
    g.clear();
    const pulse = isMounted ? Math.sin(Date.now() / 800) * 0.15 + 0.2 : 0.2;
    g.setStrokeStyle({ width: 1 * S, color: SYSTEM_COLORS.superintendent.border, alpha: pulse });
    g.circle(0, 0, 32 * S);
    g.stroke();
    g.setStrokeStyle({ width: 1 * S, color: SYSTEM_COLORS.superintendent.border, alpha: pulse * 0.5 });
    g.circle(0, 0, 38 * S);
    g.stroke();
  }, [isMounted]);

  const handleClick = useCallback((e: any) => {
    e?.stopPropagation();
    onSelect?.('superintendent');
  }, [onSelect]);

  const drawLabel = useCallback((g: any) => {
    g.clear();
    g.setFillStyle({ color: 0x0a0e1a, alpha: 0.8 });
    g.roundRect(-45 * S, 30 * S, 90 * S, 14 * S, 3 * S);
    g.fill();
  }, []);

  return (
    <pixiContainer x={superintendentPos.x} y={superintendentPos.y} eventMode="static" cursor="pointer" onClick={handleClick} onTap={handleClick}>
      <pixiGraphics draw={drawPulse} />
      <CharacterSprite
        sheetPath={SPRITE_SHEETS.superintendent}
        direction={SPRITE_FRAMES.FRONT}
        displaySize={SPRITE_DISPLAY_SIZES.superintendent}
      />
      <pixiGraphics draw={drawLabel} />
      <pixiText
        text="Superintendent"
        x={0}
        y={37 * S}
        anchor={0.5}
        style={{
          fontSize: 9 * S,
          fill: SYSTEM_COLORS.superintendent.text,
          fontFamily: 'monospace',
        }}
      />
    </pixiContainer>
  );
}
