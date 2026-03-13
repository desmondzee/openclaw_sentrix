"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";

// Hardcoded snap points (in pixels) for consistent snapping
// These are calculated based on the layout structure
const SNAP_POINTS = [
  0,        // Hero - top of page
  900,      // Problem section
  1800,     // Capture Sequence
  2700,     // Solution section
  3600,     // Install section
  4500,     // Tech section
];

export function SnapController() {
  const lenis = useLenis();
  const snapRef = useRef<{ destroy: () => void; add: (value: number) => void } | null>(null);
  const isSnappingRef = useRef(false);

  useEffect(() => {
    if (!lenis) return;

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      import("lenis/snap").then(({ default: Snap }) => {
        if (cancelled) return;
        
        snapRef.current = new Snap(lenis, {
          type: "proximity",
          duration: 0.6,
          lerp: 0.11,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          distanceThreshold: "35%",
          debounce: 200,
        });

        // Add hardcoded snap points
        SNAP_POINTS.forEach((point) => {
          snapRef.current?.add(point);
        });
      });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      snapRef.current?.destroy();
      snapRef.current = null;
    };
  }, [lenis]);

  return null;
}
