import { useState, useEffect, useRef } from 'react';
import { getDeskPosition, controlRoom } from '../config/roomLayout';
import { MOVEMENT } from '../config/spriteConfig';

const S = 3;

// Roaming configuration for investigators
const ROAM_SPEED = 0.4 * S;
const PAUSE_MIN_MS = 1500;
const PAUSE_MAX_MS = 4000;
const MARGIN = 30 * S;

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

export function useInvestigatorMovement(
  investigatorId: string,
  targetAgentId: string | null,
  onArrived?: () => void,
  /** Direct world-space position override — takes precedence over targetAgentId */
  targetPos?: { x: number; y: number } | null,
) {
  const homePos =
    controlRoom.investigatorPositions.find((p) => p.id === investigatorId) ??
    controlRoom.investigatorPositions[0];

  const [position, setPosition] = useState({ x: homePos.x, y: homePos.y });
  const posRef = useRef(position);
  const arrivedRef = useRef(false);

  // Roaming state
  const roamTargetRef = useRef<{ x: number; y: number } | null>(null);
  const pauseUntilRef = useRef<number>(0);

  // Keep callback ref in sync to avoid stale closure in animation loop
  const onArrivedRef = useRef(onArrived);
  useEffect(() => { onArrivedRef.current = onArrived; }, [onArrived]);

  const targetPosRef = useRef(targetPos ?? null);
  useEffect(() => {
    targetPosRef.current = targetPos ?? null;
    arrivedRef.current = false;
  }, [targetPos]);

  useEffect(() => {
    arrivedRef.current = false;
    let rafId: number;

    const tick = () => {
      const now = Date.now();
      const cur = posRef.current;
      const overridePos = targetPosRef.current;

      if (overridePos) {
        // Direct position override (used by response sequence for scene + return movement)
        const dx = overridePos.x - cur.x;
        const dy = overridePos.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2 * S) {
          const speed = MOVEMENT.investigatorSpeed;
          const newPos = { x: cur.x + dx * speed, y: cur.y + dy * speed };
          posRef.current = newPos;
          setPosition(newPos);
        } else if (!arrivedRef.current) {
          arrivedRef.current = true;
          onArrivedRef.current?.();
        }

        roamTargetRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (targetAgentId) {
        // Has a target - move toward the target agent
        const deskPos = getDeskPosition(targetAgentId);
        const resolvedTarget = deskPos ? { x: deskPos.x, y: deskPos.y - 40 * S } : { x: homePos.x, y: homePos.y };

        const dx = resolvedTarget.x - cur.x;
        const dy = resolvedTarget.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2 * S) {
          const speed = MOVEMENT.investigatorSpeed;
          const newPos = {
            x: cur.x + dx * speed,
            y: cur.y + dy * speed,
          };
          posRef.current = newPos;
          setPosition(newPos);
        } else if (!arrivedRef.current) {
          arrivedRef.current = true;
          onArrivedRef.current?.();
        }

        // Clear roam state when assigned
        roamTargetRef.current = null;
      } else {
        // No target - roam aimlessly in control room

        // If pausing, wait
        if (now < pauseUntilRef.current) {
          rafId = requestAnimationFrame(tick);
          return;
        }

        // If no roam target, pick a random point
        if (!roamTargetRef.current) {
          roamTargetRef.current = getRandomRoamPoint();
        }

        const roamTarget = roamTargetRef.current;
        const dx = roamTarget.x - cur.x;
        const dy = roamTarget.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ROAM_SPEED) {
          // Arrived at roam target - pause then pick new one
          posRef.current = { x: roamTarget.x, y: roamTarget.y };
          setPosition({ ...posRef.current });
          roamTargetRef.current = null;
          pauseUntilRef.current = now + getRandomPauseDuration();
        } else {
          // Move toward roam target at constant speed
          const nx = dx / dist;
          const ny = dy / dist;
          posRef.current = {
            x: cur.x + nx * ROAM_SPEED,
            y: cur.y + ny * ROAM_SPEED,
          };
          setPosition({ ...posRef.current });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    // Start with a brief random pause before first movement (offset between investigators)
    pauseUntilRef.current = Date.now() + Math.random() * 2000;
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [targetAgentId, homePos.x, homePos.y]);

  return position;
}
