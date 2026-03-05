import { useState, useEffect, useRef } from 'react';
import { MOVEMENT } from '../config/spriteConfig';

interface Position {
  x: number;
  y: number;
}

export function useAgentMovement(targetX: number, targetY: number, speed?: number): Position {
  const [position, setPosition] = useState<Position>({ x: targetX, y: targetY });
  const posRef = useRef<Position>({ x: targetX, y: targetY });
  const prevTargetRef = useRef<Position>({ x: targetX, y: targetY });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // If target changed, start animating
    if (prevTargetRef.current.x === targetX && prevTargetRef.current.y === targetY) {
      return;
    }
    prevTargetRef.current = { x: targetX, y: targetY };

    cancelAnimationFrame(rafRef.current);

    const tick = () => {
      const cur = posRef.current;
      const dx = targetX - cur.x;
      const dy = targetY - cur.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const lerpFactor = speed ?? MOVEMENT.agentTransitionSpeed;
        const newPos = {
          x: cur.x + dx * lerpFactor,
          y: cur.y + dy * lerpFactor,
        };
        posRef.current = newPos;
        setPosition(newPos);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Snap to target
        posRef.current = { x: targetX, y: targetY };
        setPosition({ x: targetX, y: targetY });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetX, targetY, speed]);

  return position;
}
