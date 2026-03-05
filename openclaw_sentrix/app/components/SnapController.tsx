"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";

export function SnapController() {
  const lenis = useLenis();
  const snapRef = useRef<{ destroy: () => void; addElement: (el: HTMLElement, opts?: { align?: string }) => () => void } | null>(null);

  useEffect(() => {
    if (!lenis) return;

    let cancelled = false;
    let techSnapCleanup: (() => void) | null = null;
    let isTechSnapped = false;
    let scrollCallback: ((e: any) => void) | null = null;

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      import("lenis/snap").then(({ default: Snap }) => {
        if (cancelled) return;
        snapRef.current = new Snap(lenis, {
          type: "proximity",
          duration: 0.6,
          lerp: 0.11,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          distanceThreshold: "40%",
          debounce: 250,
        });

        const elements = document.querySelectorAll<HTMLElement>("[data-snap-section]");
        elements.forEach((el) => {
          if (el.id !== "nemotron-section") {
            snapRef.current?.addElement(el, { align: "start" });
          }
        });

        const techSection = document.getElementById("nemotron-section");
        if (techSection && snapRef.current) {
          // Initially add it
          techSnapCleanup = snapRef.current.addElement(techSection, { align: "start" });
          isTechSnapped = true;

          scrollCallback = (e: any) => {
            const isAbove = Math.round(e.scroll) <= Math.round(techSection.offsetTop + 50);

            if (isAbove && !isTechSnapped && snapRef.current) {
              techSnapCleanup = snapRef.current.addElement(techSection, { align: "start" });
              isTechSnapped = true;
            } else if (!isAbove && isTechSnapped) {
              if (techSnapCleanup) {
                techSnapCleanup();
                techSnapCleanup = null;
              }
              isTechSnapped = false;
            }
          };

          lenis.on('scroll', scrollCallback);
        }
      });
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (techSnapCleanup) {
        techSnapCleanup();
      }
      if (scrollCallback) {
        lenis.off('scroll', scrollCallback);
      }
      snapRef.current?.destroy();
      snapRef.current = null;
    };
  }, [lenis]);

  return null;
}
