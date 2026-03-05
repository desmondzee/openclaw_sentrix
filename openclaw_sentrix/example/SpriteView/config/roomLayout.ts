const S = 3; // global scale factor — multiply all world coordinates by this

export const WORLD_WIDTH = 1400 * S;
export const WORLD_HEIGHT = 1050 * S;

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

export const rooms: RoomConfig[] = [
  {
    id: 'cluster-1',
    name: 'Host Machine 1',
    x: 240 * S,
    y: 40 * S,
    width: 440 * S,
    height: 280 * S,
    desks: [
      { agentId: 'c1-email',    x: 300 * S, y: 120 * S },
      { agentId: 'c1-coding',   x: 460 * S, y: 120 * S },
      { agentId: 'c1-browser',  x: 620 * S, y: 120 * S },
      { agentId: 'c1-document', x: 300 * S, y: 230 * S },
      { agentId: 'c1-data',     x: 460 * S, y: 230 * S },
      { agentId: 'c1-research', x: 620 * S, y: 230 * S },
    ],
  },
  {
    id: 'cluster-2',
    name: 'Host Machine 2',
    x: 920 * S,
    y: 40 * S,
    width: 440 * S,
    height: 280 * S,
    desks: [
      { agentId: 'c2-email',    x: 980 * S, y: 120 * S },
      { agentId: 'c2-coding',   x: 1140 * S, y: 120 * S },
      { agentId: 'c2-browser',  x: 1300 * S, y: 120 * S },
      { agentId: 'c2-document', x: 980 * S, y: 230 * S },
      { agentId: 'c2-data',     x: 1140 * S, y: 230 * S },
      { agentId: 'c2-research', x: 1300 * S, y: 230 * S },
    ],
  },
  {
    id: 'cluster-3',
    name: 'Host Machine 3',
    x: 240 * S,
    y: 580 * S,
    width: 440 * S,
    height: 280 * S,
    desks: [
      { agentId: 'c3-email',    x: 300 * S, y: 660 * S },
      { agentId: 'c3-coding',   x: 460 * S, y: 660 * S },
      { agentId: 'c3-browser',  x: 620 * S, y: 660 * S },
      { agentId: 'c3-document', x: 300 * S, y: 770 * S },
      { agentId: 'c3-data',     x: 460 * S, y: 770 * S },
      { agentId: 'c3-research', x: 620 * S, y: 770 * S },
    ],
  },
  {
    id: 'cluster-4',
    name: 'Host Machine 4',
    x: 920 * S,
    y: 580 * S,
    width: 440 * S,
    height: 280 * S,
    desks: [
      { agentId: 'c4-email',    x: 980 * S, y: 660 * S },
      { agentId: 'c4-coding',   x: 1140 * S, y: 660 * S },
      { agentId: 'c4-browser',  x: 1300 * S, y: 660 * S },
      { agentId: 'c4-document', x: 980 * S, y: 770 * S },
      { agentId: 'c4-data',     x: 1140 * S, y: 770 * S },
      { agentId: 'c4-research', x: 1300 * S, y: 770 * S },
    ],
  },
];

export const controlRoom = {
  x: 620 * S,
  y: 370 * S,
  width: 360 * S,
  height: 160 * S,
  superintendentPos: { x: 800 * S, y: 430 * S },
  networkPos:        { x: 700 * S, y: 420 * S },
  investigatorPositions: [
    { id: 'f1', x: 700 * S, y: 470 * S },
    { id: 'f2', x: 900 * S, y: 470 * S },
  ],
};

// Doorway centers — must match WallsLayer.tsx door positions exactly
// HM1 (x=720,y=120,w=1320,h=840): right door y=540, bottom door x=1380
// HM2 (x=2760,y=120,w=1320,h=840): left door y=540, bottom door x=3420
// HM3 (x=720,y=1740,w=1320,h=840): right door y=2160, top door x=1380
// HM4 (x=2760,y=1740,w=1320,h=840): left door y=2160, top door x=3420
const MARGIN = 22 * S;

// Inner perimeter corners for each room
const HM1 = { x: 240 * S, y: 40 * S, w: 440 * S, h: 280 * S };
const HM2 = { x: 920 * S, y: 40 * S, w: 440 * S, h: 280 * S };
const HM3 = { x: 240 * S, y: 580 * S, w: 440 * S, h: 280 * S };
const HM4 = { x: 920 * S, y: 580 * S, w: 440 * S, h: 280 * S };

function innerCorners(r: { x: number; y: number; w: number; h: number }) {
  return {
    tl: { x: r.x + MARGIN, y: r.y + MARGIN },
    tr: { x: r.x + r.w - MARGIN, y: r.y + MARGIN },
    br: { x: r.x + r.w - MARGIN, y: r.y + r.h - MARGIN },
    bl: { x: r.x + MARGIN, y: r.y + r.h - MARGIN },
  };
}

const c1 = innerCorners(HM1);
const c2 = innerCorners(HM2);
const c3 = innerCorners(HM3);
const c4 = innerCorners(HM4);

const DOOR_INSET = 28 * S;

const doors = {
  hm1Right:  { x: HM1.x + HM1.w - DOOR_INSET, y: HM1.y + HM1.h / 2 },
  hm1Bottom: { x: HM1.x + HM1.w / 2, y: HM1.y + HM1.h - DOOR_INSET },
  hm2Left:   { x: HM2.x + DOOR_INSET, y: HM2.y + HM2.h / 2 },
  hm2Bottom: { x: HM2.x + HM2.w / 2, y: HM2.y + HM2.h - DOOR_INSET },
  hm3Right:  { x: HM3.x + HM3.w - DOOR_INSET, y: HM3.y + HM3.h / 2 },
  hm3Top:    { x: HM3.x + HM3.w / 2, y: HM3.y + DOOR_INSET },
  hm4Left:   { x: HM4.x + DOOR_INSET, y: HM4.y + HM4.h / 2 },
  hm4Top:    { x: HM4.x + HM4.w / 2, y: HM4.y + DOOR_INSET },
};

const corridor = {
  topMid:      { x: 800 * S, y: 180 * S },
  botMid:      { x: 800 * S, y: 720 * S },
  rightMidTop: { x: 1140 * S, y: 450 * S },
  leftMidBot:  { x: 460 * S,  y: 450 * S },
  leftColTop:  { x: 460 * S,  y: 340 * S },
  leftColBot:  { x: 460 * S,  y: 560 * S },
  rightColTop: { x: 1140 * S, y: 340 * S },
  rightColBot: { x: 1140 * S, y: 560 * S },
};

export const patrolWaypoints = [
  // ── Host Machine 1: start top-left, full clockwise inner perimeter ──
  c1.tl,
  c1.tr,
  c1.br,
  doors.hm1Right,
  // exit HM1 right → top corridor → enter HM2 left
  { x: HM1.x + HM1.w, y: HM1.y + HM1.h / 2 },
  corridor.topMid,
  { x: HM2.x, y: HM2.y + HM2.h / 2 },
  // ── Host Machine 2: enter left, full clockwise inner perimeter ──
  doors.hm2Left,
  c2.tl,
  c2.tr,
  c2.br,
  c2.bl,
  doors.hm2Bottom,
  // exit HM2 bottom → right corridor → enter HM4 top
  { x: HM2.x + HM2.w / 2, y: HM2.y + HM2.h },
  corridor.rightColTop,
  corridor.rightColBot,
  { x: HM4.x + HM4.w / 2, y: HM4.y },
  // ── Host Machine 4: enter top, full clockwise inner perimeter ──
  doors.hm4Top,
  c4.tl,
  c4.tr,
  c4.br,
  c4.bl,
  doors.hm4Left,
  // exit HM4 left → bottom corridor → enter HM3 right
  { x: HM4.x, y: HM4.y + HM4.h / 2 },
  corridor.botMid,
  { x: HM3.x + HM3.w, y: HM3.y + HM3.h / 2 },
  // ── Host Machine 3: enter right, full clockwise inner perimeter ──
  doors.hm3Right,
  c3.tr,
  c3.tl,
  c3.bl,
  c3.br,
  doors.hm3Top,
  // exit HM3 top → left corridor → enter HM1 bottom
  { x: HM3.x + HM3.w / 2, y: HM3.y },
  corridor.leftColBot,
  corridor.leftColTop,
  { x: HM1.x + HM1.w / 2, y: HM1.y + HM1.h },
  // ── Back into HM1: enter bottom, return to top-left to close loop ──
  doors.hm1Bottom,
  c1.bl,
];

// Quarantine room - bottom center, between rooms 3 and 4
export const quarantineRoom = {
  x: 550 * S,
  y: 900 * S,
  width: 500 * S,
  height: 200 * S,
  cells: Array.from({ length: 16 }, (_, i) => ({
    slotIndex: i,
    x: 600 * S + (i % 8) * 55 * S,
    y: 935 * S + Math.floor(i / 8) * 50 * S,
  })),
};

export function getQuarantineCellPosition(slotIndex: number): { x: number; y: number } {
  const cell = quarantineRoom.cells[slotIndex];
  return cell ? { x: cell.x, y: cell.y } : { x: quarantineRoom.x + 50 * S, y: quarantineRoom.y + 40 * S };
}

// Entertainment room - left side
export const entertainmentRoom = {
  x: 40 * S,
  y: 40 * S,
  width: 160 * S,
  height: 820 * S,
  seats: Array.from({ length: 8 }, (_, i) => ({
    slotIndex: i,
    x: 120 * S,
    y: 120 * S + i * 95 * S,
  })),
};

export function getEntertainmentSeatPosition(slotIndex: number): { x: number; y: number } {
  const seat = entertainmentRoom.seats[slotIndex];
  return seat ? { x: seat.x, y: seat.y } : { x: entertainmentRoom.x + 80 * S, y: entertainmentRoom.y + 40 * S };
}

export function getDeskPosition(agentId: string): { x: number; y: number } | null {
  for (const room of rooms) {
    const desk = room.desks.find((d) => d.agentId === agentId);
    if (desk) return { x: desk.x, y: desk.y };
  }
  return null;
}

/** Role order for consistent desk assignment (matches EntityLayer) */
const ROLE_ORDER: Record<string, number> = {
  EMAIL_AGENT: 0,
  CODING_AGENT: 1,
  DOCUMENT_AGENT: 2,
  DATA_QUERY_AGENT: 3,
};

/** Agent shape needed for desk resolution (avoids circular imports) */
interface AgentForDesk {
  id: string;
  role: string;
  clusterId?: string;
}

/**
 * Resolve agent desk position for both mock IDs (c1-email) and live API IDs (email_4).
 * Uses cluster + role to assign desk when agentId isn't in static room layout.
 */
export function getAgentDeskPosition(
  agentId: string,
  agents: AgentForDesk[],
): { x: number; y: number } | null {
  // First try static lookup (mock IDs)
  const staticPos = getDeskPosition(agentId);
  if (staticPos) return staticPos;

  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return null;

  // Resolve by cluster + role (live API)
  const normalizedCluster = (agent.clusterId ?? 'default').replace(/_/g, '-');
  for (const room of rooms) {
    if (room.id !== normalizedCluster) continue;
    const clusterAgents = agents
      .filter((a) => (a.clusterId ?? 'default').replace(/_/g, '-') === room.id)
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
    const idx = clusterAgents.findIndex((a) => a.id === agentId);
    if (idx >= 0 && idx < room.desks.length) {
      const d = room.desks[idx];
      return { x: d.x, y: d.y };
    }
  }

  // Fallback: agent exists but cluster didn't match — use first desk of first room
  const firstDesk = rooms[0]?.desks[0];
  return firstDesk ? { x: firstDesk.x, y: firstDesk.y } : null;
}

/**
 * Get the room ID that contains a given agent based on their desk assignment
 */
export function getAgentRoom(agentId: string): string | null {
  for (const room of rooms) {
    if (room.desks.some((d) => d.agentId === agentId)) {
      return room.id;
    }
  }
  return null;
}

/**
 * Navigation graph for pathfinding around walls
 * Each node has connections to reachable neighboring nodes
 */
export interface NavNode {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

// Build navigation nodes from existing waypoints and key positions
const navNodes: NavNode[] = [
  // Corridor intersection points
  { id: 'corridor-top', x: 800 * S, y: 180 * S, connections: ['hm1-door-right', 'hm2-door-left', 'corridor-center'] },
  { id: 'corridor-bottom', x: 800 * S, y: 720 * S, connections: ['hm3-door-right', 'hm4-door-left', 'corridor-center'] },
  { id: 'corridor-center', x: 800 * S, y: 450 * S, connections: ['corridor-top', 'corridor-bottom', 'corridor-left', 'corridor-right'] },
  { id: 'corridor-left', x: 460 * S, y: 450 * S, connections: ['corridor-center', 'hm1-door-bottom', 'hm3-door-top'] },
  { id: 'corridor-right', x: 1140 * S, y: 450 * S, connections: ['corridor-center', 'hm2-door-bottom', 'hm4-door-top'] },
  
  // HM1 (cluster-1) doors and interior
  { id: 'hm1-door-right', x: (240 + 440) * S, y: (40 + 140) * S, connections: ['corridor-top', 'hm1-interior'] },
  { id: 'hm1-door-bottom', x: (240 + 220) * S, y: (40 + 280) * S, connections: ['corridor-left', 'hm1-interior'] },
  { id: 'hm1-interior', x: 400 * S, y: 175 * S, connections: ['hm1-door-right', 'hm1-door-bottom'] },
  
  // HM2 (cluster-2) doors and interior
  { id: 'hm2-door-left', x: 920 * S, y: (40 + 140) * S, connections: ['corridor-top', 'hm2-interior'] },
  { id: 'hm2-door-bottom', x: (920 + 220) * S, y: (40 + 280) * S, connections: ['corridor-right', 'hm2-interior'] },
  { id: 'hm2-interior', x: 1080 * S, y: 175 * S, connections: ['hm2-door-left', 'hm2-door-bottom'] },
  
  // HM3 (cluster-3) doors and interior
  { id: 'hm3-door-right', x: (240 + 440) * S, y: (580 + 140) * S, connections: ['corridor-bottom', 'hm3-interior'] },
  { id: 'hm3-door-top', x: (240 + 220) * S, y: 580 * S, connections: ['corridor-left', 'hm3-interior'] },
  { id: 'hm3-interior', x: 400 * S, y: 715 * S, connections: ['hm3-door-right', 'hm3-door-top'] },
  
  // HM4 (cluster-4) doors and interior
  { id: 'hm4-door-left', x: 920 * S, y: (580 + 140) * S, connections: ['corridor-bottom', 'hm4-interior'] },
  { id: 'hm4-door-top', x: (920 + 220) * S, y: 580 * S, connections: ['corridor-right', 'hm4-interior'] },
  { id: 'hm4-interior', x: 1080 * S, y: 715 * S, connections: ['hm4-door-left', 'hm4-door-top'] },
  
  // Quarantine area
  { id: 'quarantine-entrance', x: 800 * S, y: 900 * S, connections: ['corridor-bottom', 'quarantine-interior'] },
  { id: 'quarantine-interior', x: 800 * S, y: 980 * S, connections: ['quarantine-entrance'] },
  
  // Entertainment area (left side)
  { id: 'entertainment-entrance', x: 200 * S, y: 450 * S, connections: ['corridor-left', 'entertainment-interior'] },
  { id: 'entertainment-interior', x: 120 * S, y: 450 * S, connections: ['entertainment-entrance'] },
];

const navNodeMap = new Map(navNodes.map((n) => [n.id, n]));

/**
 * Get the closest navigation node to a given position
 */
export function getClosestNavNode(x: number, y: number): NavNode {
  let closest = navNodes[0];
  let minDist = Infinity;
  
  for (const node of navNodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < minDist) {
      minDist = dist;
      closest = node;
    }
  }
  return closest;
}

/**
 * A* pathfinding between two positions using navigation nodes
 * Returns array of waypoints to follow (including start and end positions)
 */
export function findPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): { x: number; y: number }[] {
  const startNode = getClosestNavNode(startX, startY);
  const endNode = getClosestNavNode(endX, endY);
  
  // If same node, just go directly
  if (startNode.id === endNode.id) {
    return [{ x: startX, y: startY }, { x: endX, y: endY }];
  }
  
  // A* search
  const openSet = new Set<string>([startNode.id]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startNode.id, 0]]);
  const fScore = new Map<string, number>([[startNode.id, heuristic(startNode, endNode)]]);
  
  while (openSet.size > 0) {
    // Get node with lowest fScore
    let current: string | null = null;
    let lowestF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = id;
      }
    }
    
    if (!current) break;
    
    if (current === endNode.id) {
      // Reconstruct path
      const nodePath: NavNode[] = [];
      let curr: string | undefined = current;
      while (curr) {
        const node = navNodeMap.get(curr);
        if (node) nodePath.unshift(node);
        curr = cameFrom.get(curr);
      }
      
      // Convert to position array, include actual start/end
      const path: { x: number; y: number }[] = [{ x: startX, y: startY }];
      for (const node of nodePath) {
        path.push({ x: node.x, y: node.y });
      }
      path.push({ x: endX, y: endY });
      return path;
    }
    
    openSet.delete(current);
    const currentNode = navNodeMap.get(current);
    if (!currentNode) continue;
    
    for (const neighborId of currentNode.connections) {
      const neighbor = navNodeMap.get(neighborId);
      if (!neighbor) continue;
      
      const tentativeG = (gScore.get(current) ?? Infinity) + distance(currentNode, neighbor);
      
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + heuristic(neighbor, endNode));
        openSet.add(neighborId);
      }
    }
  }
  
  // No path found, return direct path (fallback)
  return [{ x: startX, y: startY }, { x: endX, y: endY }];
}

function heuristic(a: NavNode, b: NavNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function distance(a: NavNode, b: NavNode): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
