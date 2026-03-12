/**
 * Simplified room layout for openclaw: one main room with dynamic desk grid for N agents,
 * control room with investigator home. No quarantine/entertainment.
 */
const S = 3;
const COLS = 4; // Fewer columns for better fit
const MAX_AGENTS = 12; // Max 12 agents to fit in room

export const WORLD_WIDTH = 1200 * S;
export const WORLD_HEIGHT = 900 * S;

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

// Main room - positioned to fit within view with control room
const MAIN_ROOM_X = 100 * S;
const MAIN_ROOM_Y = 60 * S;
const MAIN_ROOM_W = 500 * S;
const MAIN_ROOM_H = 320 * S;
const DESK_STEP_X = 100 * S;
const DESK_STEP_Y = 70 * S;
const DESK_START_X = MAIN_ROOM_X + 50 * S;
const DESK_START_Y = MAIN_ROOM_Y + 50 * S;

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

export const controlRoom = {
  x: 650 * S,
  y: 60 * S,
  width: 250 * S,
  height: 200 * S,
  investigatorPositions: [
    { id: "f1", x: 775 * S, y: 160 * S },
  ],
};

export const patrolWaypoints = [
  { x: MAIN_ROOM_X + 40 * S, y: MAIN_ROOM_Y + MAIN_ROOM_H / 2 },
  { x: MAIN_ROOM_X + MAIN_ROOM_W - 40 * S, y: MAIN_ROOM_Y + MAIN_ROOM_H / 2 },
  { x: MAIN_ROOM_X + MAIN_ROOM_W / 2, y: MAIN_ROOM_Y + 40 * S },
  { x: MAIN_ROOM_X + MAIN_ROOM_W / 2, y: MAIN_ROOM_Y + MAIN_ROOM_H - 40 * S },
];

/** Get bounding box that includes both main room and control room */
export function getWorldBounds() {
  const minX = Math.min(MAIN_ROOM_X, controlRoom.x);
  const minY = Math.min(MAIN_ROOM_Y, controlRoom.y);
  const maxX = Math.max(MAIN_ROOM_X + MAIN_ROOM_W, controlRoom.x + controlRoom.width);
  const maxY = Math.max(MAIN_ROOM_Y + MAIN_ROOM_H, controlRoom.y + controlRoom.height);
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
