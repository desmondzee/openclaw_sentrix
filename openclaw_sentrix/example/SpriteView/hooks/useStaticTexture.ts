'use client';

import { useState, useEffect } from 'react';
import type { Texture } from 'pixi.js';
import { textureCache, loadStaticTexture } from './spriteLoader';

export function useStaticTexture(path: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(
    textureCache.get(path) ?? null,
  );

  useEffect(() => {
    if (textureCache.has(path)) {
      setTexture(textureCache.get(path)!);
      return;
    }

    loadStaticTexture(path)
      .then(() => setTexture(textureCache.get(path)!))
      .catch(() => {});
  }, [path]);

  return texture;
}
