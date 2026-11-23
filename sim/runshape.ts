/**
 * Phase 14 X4 (docs/design/roadmap.md, "This run's shape"): what this run rolled, for the run
 * summary (host and guests). It only reads the World (no rng, no state changes), so it is safe
 * to call at any time on the host or a guest. Marks (X2) come from World.namedPlan() and arena
 * events (X3) from World.arenaEventAt().
 */
import { ENCOUNTERS, type EncounterId } from './content/dungeon';
import { HEATS, type HeatId } from './content/heat';
import { AFFIX_TIP } from './content/named';
import { STIR_BIT, STIR_IDS, STIR_INFO, WAVE_SHAPE_INFO, type ArenaEventId, type LayoutId, type WaveShape, type World } from './world';

export type ShapeKind = 'route' | 'floor' | 'mark' | 'event' | 'wave' | 'stir' | 'boss' | 'heat';
export interface ShapeChip {
  kind: ShapeKind;
  /** Short chip text, such as "Floors: 2 stone, 1 vent". */
  label: string;
  /** The longer hold-tip text. */
  tip: string;
}

/** Each boss version's name, as its phase banner shows it (client/GameScene.ts). */
export const BOSS_VERSION_NAME: Record<string, string> = {
  cataclysm: 'Molten Cataclysm', draw: 'Kiln Draw', turning: 'Turning Fire',
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

/** Each floor's short chip word ("Floors: 2 stone, 1 vent" stays one line on a phone) and its tip line. */
const FLOOR_NAME: Record<Exclude<LayoutId, 'open'>, [string, string]> = {
  pillars: ['stone', 'Stones that block movement and shots'],
  channel: ['lava', 'A lava channel across the floor'],
  vents: ['vent', 'Vents that flare in turn'],
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
    floors.push(`${name(f.id)}: ${FLOOR_NAME[l][1].toLowerCase()}`);
  }
  const kinds = (Object.keys(count) as Exclude<LayoutId, 'open'>[]);
  if (kinds.length) {
    out.push({ kind: 'floor', label: `Floors: ${kinds.map((l) => `${count[l]} ${FLOOR_NAME[l][0]}`).join(', ')}`, tip: floors.join('. ') });
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

  // Phase 15 Y1: wave shapes other than the usual arc, as the route rolls them (like the events above).
  const ws: string[] = [];
  const wn: Partial<Record<Exclude<WaveShape, 'arc'>, number>> = {};
  for (const f of fights) {
    const v = w.waveShapeAt(f.k, f.id);
    if (v === 'arc') continue;
    wn[v] = (wn[v] ?? 0) + 1;
    ws.push(`${name(f.id)}: ${WAVE_SHAPE_INFO[v].name.toLowerCase()}`);
  }
  const wids = Object.keys(wn) as Exclude<WaveShape, 'arc'>[];
  if (wids.length) {
    out.push({ kind: 'wave', label: `Waves: ${wids.map((v) => `${WAVE_SHAPE_INFO[v].name}${wn[v]! > 1 ? ` x${wn[v]}` : ''}`).join(', ')}`, tip: ws.join('. ') });
  }

  // Phase 15 Y10: how the dungeon stirred this run, after clean fights (decided as the run goes, so it reads what happened).
  const stirred = STIR_IDS.filter((v) => w.stirsMet & STIR_BIT[v]);
  if (stirred.length) {
    out.push({ kind: 'stir', label: `Stirred: ${stirred.map((v) => STIR_INFO[v].name).join(', ')}`, tip: `Clean fights stirred the dungeon. ${stirred.map((v) => STIR_INFO[v].tip).join(' ')}` });
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
