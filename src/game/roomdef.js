import { ROOM_COLS, ROOM_ROWS } from '../config.js';

// Map characters → tiles. Rooms may add or override entries via `legend`.
export const DEFAULT_LEGEND = {
  '.': { tile: 'snow', solid: false },
  ',': { tile: 'path', solid: false },
  T: { tile: 'tree', solid: true },
  R: { tile: 'rock', solid: true },
  L: { tile: 'lamppost', solid: true },
  W: { tile: 'wardrobe', solid: true, role: 'entrance' },
  X: { tile: 'door_locked', solid: true, role: 'exit' },
};

export const ENTITY_TYPES = ['npc', 'wolf', 'key', 'heart'];

// Where the player appears next to the entrance: the first open neighbour in
// this order, facing away from the entrance.
const NEIGHBORS = [
  { dc: 0, dr: 1, facing: 'down' },
  { dc: 0, dr: -1, facing: 'up' },
  { dc: 1, dr: 0, facing: 'right' },
  { dc: -1, dr: 0, facing: 'left' },
];

export class RoomError extends Error {
  constructor(roomName, errors) {
    super(`Room "${roomName}" has problems:\n- ${errors.join('\n- ')}`);
    this.name = 'RoomError';
    this.errors = errors;
  }
}

export function legendFor(def) {
  return { ...DEFAULT_LEGEND, ...(def.legend ?? {}) };
}

export function validateRoomDef(def) {
  const errors = [];
  const { map } = def;
  if (!Array.isArray(map) || map.length !== ROOM_ROWS) {
    errors.push(`map must have ${ROOM_ROWS} rows (found ${Array.isArray(map) ? map.length : 'none'})`);
    return errors;
  }
  map.forEach((row, r) => {
    if (typeof row !== 'string' || row.length !== ROOM_COLS) {
      errors.push(`row ${r} must have ${ROOM_COLS} characters (found ${row?.length ?? 0})`);
    }
  });
  if (errors.length) return errors;

  const legend = legendFor(def);
  const doors = { entrance: [], exit: [] };
  map.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const tile = legend[ch];
      if (!tile) errors.push(`unknown tile "${ch}" at column ${c}, row ${r}`);
      else if (tile.role) doors[tile.role].push({ col: c, row: r });
    });
  });
  for (const role of ['entrance', 'exit']) {
    if (doors[role].length !== 1) errors.push(`map needs exactly one ${role} (found ${doors[role].length})`);
  }
  if (doors.entrance.length === 1 && !findSpawn(map, legend, doors.entrance[0])) {
    errors.push('there is no open floor next to the entrance');
  }

  const npcIds = new Set();
  (def.entities ?? []).forEach((e, i) => {
    const label = `entity ${i} (${e.type})`;
    if (!ENTITY_TYPES.includes(e.type)) {
      errors.push(`${label}: unknown entity type "${e.type}"`);
      return;
    }
    const inside = Number.isInteger(e.x) && Number.isInteger(e.y) && e.x >= 0 && e.x < ROOM_COLS && e.y >= 0 && e.y < ROOM_ROWS;
    if (!inside) errors.push(`${label} at ${e.x},${e.y} is outside the map`);
    else if (legend[map[e.y][e.x]]?.solid ?? true) errors.push(`${label} at ${e.x},${e.y} is on a solid tile`);
    if (e.type === 'npc') {
      if (!e.id) errors.push(`${label} needs an id`);
      else if (npcIds.has(e.id)) errors.push(`${label}: duplicate NPC id "${e.id}"`);
      else npcIds.add(e.id);
      if (!e.sprite) errors.push(`${label} needs a sprite`);
      if (!Array.isArray(e.dialogue) || e.dialogue.length === 0) errors.push(`${label} needs at least one line of dialogue`);
    }
  });
  return errors;
}

export function parseRoomDef(def) {
  const errors = validateRoomDef(def);
  if (errors.length) throw new RoomError(def.name ?? def.id ?? 'unnamed room', errors);
  const legend = legendFor(def);
  const tiles = def.map.map((row) => [...row].map((ch) => legend[ch].tile));
  const solid = def.map.map((row) => [...row].map((ch) => legend[ch].solid));
  let entrance;
  let exit;
  def.map.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (legend[ch].role === 'entrance') entrance = { col: c, row: r };
      if (legend[ch].role === 'exit') exit = { col: c, row: r };
    });
  });
  return { tiles, solid, entrance, exit, spawn: findSpawn(def.map, legend, entrance) };
}

function findSpawn(map, legend, { col, row }) {
  for (const n of NEIGHBORS) {
    const c = col + n.dc;
    const r = row + n.dr;
    if (r < 0 || r >= map.length || c < 0 || c >= map[r].length) continue;
    const tile = legend[map[r][c]];
    if (tile && !tile.solid) return { col: c, row: r, facing: n.facing };
  }
  return null;
}
