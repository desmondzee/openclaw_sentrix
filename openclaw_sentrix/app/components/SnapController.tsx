"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";

// Check if device is mobile/touch-based
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 1024;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  return hasTouch && (isSmallScreen || isMobileUA);
}

export function SnapController() {
  const lenis = useLenis();
  const [isMobile, setIsMobile] = useState(false);
  const snapInstanceRef = useRef<{
    destroy: () => void;
    add: (value: number) => void;
    addElement: (el: HTMLElement, opts?: { align?: string; offset?: number }) => () => void;
  } | null>(null);

  // Check mobile status on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(isMobileDevice());
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!lenis || isMobile) return;

    let cancelled = false;
    const cleanupFns: (() => void)[] = [];

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      
      import("lenis/snap").then(({ default: Snap }) => {
        if (cancelled) return;
        
        snapInstanceRef.current = new Snap(lenis, {
          type: "proximity",
          duration: 0.6,
          lerp: 0.11,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          distanceThreshold: "35%",
          debounce: 200,
        });

        // Hardcoded snap at absolute top of page
        snapInstanceRef.current.add(0);
        
        // Find sections and add them with specific offsets
        const sections = [
          { id: "problem", offset: -80 },   // 80px padding above "THE THREAT"
          { id: "solution", offset: -80 },  // 80px padding above "THE ARCHITECTURE"
          { id: "install", offset: -80 },   // 80px padding above "GET STARTED"
          { id: "nemotron-section", offset: -80 },  // 80px padding above "THE ENGINE"
        ];

        sections.forEach(({ id, offset }) => {
          const el = document.getElementById(id);
          
          if (el && snapInstanceRef.current) {
            const cleanup = snapInstanceRef.current.addElement(el, { 
              align: "start",
              offset 
            });
            cleanupFns.push(cleanup);
          }
        });
      });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cleanupFns.forEach(fn => fn());
      snapInstanceRef.current?.destroy();
      snapInstanceRef.current = null;
    };
  }, [lenis, isMobile]);

  return null;
}
