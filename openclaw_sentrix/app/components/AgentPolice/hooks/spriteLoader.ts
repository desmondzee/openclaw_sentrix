"use client";

import { Texture, Rectangle } from "pixi.js";
import { SPRITE_SHEETS } from "../config/spriteConfig";

export const frameCache = new Map<string, Texture[]>();
export const textureCache = new Map<string, Texture>();
const loadingPromises = new Map<string, Promise<void>>();

let preloadPromise: Promise<void> | null = null;

function sliceFrames(baseTexture: Texture): Texture[] {
  const source = baseTexture.source;
  const frameWidth = Math.floor(source.width / 4);
  const frameHeight = source.height;
  return [0, 1, 2, 3].map(
    (i) =>
      new Texture({
        source,
        frame: new Rectangle(i * frameWidth, 0, frameWidth, frameHeight),
      })
  );
}

function toAbsoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return path.startsWith("http") ? path : `${window.location.origin}${path}`;
}

async function loadWithRetry(
  path: string,
  retries = 1,
  timeoutMs = 5000
): Promise<Texture> {
  const loadTask = async () => {
    const url = toAbsoluteUrl(path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${path}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Failed to decode: ${path}`));
      el.src = objectUrl;
    });
    const texture = Texture.from(img);
    URL.revokeObjectURL(objectUrl);
    return texture;
  };
  const timeoutPromise = new Promise<Texture>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout: ${path}`)), timeoutMs)
  );
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await Promise.race([loadTask(), timeoutPromise]);
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 50));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to load ${path}`);
}

const spritePathSet = new Set<string>(Object.values(SPRITE_SHEETS));

export function preloadEssentialSprites(): Promise<void> {
  return Promise.resolve();
}

export function preloadAllSprites(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const paths = [...new Set(Object.values(SPRITE_SHEETS))];
    await Promise.allSettled(
      paths.map(async (path) => {
        if (frameCache.has(path)) return;
        try {
          const tex = await loadWithRetry(path, 0, 3000);
          frameCache.set(path, sliceFrames(tex));
        } catch (err) {
          console.warn("[spriteLoader] Failed:", path, err);
        }
      })
    );
  })();

  return preloadPromise;
}

export async function loadSpriteSheet(sheetPath: string): Promise<void> {
  if (frameCache.has(sheetPath)) return;
  if (loadingPromises.has(sheetPath)) {
    await loadingPromises.get(sheetPath);
    return;
  }
  const promise = loadWithRetry(sheetPath)
    .then((tex) => {
      frameCache.set(sheetPath, sliceFrames(tex));
      loadingPromises.delete(sheetPath);
    })
    .catch((err) => {
      console.error("[spriteLoader] Failed:", sheetPath, err);
      loadingPromises.delete(sheetPath);
      throw err;
    });
  loadingPromises.set(sheetPath, promise);
  await promise;
}

export async function loadStaticTexture(path: string): Promise<void> {
  if (textureCache.has(path)) return;
  if (loadingPromises.has(path)) {
    await loadingPromises.get(path);
    return;
  }
  const promise = loadWithRetry(path)
    .then((tex) => {
      textureCache.set(path, tex);
      loadingPromises.delete(path);
    })
    .catch((err) => {
      console.error("[spriteLoader] Failed texture:", path, err);
      loadingPromises.delete(path);
      throw err;
    });
  loadingPromises.set(path, promise);
  await promise;
}
