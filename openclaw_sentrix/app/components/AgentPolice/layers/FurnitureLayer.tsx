"use client";

import { useMemo } from "react";
import { rooms, controlRoom } from "../config/roomLayout";
import { FURNITURE_SPRITES, FURNITURE_SIZES } from "../config/spriteConfig";
import { useStaticTexture } from "../hooks/useStaticTexture";

const S = 3;

// ── Chair + Table (rendered BEFORE entities) ──

function DeskBase({ x, y }: { x: number; y: number }) {
  const tableTexture = useStaticTexture(FURNITURE_SPRITES.table);
  const chairTexture = useStaticTexture(FURNITURE_SPRITES.chair);

  if (!tableTexture || !chairTexture) return null;

  return (
    <pixiContainer>
      {/* Chair behind table - agent sits here */}
      <pixiSprite
        texture={chairTexture}
        x={x}
        y={y + 15 * S}
        anchor={0.5}
        width={FURNITURE_SIZES.chair.width * S}
        height={FURNITURE_SIZES.chair.height * S}
      />
      {/* Table in front of agent */}
      <pixiSprite
        texture={tableTexture}
        x={x}
        y={y + 28 * S}
        anchor={0.5}
        width={FURNITURE_SIZES.table.width * S}
        height={FURNITURE_SIZES.table.height * S}
      />
    </pixiContainer>
  );
}

function ControlRoomDeskBase() {
  const tableTexture = useStaticTexture(FURNITURE_SPRITES.table);
  const chairTexture = useStaticTexture(FURNITURE_SPRITES.chair);

  if (!tableTexture || !chairTexture) return null;

  const investigatorPos = controlRoom.investigatorPositions[0];
  if (!investigatorPos) return null;

  return (
    <pixiContainer>
      <pixiSprite
        texture={chairTexture}
        x={investigatorPos.x}
        y={investigatorPos.y + 12 * S}
        anchor={0.5}
        width={28 * S}
        height={28 * S}
      />
      <pixiSprite
        texture={tableTexture}
        x={investigatorPos.x}
        y={investigatorPos.y + 22 * S}
        anchor={0.5}
        width={70 * S}
        height={40 * S}
      />
    </pixiContainer>
  );
}

/** Chairs + tables — render BEFORE entities so agents appear on top */
export function FurnitureLayer() {
  const deskBases = useMemo(() => {
    return rooms.flatMap((room) =>
      room.desks.map((desk) => (
        <DeskBase key={`desk-${desk.agentId}`} x={desk.x} y={desk.y} />
      ))
    );
  }, []);

  return (
    <pixiContainer>
      {deskBases}
      <ControlRoomDeskBase />
    </pixiContainer>
  );
}

// ── Monitors (rendered AFTER entities so they appear in front of agents) ──

function DeskMonitor({ x, y }: { x: number; y: number }) {
  const monitorTexture = useStaticTexture(FURNITURE_SPRITES.monitor);

  if (!monitorTexture) return null;

  return (
    <pixiSprite
      texture={monitorTexture}
      x={x}
      y={y + 14 * S}
      anchor={0.5}
      width={FURNITURE_SIZES.monitor.width * S}
      height={FURNITURE_SIZES.monitor.height * S}
    />
  );
}

function ControlRoomMonitor() {
  const monitorTexture = useStaticTexture(FURNITURE_SPRITES.monitor);

  if (!monitorTexture) return null;

  const investigatorPos = controlRoom.investigatorPositions[0];
  if (!investigatorPos) return null;

  return (
    <pixiSprite
      texture={monitorTexture}
      x={investigatorPos.x}
      y={investigatorPos.y + 8 * S}
      anchor={0.5}
      width={FURNITURE_SIZES.monitor.width * S}
      height={FURNITURE_SIZES.monitor.height * S}
    />
  );
}

/** Monitors — render AFTER entities so agents appear behind monitors */
export function MonitorLayer() {
  const deskMonitors = useMemo(() => {
    return rooms.flatMap((room) =>
      room.desks.map((desk) => (
        <DeskMonitor key={`monitor-${desk.agentId}`} x={desk.x} y={desk.y} />
      ))
    );
  }, []);

  return (
    <pixiContainer>
      {deskMonitors}
      <ControlRoomMonitor />
    </pixiContainer>
  );
}
