import { useState, useEffect, useRef } from 'react';
import { patrolWaypoints } from '../config/roomLayout';

// Slow constant speed in pixels per frame (~60fps) — scaled with world ×3
const PATROL_SPEED = 0.8 * 3;

export function usePatrolMovement(patrolId: string) {
  // p1 starts at waypoint 0, p2 starts halfway through the route
  const startIdx = patrolId === 'p1' ? 0 : Math.floor(patrolWaypoints.length / 2);

  const [position, setPosition] = useState(() => ({ ...patrolWaypoints[startIdx] }));
  const posRef = useRef({ ...patrolWaypoints[startIdx] });
  const waypointIdxRef = useRef(startIdx);

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const cur = posRef.current;
      const targetIdx = (waypointIdxRef.current + 1) % patrolWaypoints.length;
      const target = patrolWaypoints[targetIdx];

      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PATROL_SPEED) {
        // Arrived at waypoint — snap and advance to next
        posRef.current = { x: target.x, y: target.y };
        waypointIdxRef.current = targetIdx;
      } else {
        // Move at constant speed toward the target
        const nx = dx / dist;
        const ny = dy / dist;
        posRef.current = {
          x: cur.x + nx * PATROL_SPEED,
          y: cur.y + ny * PATROL_SPEED,
        };
      }

      setPosition({ ...posRef.current });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return position;
}
