import { useState, useEffect, useRef } from 'react';
import { patrolWaypoints, findPath } from '../config/roomLayout';
import { MOVEMENT } from '../config/spriteConfig';

const S = 3;

// Slow constant speed in pixels per frame (~60fps) — scaled with world ×3
const PATROL_SPEED = 0.8 * 3;
// Faster speed when moving to target agent
const TARGET_SPEED = 2.5 * S;

export function usePatrolTargetMovement(
  patrolId: string,
  targetAgentPos: { x: number; y: number } | null,
  onArrived?: () => void,
) {
  // p1 starts at waypoint 0, p2 starts halfway through the route
  const startIdx = patrolId === 'p1' ? 0 : Math.floor(patrolWaypoints.length / 2);

  const [position, setPosition] = useState(() => ({ ...patrolWaypoints[startIdx] }));
  const posRef = useRef({ ...patrolWaypoints[startIdx] });
  const waypointIdxRef = useRef(startIdx);
  const arrivedRef = useRef(false);
  
  // Path following state for target movement
  const pathRef = useRef<{ x: number; y: number }[]>([]);
  const pathIdxRef = useRef(0);
  
  // Use refs for values that the animation loop needs to see updated immediately
  const targetPosRef = useRef<{ x: number; y: number } | null>(targetAgentPos);
  const onArrivedRef = useRef(onArrived);

  // Keep refs in sync with props and compute path when target changes
  useEffect(() => {
    if (targetAgentPos) {
      const currentPos = posRef.current;
      // Compute path from current position to target agent position
      const path = findPath(currentPos.x, currentPos.y, targetAgentPos.x, targetAgentPos.y);
      pathRef.current = path;
      pathIdxRef.current = 0; // Start at beginning of path
      arrivedRef.current = false;
    } else {
      pathRef.current = [];
      pathIdxRef.current = 0;
    }
    targetPosRef.current = targetAgentPos;
  }, [targetAgentPos]);

  useEffect(() => {
    onArrivedRef.current = onArrived;
  }, [onArrived]);

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const cur = posRef.current;
      const currentTargetPos = targetPosRef.current;
      const path = pathRef.current;

      if (currentTargetPos && path.length > 0) {
        // Moving along path to target agent
        const currentPathIdx = pathIdxRef.current;
        
        // Get next waypoint in path
        const nextWaypoint = path[Math.min(currentPathIdx, path.length - 1)];
        
        const dx = nextWaypoint.x - cur.x;
        const dy = nextWaypoint.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2 * S) {
          // Move towards current path waypoint
          const nx = dx / dist;
          const ny = dy / dist;
          const newPos = {
            x: cur.x + nx * TARGET_SPEED,
            y: cur.y + ny * TARGET_SPEED,
          };
          posRef.current = newPos;
          setPosition(newPos);
        } else {
          // Reached current waypoint, advance to next
          if (currentPathIdx < path.length - 1) {
            pathIdxRef.current = currentPathIdx + 1;
          } else if (!arrivedRef.current) {
            // Reached final destination
            arrivedRef.current = true;
            onArrivedRef.current?.();
          }
        }
      } else {
        // Normal patrol waypoint movement
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
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // Empty deps - animation loop runs once, reads from refs

  return position;
}
