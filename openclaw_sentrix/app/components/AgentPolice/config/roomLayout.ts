/**
 * Simplified room layout for openclaw: one main room with dynamic desk grid for N agents,
 * control room with investigator home. No quarantine/entertainment.
 * Layout: Vertical stack with control room below main room, with proper margins.
 */
const S = 3;
const COLS = 4; // Fewer columns for better fit
const MAX_AGENTS = 12; // Max 12 agents to fit in room

// Margins around the world
const MARGIN_X = 60 * S;
const MARGIN_Y = 50 * S;
const GAP_BETWEEN_ROOMS = 30 * S;

export const WORLD_WIDTH = 600 * S + MARGIN_X * 2;
export const WORLD_HEIGHT = 700 * S + MARGIN_Y * 2;

export interface DeskPosition {
  agentId: string;
  x: number;
  y: number;
}

export interface RoomConfig {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  desks: DeskPosition[];
}

// Main room - at the top with margins
const MAIN_ROOM_W = 480 * S;
const MAIN_ROOM_H = 300 * S;
const MAIN_ROOM_X = MARGIN_X;
const MAIN_ROOM_Y = MARGIN_Y;

const DESK_STEP_X = 100 * S;
const DESK_STEP_Y = 70 * S;
const DESK_START_X = MAIN_ROOM_X + 40 * S;
const DESK_START_Y = MAIN_ROOM_Y + 45 * S;

const mainRoomDesks: DeskPosition[] = [];
for (let i = 0; i < MAX_AGENTS; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  mainRoomDesks.push({
    agentId: `slot-${i}`,
    x: DESK_START_X + col * DESK_STEP_X,
    y: DESK_START_Y + row * DESK_STEP_Y,
  });
}

export const rooms: RoomConfig[] = [
  {
    id: "main",
    name: "Agents",
    x: MAIN_ROOM_X,
    y: MAIN_ROOM_Y,
    width: MAIN_ROOM_W,
    height: MAIN_ROOM_H,
    desks: mainRoomDesks,
  },
];

// Control room - below main room
const CONTROL_ROOM_W = 300 * S;
const CONTROL_ROOM_H = 120 * S;
const CONTROL_ROOM_X = MAIN_ROOM_X + (MAIN_ROOM_W - CONTROL_ROOM_W) / 2; // Centered under main
const CONTROL_ROOM_Y = MAIN_ROOM_Y + MAIN_ROOM_H + GAP_BETWEEN_ROOMS;

export const controlRoom = {
  x: CONTROL_ROOM_X,
  y: CONTROL_ROOM_Y,
  width: CONTROL_ROOM_W,
  height: CONTROL_ROOM_H,
  investigatorPositions: [
    { id: "f1", x: CONTROL_ROOM_X + CONTROL_ROOM_W / 2, y: CONTROL_ROOM_Y + CONTROL_ROOM_H / 2 },
  ],
};

export const patrolWaypoints = [
  { x: MAIN_ROOM_X + 40 * S, y: MAIN_ROOM_Y + MAIN_ROOM_H / 2 },
  { x: MAIN_ROOM_X + MAIN_ROOM_W - 40 * S, y: MAIN_ROOM_Y + MAIN_ROOM_H / 2 },
  { x: MAIN_ROOM_X + MAIN_ROOM_W / 2, y: MAIN_ROOM_Y + 40 * S },
  { x: MAIN_ROOM_X + MAIN_ROOM_W / 2, y: MAIN_ROOM_Y + MAIN_ROOM_H - 40 * S },
];

/** Get bounding box that includes both main room and control room with margins */
export function getWorldBounds() {
  const minX = 0;
  const minY = 0;
  const maxX = MAIN_ROOM_X + MAIN_ROOM_W + MARGIN_X;
  const maxY = CONTROL_ROOM_Y + CONTROL_ROOM_H + MARGIN_Y;
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Get desk position for an agent by index in the agents array. */
export function getAgentDeskPosition(
  agentId: string,
  agents: Array<{ id: string }>
): { x: number; y: number } | null {
  const idx = agents.findIndex((a) => a.id === agentId);
  if (idx < 0 || idx >= rooms[0].desks.length) return null;
  const desk = rooms[0].desks[idx];
  return { x: desk.x, y: desk.y };
}

/** Simple straight-line path (no nav graph). */
export function findPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number }[] {
  return [{ x: startX, y: startY }, { x: endX, y: endY }];
}
