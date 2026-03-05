import { useEffect, useRef, useCallback } from 'react';

type TickCallback = (dt: number) => void;

export function useGameLoop() {
  const callbacksRef = useRef<Map<string, TickCallback>>(new Map());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const tick = (time: number) => {
      const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 16.667 : 1; // normalize to ~60fps
      lastTimeRef.current = time;
      callbacksRef.current.forEach((cb) => cb(dt));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const subscribe = useCallback((id: string, callback: TickCallback) => {
    callbacksRef.current.set(id, callback);
    return () => {
      callbacksRef.current.delete(id);
    };
  }, []);

  return { subscribe };
}
