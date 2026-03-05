'use client';

import { useCallback } from 'react';
import {
  rooms,
  controlRoom,
  quarantineRoom,
  entertainmentRoom,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '../config/roomLayout';
import { WORLD_COLORS, FLOOR_SPRITES, FLOOR_TILE_SIZE } from '../config/spriteConfig';
import { useStaticTexture } from '../hooks/useStaticTexture';

// ── Background + borders (no room fill — tiles go on top) ────────────────────

function RoomBorders() {
  const draw = useCallback((g: any) => {
    g.clear();

    // World background
    g.setFillStyle({ color: WORLD_COLORS.background });
    g.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    g.fill();

    // Corridor areas (scaled ×3 with world)
    g.setFillStyle({ color: WORLD_COLORS.corridor });
    g.rect(0, 320 * 3, WORLD_WIDTH, 260 * 3);
    g.fill();
    g.rect(680 * 3, 0, 240 * 3, WORLD_HEIGHT);
    g.fill();

    // Host machine room borders
    for (const room of rooms) {
      g.setStrokeStyle({ width: 2, color: WORLD_COLORS.roomBorder });
      g.roundRect(room.x, room.y, room.width, room.height, 8);
      g.stroke();
      g.setFillStyle({ color: WORLD_COLORS.roomBorder });
      g.roundRect(room.x + 10, room.y + 8, 140, 22, 4);
      g.fill();
    }

    // Control room border
    g.setStrokeStyle({ width: 2, color: WORLD_COLORS.controlRoomBorder });
    g.roundRect(controlRoom.x, controlRoom.y, controlRoom.width, controlRoom.height, 8);
    g.stroke();
    g.setFillStyle({ color: WORLD_COLORS.controlRoomBorder });
    g.roundRect(controlRoom.x + 10, controlRoom.y + 8, 120, 22, 4);
    g.fill();

    // Quarantine room border
    g.setStrokeStyle({ width: 2, color: WORLD_COLORS.quarantineBorder });
    g.roundRect(quarantineRoom.x, quarantineRoom.y, quarantineRoom.width, quarantineRoom.height, 8);
    g.stroke();
    g.setFillStyle({ color: WORLD_COLORS.quarantineBorder });
    g.roundRect(quarantineRoom.x + 10, quarantineRoom.y + 8, 100, 22, 4);
    g.fill();

    // Quarantine warning stripes
    g.setStrokeStyle({ width: 3, color: 0xff3355, alpha: 0.3 });
    for (let i = 0; i < 10; i++) {
      const sx = quarantineRoom.x + 20 + i * 48;
      g.moveTo(sx, quarantineRoom.y);
      g.lineTo(sx + 20, quarantineRoom.y);
    }
    g.stroke();

    // Entertainment room border
    g.setStrokeStyle({ width: 2, color: WORLD_COLORS.entertainmentBorder });
    g.roundRect(entertainmentRoom.x, entertainmentRoom.y, entertainmentRoom.width, entertainmentRoom.height, 8);
    g.stroke();
    g.setFillStyle({ color: WORLD_COLORS.entertainmentBorder });
    g.roundRect(entertainmentRoom.x + 10, entertainmentRoom.y + 8, 140, 22, 4);
    g.fill();
  }, []);

  return <pixiGraphics draw={draw} />;
}

// ── Tiled floor (rendered on top of background, under borders) ────────────────

interface TiledFloorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  spriteKey: keyof typeof FLOOR_SPRITES;
}

function TiledFloor({ x, y, width, height, spriteKey }: TiledFloorProps) {
  const texture = useStaticTexture(FLOOR_SPRITES[spriteKey]);
  if (!texture) return null;

  return (
    <pixiTilingSprite
      texture={texture}
      x={x}
      y={y}
      width={width}
      height={height}
      tileScale={{ x: FLOOR_TILE_SIZE / texture.width, y: FLOOR_TILE_SIZE / texture.height }}
      alpha={0.25}
    />
  );
}

// ── Border-only overlay (stroke + label chips) ────────────────────────────────

function RoomBorderOverlay() {
  const draw = useCallback((g: any) => {
    g.clear();

    for (const room of rooms) {
      g.setStrokeStyle({ width: 2, color: WORLD_COLORS.roomBorder });
      g.roundRect(room.x, room.y, room.width, room.height, 8);
      g.stroke();
      g.setFillStyle({ color: WORLD_COLORS.roomBorder });
      g.roundRect(room.x + 10, room.y + 8, 140, 22, 4);
      g.fill();
    }

    g.setStrokeStyle({ width: 2, color: WORLD_COLORS.controlRoomBorder });
    g.roundRect(controlRoom.x, controlRoom.y, controlRoom.width, controlRoom.height, 8);
    g.stroke();
    g.setFillStyle({ color: WORLD_COLORS.controlRoomBorder });
    g.roundRect(controlRoom.x + 10, controlRoom.y + 8, 120, 22, 4);
    g.fill();

    g.setStrokeStyle({ width: 2, color: WORLD_COLORS.quarantineBorder });
    g.roundRect(quarantineRoom.x, quarantineRoom.y, quarantineRoom.width, quarantineRoom.height, 8);
    g.stroke();
    g.setFillStyle({ color: WORLD_COLORS.quarantineBorder });
    g.roundRect(quarantineRoom.x + 10, quarantineRoom.y + 8, 100, 22, 4);
    g.fill();

    g.setStrokeStyle({ width: 2, color: WORLD_COLORS.entertainmentBorder });
    g.roundRect(entertainmentRoom.x, entertainmentRoom.y, entertainmentRoom.width, entertainmentRoom.height, 8);
    g.stroke();
    g.setFillStyle({ color: WORLD_COLORS.entertainmentBorder });
    g.roundRect(entertainmentRoom.x + 10, entertainmentRoom.y + 8, 140, 22, 4);
    g.fill();
  }, []);

  return <pixiGraphics draw={draw} />;
}

// ── FloorLayer ────────────────────────────────────────────────────────────────

export function FloorLayer() {
  return (
    <pixiContainer>
      {/* 1. World background + corridors */}
      <RoomBorders />

      {/* 2. Tiled floors on top of background */}
      {rooms.map((room) => (
        <TiledFloor
          key={room.id}
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          spriteKey="room"
        />
      ))}
      <TiledFloor
        x={controlRoom.x}
        y={controlRoom.y}
        width={controlRoom.width}
        height={controlRoom.height}
        spriteKey="room"
      />
      <TiledFloor
        x={entertainmentRoom.x}
        y={entertainmentRoom.y}
        width={entertainmentRoom.width}
        height={entertainmentRoom.height}
        spriteKey="room"
      />
      <TiledFloor
        x={quarantineRoom.x}
        y={quarantineRoom.y}
        width={quarantineRoom.width}
        height={quarantineRoom.height}
        spriteKey="quarantine"
      />

      {/* 3. Border strokes + label chips on top of tiles */}
      <RoomBorderOverlay />
    </pixiContainer>
  );
}
