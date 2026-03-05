'use client';

import { useMemo } from 'react';
import { useSpriteTexture } from '../hooks/useSpriteTexture';
import type { SpriteDirection } from '../config/spriteConfig';
import { SPRITE_FRAMES } from '../config/spriteConfig';

interface CharacterSpriteProps {
  sheetPath: string;
  direction?: SpriteDirection;
  displaySize: number;
}

export function CharacterSprite({
  sheetPath,
  direction = SPRITE_FRAMES.FRONT,
  displaySize,
}: CharacterSpriteProps) {
  const { texture, isLoaded } = useSpriteTexture(sheetPath, direction);

  const scale = useMemo(() => {
    if (!texture) return 1;
    return displaySize / texture.height;
  }, [texture, displaySize]);

  if (!texture || !isLoaded) return null;

  return <pixiSprite texture={texture} anchor={0.5} scale={scale} />;
}
