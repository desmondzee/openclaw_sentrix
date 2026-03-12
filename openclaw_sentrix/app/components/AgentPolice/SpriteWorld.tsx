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
import { WORLD_WIDTH, WORLD_HEIGHT, rooms } from "./config/roomLayout";
import { FloorLayer } from "./layers/FloorLayer";
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
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    preloadEssentialSprites().then(() => {
      setPreloaded(true);
      preloadAllSprites();
    });
  }, []);

  // Auto-center view on the main room when agents are first loaded
  useEffect(() => {
    if (!preloaded || hasCenteredRef.current || agents.length === 0) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    
    // Calculate scale to fit the main room with some padding
    const padding = 100;
    const roomWidth = rooms[0].width + padding * 2;
    const roomHeight = rooms[0].height + padding * 2;
    const scaleX = containerWidth / roomWidth;
    const scaleY = containerHeight / roomHeight;
    const fitScale = Math.min(scaleX, scaleY, 1); // Cap at 1 (100%)
    
    // Ensure minimum scale so agents are visible
    const finalScale = Math.max(fitScale, 0.4);
    
    // Calculate pan to center the main room
    const centerX = rooms[0].x + rooms[0].width / 2;
    const centerY = rooms[0].y + rooms[0].height / 2;
    const panX = containerWidth / 2 - centerX * finalScale;
    const panY = containerHeight / 2 - centerY * finalScale;
    
    setScale(finalScale);
    setPan({ x: panX, y: panY });
    hasCenteredRef.current = true;
  }, [preloaded, agents]);

  const drawBackground = useCallback(
    (g: unknown) => {
      const gr = g as { clear: () => void; setFillStyle: (o: object) => void; rect: (a: number, b: number, c: number, d: number) => void; fill: () => void };
      gr.clear();
      gr.setFillStyle({ color: WORLD_COLORS.background });
      gr.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
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
          <EffectsLayer />
          <EntityLayer
            selectedAgentId={selectedAgentId}
            onSelectAgent={onSelectAgent}
            getAgentStatus={getAgentStatus}
            patrolSelection={patrolSelection}
            onPatrolSelect={onPatrolSelect}
            agents={agents}
            response={response}
          />
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
              const centerX = rooms[0].x + rooms[0].width / 2;
              const centerY = rooms[0].y + rooms[0].height / 2;
              const newScale = Math.min(
                Math.max(Math.min(rect.width / (rooms[0].width + 200), rect.height / (rooms[0].height + 200)), 0.4),
                1
              );
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
