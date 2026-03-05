import { useState, useEffect, useRef, useCallback } from 'react';
import { controlRoom } from '../config/roomLayout';

const S = 3;

// Roaming configuration
const ROAM_SPEED = 0.4 * S; // Slower than patrol for aimless wandering
const PAUSE_MIN_MS = 1500; // Minimum pause at each point
const PAUSE_MAX_MS = 4000; // Maximum pause at each point
const MARGIN = 30 * S; // Keep sprites away from control room edges

// Control room bounds for roaming
const ROAM_BOUNDS = {
  minX: controlRoom.x + MARGIN,
  maxX: controlRoom.x + controlRoom.width - MARGIN,
  minY: controlRoom.y + MARGIN,
  maxY: controlRoom.y + controlRoom.height - MARGIN,
};

function getRandomRoamPoint(): { x: number; y: number } {
  return {
    x: ROAM_BOUNDS.minX + Math.random() * (ROAM_BOUNDS.maxX - ROAM_BOUNDS.minX),
    y: ROAM_BOUNDS.minY + Math.random() * (ROAM_BOUNDS.maxY - ROAM_BOUNDS.minY),
  };
}

function getRandomPauseDuration(): number {
  return PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
}

interface UseRoamingMovementOptions {
  enabled: boolean;
  homePosition: { x: number; y: number };
}

export function useRoamingMovement({ enabled, homePosition }: UseRoamingMovementOptions) {
  const [position, setPosition] = useState(homePosition);
  const posRef = useRef(homePosition);
  const targetRef = useRef<{ x: number; y: number } | null>(null);
  const pauseUntilRef = useRef<number>(0);

  // Reset to home position when roaming is disabled
  useEffect(() => {
    if (!enabled) {
      posRef.current = homePosition;
      setPosition(homePosition);
      targetRef.current = null;
    }
  }, [enabled, homePosition.x, homePosition.y]);

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;

    const tick = () => {
      const now = Date.now();
      const cur = posRef.current;

      // If we're pausing, wait
      if (now < pauseUntilRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      // If no target, pick a random point
      if (!targetRef.current) {
        targetRef.current = getRandomRoamPoint();
      }

      const target = targetRef.current;
      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ROAM_SPEED) {
        // Arrived at target — snap, pause, then pick new target
        posRef.current = { x: target.x, y: target.y };
        setPosition({ ...posRef.current });
        targetRef.current = null;
        pauseUntilRef.current = now + getRandomPauseDuration();
      } else {
        // Move toward target at constant speed
        const nx = dx / dist;
        const ny = dy / dist;
        posRef.current = {
          x: cur.x + nx * ROAM_SPEED,
          y: cur.y + ny * ROAM_SPEED,
        };
        setPosition({ ...posRef.current });
      }

      rafId = requestAnimationFrame(tick);
    };

    // Start with a brief random pause before first movement
    pauseUntilRef.current = Date.now() + Math.random() * 1000;
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return position;
}
