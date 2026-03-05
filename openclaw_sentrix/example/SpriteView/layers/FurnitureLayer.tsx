'use client';

import { rooms, controlRoom, entertainmentRoom } from '../config/roomLayout';
import { FURNITURE_SPRITES, FURNITURE_SIZES } from '../config/spriteConfig';
import { useStaticTexture } from '../hooks/useStaticTexture';

const S = 3;

// ── Chair + Table (rendered BEFORE entities) ──

function DeskBase({ x, y }: { x: number; y: number }) {
  const tableTexture = useStaticTexture(FURNITURE_SPRITES.table);
  const chairTexture = useStaticTexture(FURNITURE_SPRITES.chair);

  if (!tableTexture || !chairTexture) return null;

  return (
    <pixiContainer>
      {/* Chair behind table */}
      <pixiSprite
        texture={chairTexture}
        x={x}
        y={y + 18 * S}
        anchor={0.5}
        width={FURNITURE_SIZES.chair.width}
        height={FURNITURE_SIZES.chair.height}
      />
      {/* Table */}
      <pixiSprite
        texture={tableTexture}
        x={x}
        y={y + 32 * S}
        anchor={0.5}
        width={FURNITURE_SIZES.table.width}
        height={FURNITURE_SIZES.table.height}
      />
    </pixiContainer>
  );
}

function SuperintendentDeskBase() {
  const tableTexture = useStaticTexture(FURNITURE_SPRITES.table);
  const chairTexture = useStaticTexture(FURNITURE_SPRITES.chair);

  if (!tableTexture || !chairTexture) return null;

  const { superintendentPos } = controlRoom;

  return (
    <pixiContainer>
      <pixiSprite
        texture={chairTexture}
        x={superintendentPos.x}
        y={superintendentPos.y + 15 * S}
        anchor={0.5}
        width={28 * S}
        height={28 * S}
      />
      <pixiSprite
        texture={tableTexture}
        x={superintendentPos.x}
        y={superintendentPos.y + 25 * S}
        anchor={0.5}
        width={80 * S}
        height={45 * S}
      />
    </pixiContainer>
  );
}

function EntertainmentSeats() {
  const chairTexture = useStaticTexture(FURNITURE_SPRITES.chair);

  if (!chairTexture) return null;

  return (
    <pixiContainer>
      {entertainmentRoom.seats.map((seat) => (
        <pixiSprite
          key={seat.slotIndex}
          texture={chairTexture}
          x={seat.x}
          y={seat.y + 10 * S}
          anchor={0.5}
          width={30 * S}
          height={30 * S}
        />
      ))}
    </pixiContainer>
  );
}

/** Chairs + tables — render BEFORE entities */
export function FurnitureLayer() {
  return (
    <pixiContainer>
      {rooms.flatMap((room) =>
        room.desks.map((desk) => (
          <DeskBase key={desk.agentId} x={desk.x} y={desk.y} />
        )),
      )}
      <SuperintendentDeskBase />
      <EntertainmentSeats />
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
      y={y + 16 * S}
      anchor={0.5}
      width={FURNITURE_SIZES.monitor.width}
      height={FURNITURE_SIZES.monitor.height}
    />
  );
}

function SuperintendentMonitors() {
  const monitorTexture = useStaticTexture(FURNITURE_SPRITES.monitor);

  if (!monitorTexture) return null;

  const { superintendentPos } = controlRoom;

  return (
    <pixiContainer>
      {[0, 1, 2].map((i) => (
        <pixiSprite
          key={i}
          texture={monitorTexture}
          x={superintendentPos.x - 22 * S + i * 22 * S}
          y={superintendentPos.y + 10 * S}
          anchor={0.5}
          width={18 * S}
          height={14 * S}
        />
      ))}
    </pixiContainer>
  );
}

/** Monitors — render AFTER entities so agents appear behind monitors */
export function MonitorLayer() {
  return (
    <pixiContainer>
      {rooms.flatMap((room) =>
        room.desks.map((desk) => (
          <DeskMonitor key={desk.agentId} x={desk.x} y={desk.y} />
        )),
      )}
      <SuperintendentMonitors />
    </pixiContainer>
  );
}
