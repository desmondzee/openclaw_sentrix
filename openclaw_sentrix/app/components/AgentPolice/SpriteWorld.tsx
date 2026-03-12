"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Application, extend } from "@pixi/react";
import { Container, Graphics, Text, Sprite } from "pixi.js";
import type {
  AgentStatus,
  PatrolSelection,
  Agent,
  PatrolResponseProps,
} from "./types";
import { WORLD_COLORS } from "./config/spriteConfig";
import { preloadEssentialSprites, preloadAllSprites } from "./hooks/spriteLoader";
import { getWorldBounds } from "./config/roomLayout";
import { FloorLayer } from "./layers/FloorLayer";
import { FurnitureLayer, MonitorLayer } from "./layers/FurnitureLayer";
import { EntityLayer } from "./layers/EntityLayer";
import { EffectsLayer } from "./layers/EffectsLayer";

extend({ Container, Graphics, Text, Sprite });

interface SpriteWorldProps {
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  getAgentStatus: (agentId: string) => AgentStatus;
  patrolSelection: PatrolSelection | null;
  onPatrolSelect: (selection: PatrolSelection | null) => void;
  agents: Agent[];
  response?: PatrolResponseProps | null;
}

export default function SpriteWorld({
  selectedAgentId,
  onSelectAgent,
  getAgentStatus,
  patrolSelection,
  onPatrolSelect,
  agents,
  response,
}: SpriteWorldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [preloaded, setPreloaded] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const prevAgentCountRef = useRef(0);
  const initialCenterDoneRef = useRef(false);

  useEffect(() => {
    preloadEssentialSprites().then(() => {
      setPreloaded(true);
      preloadAllSprites();
    });
  }, []);

  // Initial center on first load (before agents arrive)
  useEffect(() => {
    if (!preloaded || initialCenterDoneRef.current) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Small delay to ensure container has size
    const timer = setTimeout(() => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      
      const bounds = getWorldBounds();
      const scaleX = rect.width / bounds.width;
      const scaleY = rect.height / bounds.height;
      const fitScale = Math.min(scaleX, scaleY, 0.95);
      const finalScale = Math.max(fitScale, 0.28);
      
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const panX = rect.width / 2 - centerX * finalScale;
      const panY = rect.height / 2 - centerY * finalScale;
      
      setScale(finalScale);
      setPan({ x: panX, y: panY });
      initialCenterDoneRef.current = true;
    }, 100);
    
    return () => clearTimeout(timer);
  }, [preloaded]);

  // Auto-center view when agents change count, on first load, or when container resizes
  useEffect(() => {
    if (!preloaded) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const centerView = () => {
      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      // Skip if container has no size yet
      if (containerWidth === 0 || containerHeight === 0) return;
      
      // Get bounds that include both main room and control room
      const bounds = getWorldBounds();
      
      // Calculate scale to fit everything - bounds already include margins
      const scaleX = containerWidth / bounds.width;
      const scaleY = containerHeight / bounds.height;
      const fitScale = Math.min(scaleX, scaleY, 0.95); // Cap at 95%
      
      // Ensure minimum scale so everything is visible
      const finalScale = Math.max(fitScale, 0.28);
      
      // Calculate pan to center everything
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const panX = containerWidth / 2 - centerX * finalScale;
      const panY = containerHeight / 2 - centerY * finalScale;
      
      setScale(finalScale);
      setPan({ x: panX, y: panY });
      prevAgentCountRef.current = agents.length;
    };
    
    // Center immediately (always center on load, even without agents)
    centerView();
    
    // Also re-center when container size changes (e.g., panel opens)
    const resizeObserver = new ResizeObserver(() => {
      centerView();
    });
    resizeObserver.observe(container);
    
    // Also handle window resize
    const handleWindowResize = () => centerView();
    window.addEventListener("resize", handleWindowResize);
    
    // Re-center after a short delay to ensure panel animation completes
    const delayedCenter = setTimeout(centerView, 350);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      clearTimeout(delayedCenter);
    };
  }, [preloaded, agents]);

  const drawBackground = useCallback(
    (g: unknown) => {
      const gr = g as { clear: () => void; setFillStyle: (o: object) => void; rect: (a: number, b: number, c: number, d: number) => void; fill: () => void };
      gr.clear();
      gr.setFillStyle({ color: WORLD_COLORS.background });
      const bounds = getWorldBounds();
      gr.rect(0, 0, bounds.width, bounds.height);
      gr.fill();
    },
    []
  );

  const handleBackgroundClick = useCallback(() => {
    onSelectAgent(null);
  }, [onSelectAgent]);

  if (!preloaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0a0e1a]">
        <span className="font-mono text-sm text-gray-500">Loading sprites...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
    >
      <Application
        resizeTo={containerRef}
        background={WORLD_COLORS.background}
        antialias
      >
        <pixiContainer x={pan.x} y={pan.y} scale={scale}>
          <pixiGraphics
            draw={drawBackground}
            eventMode="static"
            onTap={handleBackgroundClick}
            onClick={handleBackgroundClick}
          />
          <FloorLayer />
          {/* Furniture (tables, chairs) behind agents */}
          <FurnitureLayer />
          {/* Agents and characters */}
          <EntityLayer
            selectedAgentId={selectedAgentId}
            onSelectAgent={onSelectAgent}
            getAgentStatus={getAgentStatus}
            patrolSelection={patrolSelection}
            onPatrolSelect={onPatrolSelect}
            agents={agents}
            response={response}
          />
          {/* Monitors in front of agents */}
          <MonitorLayer />
          {/* Effects on top */}
          <EffectsLayer />
        </pixiContainer>
      </Application>
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
          className="rounded border border-[#374151] bg-[#1a1f2e] px-2 py-1 text-sm text-white hover:bg-[#2a2f3e]"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.4, s - 0.1))}
          className="rounded border border-[#374151] bg-[#1a1f2e] px-2 py-1 text-sm text-white hover:bg-[#2a2f3e]"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            const container = containerRef.current;
            if (container) {
              const rect = container.getBoundingClientRect();
              const bounds = getWorldBounds();
              const newScale = Math.min(
                Math.max(Math.min(
                  rect.width / bounds.width,
                  rect.height / bounds.height
                ), 0.28),
                0.95
              );
              const centerX = bounds.x + bounds.width / 2;
              const centerY = bounds.y + bounds.height / 2;
              setPan({
                x: rect.width / 2 - centerX * newScale,
                y: rect.height / 2 - centerY * newScale,
              });
              setScale(newScale);
            }
          }}
          className="rounded border border-[#374151] bg-[#1a1f2e] px-2 py-1 text-xs text-white hover:bg-[#2a2f3e]"
        >
          ⌂
        </button>
      </div>
    </div>
  );
}
