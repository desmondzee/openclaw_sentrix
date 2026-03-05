'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Texture } from 'pixi.js';
import type { SpriteDirection } from '../config/spriteConfig';
import { SPRITE_FRAMES } from '../config/spriteConfig';
import { frameCache, loadSpriteSheet } from './spriteLoader';

export function useSpriteTexture(
  sheetPath: string,
  direction: SpriteDirection = SPRITE_FRAMES.FRONT,
): { texture: Texture | null; isLoaded: boolean } {
  const [isLoaded, setIsLoaded] = useState(frameCache.has(sheetPath));

  useEffect(() => {
    if (frameCache.has(sheetPath)) {
      setIsLoaded(true);
      return;
    }

    loadSpriteSheet(sheetPath)
      .then(() => setIsLoaded(true))
      .catch(() => {});
  }, [sheetPath]);

  const texture = useMemo(() => {
    if (!isLoaded) return null;
    const frames = frameCache.get(sheetPath);
    return frames ? frames[direction] : null;
  }, [sheetPath, direction, isLoaded]);

  return { texture, isLoaded };
}
