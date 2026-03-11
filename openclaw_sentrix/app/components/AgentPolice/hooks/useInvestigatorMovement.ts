"use client";

import { useState, useEffect, useRef } from "react";
import { controlRoom } from "../config/roomLayout";
import { MOVEMENT } from "../config/spriteConfig";

const S = 3;
const ROAM_SPEED = 0.4 * S;
const PAUSE_MIN_MS = 1500;
const PAUSE_MAX_MS = 4000;
const MARGIN = 30 * S;

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
  onArrived?: () => void,
  targetPos?: { x: number; y: number } | null
) {
  const homePos =
    controlRoom.investigatorPositions.find((p) => p.id === investigatorId) ??
    controlRoom.investigatorPositions[0];

  const [position, setPosition] = useState({ x: homePos.x, y: homePos.y });
  const posRef = useRef(position);
  const arrivedRef = useRef(false);
  const roamTargetRef = useRef<{ x: number; y: number } | null>(null);
  const pauseUntilRef = useRef<number>(0);

  const onArrivedRef = useRef(onArrived);
  useEffect(() => {
    onArrivedRef.current = onArrived;
  }, [onArrived]);

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
        const dx = overridePos.x - cur.x;
        const dy = overridePos.y - cur.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2 * S) {
          const speed = MOVEMENT.investigatorSpeed;
          posRef.current = { x: cur.x + dx * speed, y: cur.y + dy * speed };
          setPosition(posRef.current);
        } else if (!arrivedRef.current) {
          arrivedRef.current = true;
          onArrivedRef.current?.();
        }
        roamTargetRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (now < pauseUntilRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (!roamTargetRef.current) {
        roamTargetRef.current = getRandomRoamPoint();
      }

      const roamTarget = roamTargetRef.current;
      const dx = roamTarget.x - cur.x;
      const dy = roamTarget.y - cur.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ROAM_SPEED) {
        posRef.current = { x: roamTarget.x, y: roamTarget.y };
        setPosition({ ...posRef.current });
        roamTargetRef.current = null;
        pauseUntilRef.current = now + getRandomPauseDuration();
      } else {
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

    pauseUntilRef.current = Date.now() + Math.random() * 2000;
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [homePos.x, homePos.y]);

  return position;
}
