"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";

// Hardcoded snap points (in pixels) for consistent snapping
// Positioned to show section badges with padding above
const SNAP_POINTS = [
  0,        // Hero - top of page
  7000,     // Solution section - above "THE ARCHITECTURE" with padding
  8100,     // Install section - above "GET STARTED" with padding  
];

// Check if device is mobile/touch-based
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  
  // Check for touch capability
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  
  // Check for mobile screen size (tablet and below)
  const isSmallScreen = window.innerWidth < 1024;
  
  // Check for mobile user agent
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  // Disable snap if: has touch AND (small screen OR mobile UA)
  return hasTouch && (isSmallScreen || isMobileUA);
}

export function SnapController() {
  const lenis = useLenis();
  const snapRef = useRef<{ destroy: () => void; add: (value: number) => void } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check mobile status on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(isMobileDevice());
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // Don't initialize snap on mobile devices
    if (!lenis || isMobile) return;

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
          distanceThreshold: "30%",
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
  }, [lenis, isMobile]);

  return null;
}
