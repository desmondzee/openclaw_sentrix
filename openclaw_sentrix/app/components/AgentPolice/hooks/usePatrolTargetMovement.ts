"use client";

import { useState, useEffect, useRef } from "react";
import { patrolWaypoints, findPath } from "../config/roomLayout";

const S = 3;
const PATROL_SPEED = 0.8 * 3;
const TARGET_SPEED = 2.5 * S;

export function usePatrolTargetMovement(
  patrolId: string,
  targetAgentPos: { x: number; y: number } | null,
  onArrived?: () => void
) {
  const startIdx = patrolId === "p1" ? 0 : Math.floor(patrolWaypoints.length / 2);

  const [position, setPosition] = useState(() => ({ ...patrolWaypoints[startIdx] }));
  const posRef = useRef({ ...patrolWaypoints[startIdx] });
  const waypointIdxRef = useRef(startIdx);
  const arrivedRef = useRef(false);

  const pathRef = useRef<{ x: number; y: number }[]>([]);
  const pathIdxRef = useRef(0);

  const targetPosRef = useRef<{ x: number; y: number } | null>(targetAgentPos);
  const onArrivedRef = useRef(onArrived);

  useEffect(() => {
    if (targetAgentPos) {
      const currentPos = posRef.current;
      const path = findPath(
        currentPos.x,
        currentPos.y,
        targetAgentPos.x,
        targetAgentPos.y
      );
      pathRef.current = path;
      pathIdxRef.current = 0;
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
        const currentPathIdx = pathIdxRef.current;
        const nextWaypoint = path[Math.min(currentPathIdx, path.length - 1)];
        const dx = nextWaypoint.x - cur.x;
        const dy = nextWaypoint.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2 * S) {
          const nx = dx / dist;
          const ny = dy / dist;
          posRef.current = {
            x: cur.x + nx * TARGET_SPEED,
            y: cur.y + ny * TARGET_SPEED,
          };
          setPosition(posRef.current);
        } else {
          if (currentPathIdx < path.length - 1) {
            pathIdxRef.current = currentPathIdx + 1;
          } else if (!arrivedRef.current) {
            arrivedRef.current = true;
            onArrivedRef.current?.();
          }
        }
      } else {
        const targetIdx = (waypointIdxRef.current + 1) % patrolWaypoints.length;
        const target = patrolWaypoints[targetIdx];
        const dx = target.x - cur.x;
        const dy = target.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PATROL_SPEED) {
          posRef.current = { x: target.x, y: target.y };
          waypointIdxRef.current = targetIdx;
        } else {
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
  }, []);

  return position;
}
