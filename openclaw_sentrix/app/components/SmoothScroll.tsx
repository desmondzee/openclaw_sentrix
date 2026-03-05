"use client";

import "lenis/dist/lenis.css";
import { ReactLenis } from "lenis/react";
import { SnapController } from "./SnapController";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.24,
        duration: 0.6,
        smoothWheel: true,
        wheelMultiplier: 0.95,
        touchMultiplier: 0.95,
      }}
      className="h-full"
    >
      <SnapController />
      {children}
    </ReactLenis>
  );
}
