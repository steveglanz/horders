/**
 * Phase 14 X4 (docs/design/roadmap.md, "This run's shape"): what this run rolled, for the run
 * summary and the co-op dungeon card. It only reads the World (no rng, no state changes), so it
 * is safe to call at any time on the host or a guest.
 *
 * Marks (X2) and arena events (X3) come from design's World.namedPlan() and World.arenaEventAt().
 * Until those land, the chips for them are simply left out.
 */
import { ENCOUNTERS, type EncounterId } from './content/dungeon';
import { HEATS, type HeatId } from './content/heat';
import type { LayoutId, World } from './world';

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

export const EVENT_NAME: Record<string, string> = {
  caveIn: 'Cave-in', ventSurge: 'Vent surge', coldSnap: 'Cold snap', highWater: 'High water',
};

/** Design's X2/X3 reads, optional until their PR lands. */
type Planned = World & {
  namedPlan?: () => { at: number; affix: string } | null;
  arenaEventAt?: (k: number, id: EncounterId) => string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function runShape(w: World, opts: { tips?: Record<string, string> } = {}): ShapeChip[] {
  const p = w as Planned;
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

  const plan = typeof p.namedPlan === 'function' ? p.namedPlan() : null;
  if (plan?.affix) {
    const at = w.route[plan.at];
    out.push({ kind: 'mark', label: `Marked: ${plan.affix}`, tip: `${opts.tips?.[plan.affix] ?? plan.affix}${at ? ` (${name(at)})` : ''}` });
  }

  if (typeof p.arenaEventAt === 'function') {
    const evs: string[] = [];
    const n: Record<string, number> = {};
    for (const f of fights) {
      const e = p.arenaEventAt(f.k, f.id);
      if (!e) continue;
      n[e] = (n[e] ?? 0) + 1;
      evs.push(`${name(f.id)}: ${(EVENT_NAME[e] ?? e).toLowerCase()}`);
    }
    const ids = Object.keys(n);
    if (ids.length) {
      out.push({ kind: 'event', label: `Events: ${ids.map((e) => `${EVENT_NAME[e] ?? e}${n[e] > 1 ? ` x${n[e]}` : ''}`).join(', ')}`, tip: evs.join('. ') });
    }
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
