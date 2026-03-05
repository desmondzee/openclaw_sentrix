'use client';

import { useCallback } from 'react';
import { rooms, controlRoom, quarantineRoom, entertainmentRoom } from '../config/roomLayout';
import { WORLD_COLORS } from '../config/spriteConfig';

const S = 3;
const WALL_THICKNESS = 4 * S;
const WALL_COLOR = 0x374151;
const DOOR_WIDTH = 50 * S;

interface DoorConfig {
  top?: number;    // center x of door on top wall
  bottom?: number; // center x of door on bottom wall
  left?: number;   // center y of door on left wall
  right?: number;  // center y of door on right wall
}

function RoomWalls({
  x,
  y,
  width,
  height,
  color = WALL_COLOR,
  doors = {},
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: number;
  doors?: DoorConfig;
}) {
  const draw = useCallback(
    (g: any) => {
      g.clear();
      g.setFillStyle({ color });

      // Top wall
      if (doors.top !== undefined) {
        const cx = doors.top;
        const gapStart = cx - DOOR_WIDTH / 2;
        const gapEnd = cx + DOOR_WIDTH / 2;
        if (gapStart > x) g.rect(x, y, gapStart - x, WALL_THICKNESS);
        if (gapEnd < x + width) g.rect(gapEnd, y, x + width - gapEnd, WALL_THICKNESS);
      } else {
        g.rect(x, y, width, WALL_THICKNESS);
      }
      g.fill();

      // Bottom wall
      if (doors.bottom !== undefined) {
        const cx = doors.bottom;
        const gapStart = cx - DOOR_WIDTH / 2;
        const gapEnd = cx + DOOR_WIDTH / 2;
        if (gapStart > x) g.rect(x, y + height - WALL_THICKNESS, gapStart - x, WALL_THICKNESS);
        if (gapEnd < x + width) g.rect(gapEnd, y + height - WALL_THICKNESS, x + width - gapEnd, WALL_THICKNESS);
      } else {
        g.rect(x, y + height - WALL_THICKNESS, width, WALL_THICKNESS);
      }
      g.fill();

      // Left wall
      if (doors.left !== undefined) {
        const cy = doors.left;
        const gapStart = cy - DOOR_WIDTH / 2;
        const gapEnd = cy + DOOR_WIDTH / 2;
        if (gapStart > y) g.rect(x, y, WALL_THICKNESS, gapStart - y);
        if (gapEnd < y + height) g.rect(x, gapEnd, WALL_THICKNESS, y + height - gapEnd);
      } else {
        g.rect(x, y, WALL_THICKNESS, height);
      }
      g.fill();

      // Right wall
      if (doors.right !== undefined) {
        const cy = doors.right;
        const gapStart = cy - DOOR_WIDTH / 2;
        const gapEnd = cy + DOOR_WIDTH / 2;
        if (gapStart > y) g.rect(x + width - WALL_THICKNESS, y, WALL_THICKNESS, gapStart - y);
        if (gapEnd < y + height) g.rect(x + width - WALL_THICKNESS, gapEnd, WALL_THICKNESS, y + height - gapEnd);
      } else {
        g.rect(x + width - WALL_THICKNESS, y, WALL_THICKNESS, height);
      }
      g.fill();
    },
    [x, y, width, height, color, doors],
  );

  return <pixiGraphics draw={draw} />;
}

// Door positions derived from scaled room coords — mid-point of each corridor-facing wall
const hm1Doors: DoorConfig = {
  right:  40 * S + (280 * S) / 2,
  bottom: 240 * S + (440 * S) / 2,
};

const hm2Doors: DoorConfig = {
  left:   40 * S + (280 * S) / 2,
  bottom: 920 * S + (440 * S) / 2,
};

const hm3Doors: DoorConfig = {
  right: 580 * S + (280 * S) / 2,
  top:   240 * S + (440 * S) / 2,
};

const hm4Doors: DoorConfig = {
  left: 580 * S + (280 * S) / 2,
  top:  920 * S + (440 * S) / 2,
};

const roomDoors: Record<string, DoorConfig> = {
  'cluster-1': hm1Doors,
  'cluster-2': hm2Doors,
  'cluster-3': hm3Doors,
  'cluster-4': hm4Doors,
};

function EntertainmentWalls() {
  const { x, y, width, height } = entertainmentRoom;
  const color = WORLD_COLORS.entertainmentBorder;

  const door1Y = 40 * S + (280 * S) / 2;  // HM1 mid-y
  const door2Y = 580 * S + (280 * S) / 2; // HM3 mid-y

  const draw = useCallback(
    (g: any) => {
      g.clear();
      g.setFillStyle({ color });

      g.rect(x, y, width, WALL_THICKNESS);
      g.fill();

      g.rect(x, y + height - WALL_THICKNESS, width, WALL_THICKNESS);
      g.fill();

      g.rect(x, y, WALL_THICKNESS, height);
      g.fill();

      const segments = buildWallSegments(y, y + height, [door1Y, door2Y], DOOR_WIDTH);
      for (const [start, end] of segments) {
        g.rect(x + width - WALL_THICKNESS, start, WALL_THICKNESS, end - start);
      }
      g.fill();
    },
    [x, y, width, height, color],
  );

  return <pixiGraphics draw={draw} />;
}

function buildWallSegments(
  wallStart: number,
  wallEnd: number,
  doorCenters: number[],
  doorWidth: number,
): [number, number][] {
  const gaps = doorCenters
    .map((c) => [c - doorWidth / 2, c + doorWidth / 2] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const segments: [number, number][] = [];
  let cursor = wallStart;
  for (const [gapStart, gapEnd] of gaps) {
    if (gapStart > cursor) segments.push([cursor, gapStart]);
    cursor = gapEnd;
  }
  if (cursor < wallEnd) segments.push([cursor, wallEnd]);
  return segments;
}

const controlDoors: DoorConfig = {
  top:    620 * S + (360 * S) / 2,
  bottom: 620 * S + (360 * S) / 2,
  left:   370 * S + (160 * S) / 2,
  right:  370 * S + (160 * S) / 2,
};

const quarantineDoors: DoorConfig = {
  top: 550 * S + (500 * S) / 2,
};

export function WallsLayer() {
  return (
    <pixiContainer>
      {rooms.map((room) => (
        <RoomWalls
          key={room.id}
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          doors={roomDoors[room.id] ?? {}}
        />
      ))}
      <RoomWalls
        x={controlRoom.x}
        y={controlRoom.y}
        width={controlRoom.width}
        height={controlRoom.height}
        color={WORLD_COLORS.controlRoomBorder}
        doors={controlDoors}
      />
      <RoomWalls
        x={quarantineRoom.x}
        y={quarantineRoom.y}
        width={quarantineRoom.width}
        height={quarantineRoom.height}
        color={WORLD_COLORS.quarantineBorder}
        doors={quarantineDoors}
      />
      <EntertainmentWalls />
    </pixiContainer>
  );
}
