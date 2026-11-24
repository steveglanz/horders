/**
 * Phase 18 Halls H1 (design spec: /mnt/project-files/horders/design/halls/h1-prototype-spec.md): a WoW-style dungeon
 * map for the Kiln, behind ?halls=1. Rooms joined by corridors, with packs standing asleep in them; walk the map,
 * pick your fights, then go through the boss door into today's Kiln arena.
 *
 * This file is pure: the map template, its geometry (where heroes and foes may stand, and how a foe walks round a
 * wall), and the pack plan rolled from a run's route. World (sim/world.ts) owns the state as it plays.
 */
import { DUNGEONS, DungeonId, ENCOUNTERS, EncounterId, GateKind, rollFork } from './content/dungeon';
import type { EnemyKind } from './content/enemies';

export const HALLS = {
  /** Corridor width (world units). */
  corridor: 160,
  /** A sleeping pack wakes when a hero steps this close to its centre. */
  reach: 200,
  /** ...or when an awake foe comes this close to its centre (pulling two packs at once). */
  pull: 350,
  /** The client shows a sleeping pack's red ring only with a hero this close. */
  showRing: 400,
  /** Walking this close to the boss door, with the door guard cleared, starts the boss fight. */
  door: 80,
  /** The fade from the map into the boss arena (s). */
  fade: 0.8,
  /** The camera leads this far ahead along a corridor. */
  lead: 120,
  /** A room's rolled lava is cooled crust until its pack wakes, then heats to burning over this long (s). */
  lavaHeat: 1,
  /** How far apart a sleeping pack stands round its centre. */
  spread: 64,
};

export type PackRole = 'A' | 'B' | 'C' | 'D' | 'E' | 'S';

export interface HallsRoom {
  id: string;
  x: number;
  y: number;
  r: number;
  /** On the main path (R0, R1, R3, R5 and the door); R2 and R4 are side rooms. */
  main: boolean;
}

export interface HallsCorridor {
  /** Room indices at either end. */
  a: number;
  b: number;
}

export interface HallsPack {
  role: PackRole;
  room: number;
  x: number;
  y: number;
  /** Today's encounter this pack is (its spawn list, name and tip). */
  enc: EncounterId;
  /** The route slot it stands for: foe hp depth (1 + 0.12 x slot) and its bag's rarity use it. */
  slot: number;
  /** A main-path pack (A, B, C, E): it counts toward the run's fights cleared. */
  main: boolean;
  /** The door guard: the boss door opens only once it is cleared. */
  guard: boolean;
  /** R2 rolls a gate as rollFork does: 'named' pays as a named fight, 'shrine' heals instead of fighting. */
  gate?: GateKind;
  /** Loot bags each hero gets for clearing it (D pays a second). */
  bags: number;
  state: 'asleep' | 'awake' | 'cleared';
  /** Where each foe stands while asleep (spawned there when the pack wakes). */
  foes: { kind: EnemyKind; x: number; y: number }[];
}

export interface HallsMap {
  rooms: HallsRoom[];
  corridors: HallsCorridor[];
  packs: HallsPack[];
  /** The boss door, at the end of R5's north corridor. */
  door: { x: number; y: number };
  /** Whether this run's map is the template mirrored on x (seed & 1). */
  mirror: boolean;
  /** Rooms a hero has stood in (the corner map shows only these). */
  seen: boolean[];
  /** The party went through the boss door: the map is left behind and today's arena takes over. */
  done: boolean;
  /** Flare vents of the rooms that rolled the vents layout; they flare only while a pack in their room is awake. */
  vents: { room: number; x: number; y: number }[];
}

/** KILN_HALLS_A: the one hand-made template for H1 (spec table "The map"). Room 6 is the boss door's alcove. */
export const KILN_HALLS_A = {
  rooms: [
    { id: 'R0', x: 0, y: 0, r: 300, main: true },
    { id: 'R1', x: 0, y: -900, r: 380, main: true },
    { id: 'R2', x: -850, y: -1500, r: 340, main: false },
    { id: 'R3', x: 0, y: -1800, r: 420, main: true },
    { id: 'R4', x: 800, y: -2500, r: 360, main: false },
    { id: 'R5', x: 0, y: -2800, r: 380, main: true },
    { id: 'door', x: 0, y: -3300, r: 100, main: true },
  ] as HallsRoom[],
  corridors: [
    { a: 0, b: 1 }, { a: 1, b: 3 }, { a: 1, b: 2 }, { a: 3, b: 4 }, { a: 3, b: 5 }, { a: 5, b: 6 },
  ] as HallsCorridor[],
  /**
   * Pack spots: A in R1; B and C in R3, 520 apart so B's foes stand outside C's pull (350), with C to the west, 260 off
   * the path, so a careful hero walks past its ring (200); D in R4; E in R5's north doorway.
   */
  packs: [
    { role: 'A', room: 1, x: 0, y: -900 },
    { role: 'S', room: 2, x: -850, y: -1500 },
    { role: 'B', room: 3, x: 60, y: -1600 },
    { role: 'C', room: 3, x: -260, y: -2010 },
    { role: 'D', room: 4, x: 800, y: -2500 },
    { role: 'E', room: 5, x: 0, y: -3060 },
  ] as { role: PackRole; room: number; x: number; y: number }[],
  door: { x: 0, y: -3300 },
  /** The rooms that roll a layout (pillars, vents, lava) as fights do today, and the route slot whose roll they take. */
  layoutRooms: [{ room: 1, slot: 0 }, { room: 3, slot: 1 }, { room: 5, slot: 3 }],
};

/** Room index of the door alcove. */
export const DOOR_ROOM = 6;

const hash = (seed: number, k: number): number => {
  let h = (Math.imul(seed ^ 0x48616c6c, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/** Whether `dungeon` has a Halls map yet (H1: the Kiln only). */
export const hallsFor = (dungeon: DungeonId): boolean => dungeon === 'kiln';

/**
 * Builds this run's map from today's route ([opener, opener, named, hard, boss]): A and B are the openers, C the named
 * slot, E (the door guard) the hard slot. R2 takes the gate rollFork would offer before fight 2 (a named fight or a
 * shrine), and D a hard or named fight not already on the map. `pick` and `chance` are the run's rng, as for rollFork.
 */
export function buildHalls(seed: number, route: EncounterId[], dungeon: DungeonId, pick: (n: number) => number, chance: (p: number) => boolean): HallsMap {
  const T = KILN_HALLS_A;
  const mirror = (seed & 1) === 1;
  const mx = (x: number) => (mirror && x !== 0 ? -x : x);
  const fork = rollFork(route, 1, pick, chance, dungeon);
  const side = fork ? fork[1] : { kind: 'shrine' as GateKind, encounter: 'shrine' as EncounterId };
  const used = new Set<EncounterId>([...route, side.encounter]);
  const { hard, named } = DUNGEONS[dungeon];
  const pool = [...hard, ...named].filter((e, i, a) => !used.has(e) && a.indexOf(e) === i);
  const dEnc = pool.length ? pool[pick(pool.length)] : route[3];
  const plan: Record<PackRole, { enc: EncounterId; slot: number; main: boolean; bags: number; gate?: GateKind }> = {
    A: { enc: route[0], slot: 0, main: true, bags: 1 },
    B: { enc: route[1], slot: 1, main: true, bags: 1 },
    C: { enc: route[2], slot: 2, main: true, bags: 1 },
    E: { enc: route[3], slot: 3, main: true, bags: 1 },
    S: { enc: side.encounter, slot: 1, main: false, bags: 1, gate: side.kind },
    D: { enc: dEnc, slot: 3, main: false, bags: 2 },
  };
  const packs: HallsPack[] = T.packs.map((s, k) => {
    const p = plan[s.role];
    const x = mx(s.x), y = s.y;
    const kinds: EnemyKind[] = [];
    for (const sp of ENCOUNTERS[p.enc].spawns) for (let j = 0; j < sp.n; j++) kinds.push(sp.kind);
    const turn = ((hash(seed, k) >>> 4) % 360) * (Math.PI / 180);
    const foes = kinds.map((kind, j) => {
      if (kinds.length === 1) return { kind, x, y };
      const a = turn + (j * 2 * Math.PI) / kinds.length;
      const r = HALLS.spread * (j % 2 ? 1.25 : 1);
      return { kind, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
    });
    return { role: s.role, room: s.room, x, y, enc: p.enc, slot: p.slot, main: p.main, guard: s.role === 'E', gate: p.gate, bags: p.bags, state: 'asleep', foes };
  });
  return {
    rooms: T.rooms.map((r) => ({ ...r, x: mx(r.x) })),
    corridors: T.corridors.map((c) => ({ ...c })),
    packs,
    door: { x: mx(T.door.x), y: T.door.y },
    mirror,
    seen: T.rooms.map((_, i) => i === 0),
    done: false,
    vents: [],
  };
}

// ---------------------------------------------------------------- geometry

function segClosest(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const vx = x2 - x1, vy = y2 - y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return { x: x1 + vx * t, y: y1 + vy * t };
}

/** Which room (index) holds (x, y) with `pad` to spare, or -1. */
export function roomAt(m: HallsMap, x: number, y: number, pad = 0): number {
  for (let i = 0; i < m.rooms.length; i++) {
    const r = m.rooms[i];
    if ((x - r.x) ** 2 + (y - r.y) ** 2 <= (r.r - pad) ** 2) return i;
  }
  return -1;
}

/** Which corridor (index) holds (x, y) with `pad` to spare, or -1. */
export function corridorAt(m: HallsMap, x: number, y: number, pad = 0): number {
  const hw = HALLS.corridor / 2 - pad;
  for (let i = 0; i < m.corridors.length; i++) {
    const c = m.corridors[i], a = m.rooms[c.a], b = m.rooms[c.b];
    const q = segClosest(x, y, a.x, a.y, b.x, b.y);
    if ((x - q.x) ** 2 + (y - q.y) ** 2 <= hw * hw) return i;
  }
  return -1;
}

/** Whether a circle of radius `pad` at (x, y) stands wholly inside the map's rooms and corridors (one shape at least). */
export function inside(m: HallsMap, x: number, y: number, pad = 0): boolean {
  return roomAt(m, x, y, pad) >= 0 || corridorAt(m, x, y, pad) >= 0;
}

/** Keeps `o` (radius `r`) inside the map: outside every room and corridor, it moves to the nearest point inside one. */
export function clampHalls(m: HallsMap, o: { x: number; y: number }, r: number): void {
  if (inside(m, o.x, o.y, r)) return;
  let bx = o.x, by = o.y, bd = Infinity;
  for (const rm of m.rooms) {
    const dx = o.x - rm.x, dy = o.y - rm.y, d = Math.hypot(dx, dy) || 1;
    const max = Math.max(0, rm.r - r);
    const x = rm.x + (dx / d) * Math.min(d, max), y = rm.y + (dy / d) * Math.min(d, max);
    const dd = (x - o.x) ** 2 + (y - o.y) ** 2;
    if (dd < bd) { bd = dd; bx = x; by = y; }
  }
  const hw = Math.max(0, HALLS.corridor / 2 - r);
  for (const c of m.corridors) {
    const a = m.rooms[c.a], b = m.rooms[c.b];
    const q = segClosest(o.x, o.y, a.x, a.y, b.x, b.y);
    const dx = o.x - q.x, dy = o.y - q.y, d = Math.hypot(dx, dy) || 1;
    const x = q.x + (dx / d) * Math.min(d, hw), y = q.y + (dy / d) * Math.min(d, hw);
    const dd = (x - o.x) ** 2 + (y - o.y) ** 2;
    if (dd < bd) { bd = dd; bx = x; by = y; }
  }
  o.x = bx;
  o.y = by;
}

/** Whether the straight walk from (x1, y1) to (x2, y2) stays inside the map (sampled every 40 units). */
export function clearWalk(m: HallsMap, x1: number, y1: number, x2: number, y2: number, pad = 0): boolean {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.ceil(d / 40));
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (!inside(m, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, pad)) return false;
  }
  return true;
}

/** The room a point belongs to for walking: the room it is in, or the nearer end of the corridor it is in. */
function nodeOf(m: HallsMap, x: number, y: number): number {
  const r = roomAt(m, x, y);
  if (r >= 0) return r;
  const c = corridorAt(m, x, y);
  if (c >= 0) {
    const a = m.rooms[m.corridors[c].a], b = m.rooms[m.corridors[c].b];
    return Math.hypot(x - a.x, y - a.y) <= Math.hypot(x - b.x, y - b.y) ? m.corridors[c].a : m.corridors[c].b;
  }
  let best = 0, bd = Infinity;
  m.rooms.forEach((rm, i) => { const d = Math.hypot(x - rm.x, y - rm.y) - rm.r; if (d < bd) { bd = d; best = i; } });
  return best;
}

/** The rooms from `from` to `to` along the corridors, both ends included (the map is a tree, so this is the only way). */
export function roomPath(m: HallsMap, from: number, to: number): number[] {
  const prev = new Array<number>(m.rooms.length).fill(-2);
  prev[from] = -1;
  const queue = [from];
  while (queue.length) {
    const r = queue.shift()!;
    if (r === to) break;
    for (const c of m.corridors) {
      const n = c.a === r ? c.b : c.b === r ? c.a : -1;
      if (n >= 0 && prev[n] === -2) { prev[n] = r; queue.push(n); }
    }
  }
  if (prev[to] === -2) return [from];
  const out: number[] = [];
  for (let r = to; r !== -1; r = prev[r]) out.unshift(r);
  return out;
}

/**
 * Where a walker at (x, y) should head to reach (tx, ty): the target itself when the straight walk is clear, else the
 * next room centre on the way (or, from inside a room, the mouth of the corridor it must take, so it doesn't cut a
 * corner into the wall). Used by awake foes (World.updateEnemies) and bots (sim/bot.ts).
 */
export function hallsWay(m: HallsMap, x: number, y: number, tx: number, ty: number): { x: number; y: number } {
  if (clearWalk(m, x, y, tx, ty)) return { x: tx, y: ty };
  const from = nodeOf(m, x, y), to = nodeOf(m, tx, ty);
  const path = roomPath(m, from, to);
  if (path.length < 2) {
    const r = m.rooms[from];
    return { x: r.x, y: r.y };
  }
  const here = m.rooms[path[0]], next = m.rooms[path[1]];
  const inRoom = roomAt(m, x, y) === path[0];
  if (inRoom) {
    // Aim a little past the mouth of the corridor to the next room, so the walk leaves along its centre line.
    const dx = next.x - here.x, dy = next.y - here.y, d = Math.hypot(dx, dy) || 1;
    const mouth = { x: here.x + (dx / d) * (here.r + 40), y: here.y + (dy / d) * (here.r + 40) };
    if (clearWalk(m, x, y, mouth.x, mouth.y)) return mouth;
    return { x: here.x, y: here.y };
  }
  // In a corridor: head for the end that is fewer rooms from the target (the nearer end may be the one behind).
  const c = corridorAt(m, x, y);
  if (c >= 0) {
    const { a, b } = m.corridors[c];
    const onward = roomPath(m, a, to).length <= roomPath(m, b, to).length ? a : b;
    const r = m.rooms[onward];
    return { x: r.x, y: r.y };
  }
  return { x: next.x, y: next.y };
}

/**
 * A push away from the nearest wall when within `within` of it, scaled 0 to 1 by how close (bots use it in place of
 * the arena's "don't get pinned against the wall").
 */
export function wallPush(m: HallsMap, x: number, y: number, within: number): { x: number; y: number; k: number } {
  let gap = -Infinity, cx = x, cy = y;
  // The roomiest shape the point is in decides the wall it is near.
  for (const r of m.rooms) {
    const d = Math.hypot(x - r.x, y - r.y), g = r.r - d;
    if (g > gap) { gap = g; cx = r.x; cy = r.y; }
  }
  for (const c of m.corridors) {
    const a = m.rooms[c.a], b = m.rooms[c.b];
    const q = segClosest(x, y, a.x, a.y, b.x, b.y);
    const g = HALLS.corridor / 2 - Math.hypot(x - q.x, y - q.y);
    if (g > gap) { gap = g; cx = q.x; cy = q.y; }
  }
  if (gap >= within) return { x: 0, y: 0, k: 0 };
  const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, k: Math.min(1, (within - gap) / within) };
}

/** The main-path room order the bots and the edge arrow follow (R0, R1, R3, R5, door). */
export const MAIN_ROOMS = [0, 1, 3, 5, DOOR_ROOM];
