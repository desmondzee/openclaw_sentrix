'use client';

import { useRef } from 'react';
import { SPRITE_FRAMES, type SpriteDirection } from '../config/spriteConfig';

export function useMovementDirection(
  x: number,
  y: number,
  defaultDirection: SpriteDirection = SPRITE_FRAMES.FRONT,
): SpriteDirection {
  const prevPos = useRef({ x, y });
  const currentDir = useRef<SpriteDirection>(defaultDirection);

  const dx = x - prevPos.current.x;
  const dy = y - prevPos.current.y;
  prevPos.current = { x, y };

  const threshold = 0.5;
  if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
    if (Math.abs(dx) > Math.abs(dy)) {
      currentDir.current = dx > 0 ? SPRITE_FRAMES.RIGHT : SPRITE_FRAMES.LEFT;
    } else {
      currentDir.current = dy > 0 ? SPRITE_FRAMES.FRONT : SPRITE_FRAMES.BACK;
    }
  }

  return currentDir.current;
}
