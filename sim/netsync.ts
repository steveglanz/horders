/**
 * Co-op snapshots. The host's World is the only one that steps; it sends a
 * snapshot every few ticks and each guest copies it into a mirror World built
 * from the same options, then views it as their own hero with use(me).
 *
 * Generic on purpose: every number, boolean and string field on World is sent,
 * and every pooled array (objects with `alive`) is sent as its living entries,
 * so new sim fields reach guests without touching this file. Only enemy `def`
 * (a content reference) is rebuilt from `kind`.
 */
import { World, SimEvent, HeroSlotData } from './world';
import { ENEMIES } from './content/enemies';
import { ThreatTable } from './threat';

/** Pools sent as their living entries: [index, ...values in `keys` order]. */
export const POOLS = ['enemies', 'orbs', 'gems', 'zones', 'telegraphs', 'strikes', 'lances', 'drops', 'veins', 'cracks'] as const;
/**
 * Small arrays of plain data sent whole. A new array on World must go here, in POOLS, or in
 * NOT_SENT (tests/netsync-coverage.test.ts fails otherwise): the Hoard's embers once missed it.
 */
export const ARRAYS = ['omens', 'vents', 'quests', 'gates', 'paths', 'route', 'coalEmbers', 'pillars', 'rafts'] as const;
/** Arrays a snapshot carries in fields of their own (Snapshot.heroes, strikeOwner, bossThreat, events). */
export const SENT_APART = ['heroes', 'strikeOwner', 'threat', 'events'] as const;
/** Arrays on World that a guest never needs, and why. */
export const NOT_SENT: Record<string, string> = {
  head: 'spatial hash, rebuilt from enemies every step',
  next: 'spatial hash, rebuilt from enemies every step',
  potions: 'only the host applies potions (hurtPlayer, abilityCooldown); fixed at the start',
  potionSpent: 'only the host decides Rising Draught',
  // Per-hero fields of the hero swapped in: sent per hero through Snapshot.heroes (heroData).
  gear: 'per hero, fixed at the start from the start options',
  runDrops: 'per hero, sent in Snapshot.heroes',
  runEquipped: 'per hero, sent in Snapshot.heroes',
  choices: 'per hero, sent in Snapshot.heroes',
};
/** Fields a guest keeps for itself. */
const LOCAL = new Set(['acting', 'stress']);
/** Previous-position fields: the guest fills them from its last copy, for smooth motion. */
const PREV = new Set(['px', 'py', 'def']);

export interface Snapshot {
  tick: number;
  scalars: Record<string, number | boolean | string | null>;
  pools: Record<string, { keys: string[]; rows: unknown[][] }>;
  arrays: Record<string, unknown>;
  heroes: HeroSlotData[];
  /** Everything the host's sim emitted since the last snapshot, oldest first. */
  events: SimEvent[];
  /** Strike owners ride along with strikes (they live in a side array). */
  strikeOwner?: number[];
  /** The boss's threat table, so a guest's bossTarget, tauntCue and swapCue see who the boss is on. */
  bossThreat?: ThreatTable;
}

type Bag = Record<string, unknown>;

export function snapshot(w: World, events: SimEvent[] = []): Snapshot {
  const W = w as unknown as Bag;
  const scalars: Snapshot['scalars'] = {};
  for (const k of Object.keys(W)) {
    const v = W[k];
    if (LOCAL.has(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || v === null) scalars[k] = v as never;
  }
  const pools: Snapshot['pools'] = {};
  for (const name of POOLS) {
    const pool = W[name] as Bag[] | undefined;
    if (!pool?.length) continue;
    const keys = Object.keys(pool[0]).filter((k) => !PREV.has(k) && k !== 'alive');
    const rows: unknown[][] = [];
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.alive) continue;
      const row: unknown[] = [i];
      for (const k of keys) row.push(typeof o[k] === 'number' ? Math.round((o[k] as number) * 100) / 100 : o[k]);
      rows.push(row);
    }
    pools[name] = { keys, rows };
  }
  const arrays: Snapshot['arrays'] = {};
  for (const name of ARRAYS) if (Array.isArray(W[name])) arrays[name] = W[name];
  const heroes = w.heroes.map((_, i) => w.heroData(i));
  const so = W.strikeOwner as Int8Array | undefined;
  const bossThreat = w.bossIndex >= 0 ? w.threat[w.bossIndex] : undefined;
  return { tick: w.tick, scalars, pools, arrays, heroes, events, strikeOwner: so ? Array.from(so) : undefined, bossThreat };
}

/**
 * Copies a snapshot into a guest's mirror World and views it as hero `me`.
 * JSON in and out (the network sends it as text), so nothing is shared with the host's objects.
 */
export function applySnapshot(w: World, s: Snapshot, me: number): void {
  const W = w as unknown as Bag;
  w.use(0);
  for (const k of Object.keys(s.scalars)) if (!LOCAL.has(k) && k in W) W[k] = s.scalars[k];
  for (const name of POOLS) {
    const pool = W[name] as Bag[] | undefined;
    const p = s.pools[name];
    if (!pool || !p) continue;
    const seen = new Uint8Array(pool.length);
    for (const row of p.rows) {
      const i = row[0] as number;
      const o = pool[i];
      if (!o) continue;
      seen[i] = 1;
      const was = o.alive;
      if ('px' in o) {
        o.px = was ? o.x : row[1 + p.keys.indexOf('x')];
        o.py = was ? o.y : row[1 + p.keys.indexOf('y')];
      }
      o.alive = true;
      for (let k = 0; k < p.keys.length; k++) o[p.keys[k]] = row[k + 1];
      if (name === 'enemies') o.def = ENEMIES[o.kind as keyof typeof ENEMIES];
    }
    for (let i = 0; i < pool.length; i++) if (!seen[i]) pool[i].alive = false;
  }
  for (const name of ARRAYS) if (name in s.arrays) W[name] = s.arrays[name];
  s.heroes.forEach((h, i) => {
    const old = w.heroData(i).player;
    h.player.px = old.x;
    h.player.py = old.y;
    w.setHeroData(i, h);
  });
  const so = W.strikeOwner as Int8Array | undefined;
  if (so && s.strikeOwner) so.set(s.strikeOwner);
  if (s.bossThreat && w.bossIndex >= 0 && w.bossIndex < w.threat.length) w.threat[w.bossIndex] = JSON.parse(JSON.stringify(s.bossThreat));
  w.events = s.events;
  w.use(Math.min(me, w.heroes.length - 1));
}
