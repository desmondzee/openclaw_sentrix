"use client";

import { motion, useAnimationFrame } from "framer-motion";
import { useRef, useState } from "react";

type Direction = "FRONT" | "BACK" | "LEFT" | "RIGHT";

const DIRECTION_OFFSETS: Record<Direction, string> = {
    FRONT: "0%",    // Frame 0
    BACK: "33.33%", // Frame 1
    LEFT: "66.66%", // Frame 2
    RIGHT: "100%"   // Frame 3
};

export interface Waypoint {
    x: number;
    y: number;
    duration: number; // time to reach this waypoint from previous
    delay?: number;   // pause time before moving to this waypoint
}

interface AnimatedSpriteProps {
    spritesheet: string;
    width: number;
    height: number;
    waypoints: Waypoint[];
    className?: string;
}

export function AnimatedSprite({ spritesheet, width, height, waypoints, className = "" }: AnimatedSpriteProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [direction, setDirection] = useState<Direction>("FRONT");

    // Keep track of internal state for the custom waypoint system
    const stateRef = useRef({
        currentWaypointIndex: 0,
        timeInSegment: 0,
        isWaiting: false,
        lastX: 0,
        lastY: 0,
    });

    // Simple custom animation loop to follow waypoints and calculate direction vectors
    useAnimationFrame((time, delta) => {
        if (!containerRef.current || waypoints.length === 0) return;

        const state = stateRef.current;
        const currentWaypoint = waypoints[state.currentWaypointIndex];
        const nextWaypointIndex = (state.currentWaypointIndex + 1) % waypoints.length;
        const nextWaypoint = waypoints[nextWaypointIndex];

        const segmentDuration = nextWaypoint.duration * 1000;
        const delayDuration = (nextWaypoint.delay || 0) * 1000;

        if (state.isWaiting) {
            state.timeInSegment += delta;
            if (state.timeInSegment >= delayDuration) {
                state.isWaiting = false;
                state.timeInSegment = 0;
                state.currentWaypointIndex = nextWaypointIndex;
            }
            return;
        }

        state.timeInSegment += delta;

        // Calculate progress (0 to 1) for this segment
        let progress = state.timeInSegment / segmentDuration;
        if (progress >= 1) {
            progress = 1;
            if (delayDuration > 0) {
                state.isWaiting = true;
                state.timeInSegment = 0;
            } else {
                state.currentWaypointIndex = nextWaypointIndex;
                state.timeInSegment = 0;
            }
        }

        // Linearly interpolate position
        const currentX = currentWaypoint.x + (nextWaypoint.x - currentWaypoint.x) * progress;
        const currentY = currentWaypoint.y + (nextWaypoint.y - currentWaypoint.y) * progress;

        // Determine direction vector dx, dy
        const dx = currentX - state.lastX;
        const dy = currentY - state.lastY;

        // Only change direction if there is meaningful movement to prevent flickering
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
            if (Math.abs(dx) > Math.abs(dy)) {
                setDirection(dx > 0 ? "RIGHT" : "LEFT");
            } else {
                setDirection(dy > 0 ? "FRONT" : "BACK");
            }
        }

        state.lastX = currentX;
        state.lastY = currentY;

        // Apply the position to the DOM node directly for performance
        containerRef.current.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    return (
        <div
            ref={containerRef}
            className={`absolute top-0 left-0 drop-shadow-[0_0_15px_rgba(167,139,250,0.4)] ${className}`}
            style={{
                width,
                height,
                willChange: "transform",
            }}
        >
            <div
                className="w-full h-full pixel-art animate-bob"
                style={{
                    backgroundImage: `url(${spritesheet})`,
                    backgroundSize: "400% 100%", // 4 frames in row
                    backgroundPositionX: DIRECTION_OFFSETS[direction],
                    backgroundRepeat: "no-repeat"
                }}
            />
        </div>
    );
}
