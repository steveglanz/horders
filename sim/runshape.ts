/**
 * Phase 14 X4 (docs/design/roadmap.md, "This run's shape"): what this run rolled, for the run
 * summary (host and guests). It only reads the World (no rng, no state changes), so it is safe
 * to call at any time on the host or a guest. Marks (X2) come from World.namedPlan() and arena
 * events (X3) from World.arenaEventAt().
 */
import { ENCOUNTERS, type EncounterId } from './content/dungeon';
import { HEATS, type HeatId } from './content/heat';
import { AFFIX_TIP } from './content/named';
import type { ArenaEventId, LayoutId, World } from './world';

export type ShapeKind = 'route' | 'floor' | 'mark' | 'event' | 'boss' | 'heat';
export interface ShapeChip {
  kind: ShapeKind;
  /** Short chip text, such as "Floors: 2 stone floors, 1 vent floor". */
  label: string;
  /** The longer hold-tip text. */
  tip: string;
}

/** Each boss version's name, as its phase banner shows it (client/GameScene.ts). */
export const BOSS_VERSION_NAME: Record<string, string> = {
  cataclysm: 'Molten Cataclysm', draw: 'Kiln Draw',
  water: 'Rising Water', tide: 'Sluicetide',
  brand: 'Twin Brand', glint: 'Glintfall',
  ice: 'Thin Ice', drift: 'Emberdrift',
  riptide: 'Riptide', outsurge: 'The Outsurge',
  choir: 'Choir of Iron', load: 'Ironload',
  still: 'Twin Vents', wander: 'Wandering Vents',
  rivets: 'Rivets', cut: 'Die Cut',
  pour: 'The Pour', brim: 'The Brimming',
  spill: 'Ember Feast', bank: 'Banked Coals',
  wheel: 'Wheel', shift: 'Plate Shift',
  ash: 'Ash Fall', court: 'Summons',
};

const FLOOR_NAME: Record<Exclude<LayoutId, 'open'>, [string, string, string]> = {
  pillars: ['stone floor', 'stone floors', 'Stones that block movement and shots'],
  channel: ['lava floor', 'lava floors', 'A lava channel across the floor'],
  vents: ['vent floor', 'vent floors', 'Vents that flare in turn'],
};

export const EVENT_NAME: Record<ArenaEventId, string> = {
  caveIn: 'Cave-in', ventSurge: 'Vent surge', coldSnap: 'Cold snap', highWater: 'High water',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function runShape(w: World): ShapeChip[] {
  const out: ShapeChip[] = [];
  // The world boss's shadow is a bonus fight after the delve, not part of its route.
  const fights = w.route.map((id, k) => ({ id, k })).filter((f) => f.id !== 'worldShadow');
  const name = (id: EncounterId) => ENCOUNTERS[id]?.name.split(',')[0] ?? id;

  if (fights.length) {
    out.push({ kind: 'route', label: `Route: ${plural(fights.length, 'fight')}`, tip: fights.map((f) => name(f.id)).join(' › ') });
  }

  const floors: string[] = [];
  const count: Partial<Record<LayoutId, number>> = {};
  for (const f of fights) {
    const l = w.layoutAt(f.k, f.id);
    if (l === 'open') continue;
    count[l] = (count[l] ?? 0) + 1;
    floors.push(`${name(f.id)}: ${FLOOR_NAME[l][2].toLowerCase()}`);
  }
  const kinds = (Object.keys(count) as Exclude<LayoutId, 'open'>[]);
  if (kinds.length) {
    out.push({ kind: 'floor', label: `Floors: ${kinds.map((l) => plural(count[l]!, FLOOR_NAME[l][0], FLOOR_NAME[l][1])).join(', ')}`, tip: floors.join('. ') });
  }

  const plan = w.namedPlan();
  if (plan) {
    const at = w.route[plan.at];
    out.push({ kind: 'mark', label: `Marked: ${plan.affix}`, tip: `${at ? `${name(at)}: ` : ''}${AFFIX_TIP[plan.affix]}` });
  }

  const evs: string[] = [];
  const n: Partial<Record<ArenaEventId, number>> = {};
  for (const f of fights) {
    const e = w.arenaEventAt(f.k, f.id);
    if (!e) continue;
    n[e] = (n[e] ?? 0) + 1;
    evs.push(`${name(f.id)}: ${EVENT_NAME[e].toLowerCase()}`);
  }
  const ids = Object.keys(n) as ArenaEventId[];
  if (ids.length) {
    out.push({ kind: 'event', label: `Events: ${ids.map((e) => `${EVENT_NAME[e]}${n[e]! > 1 ? ` x${n[e]}` : ''}`).join(', ')}`, tip: evs.join('. ') });
  }

  // The boss's version is rolled when it appears, so a run that never reached it shows none.
  if (w.bossVariant) {
    const v = BOSS_VERSION_NAME[w.bossVariant] ?? w.bossVariant;
    out.push({ kind: 'boss', label: `Boss: ${v}`, tip: `${name(w.dungeonDef.boss)} used ${v} this run` });
  }

  if (w.heat) {
    const h = HEATS[w.heat as HeatId];
    if (h) out.push({ kind: 'heat', label: `Heat: ${h.name}`, tip: h.text });
  }
  return out;
}
