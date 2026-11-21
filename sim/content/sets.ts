/**
 * Verb sets (R4): each dungeon's boss can drop pieces of that dungeon's set.
 * A set is three pieces (head, hands, trinket) with a bonus at 2 and at 3.
 * Every bonus rewards one verb the dungeon teaches, never a raw stat, and
 * never a cooldown cut (so it can't stack into interrupting everything).
 */
import type { DungeonId } from './dungeon';
import type { Slot } from './items';

export type SetId = 'kilnbreaker' | 'tidewalker' | 'glarewarden' | 'hearthkeeper';

export interface SetDef {
  id: SetId;
  name: string;
  /** The verb, for the bags and docs. */
  verb: string;
  dungeon: DungeonId;
  /** Shown on items: [2-piece bonus, 3-piece bonus]. */
  bonus: [string, string];
}

/** Only these slots roll as set pieces, so the main stat stays the slot's own. */
export const SET_SLOTS: Slot[] = ['head', 'hands', 'trinket'];

export const SETS: Record<SetId, SetDef> = {
  kilnbreaker: {
    id: 'kilnbreaker', name: 'Kilnbreaker', verb: 'Interrupt', dungeon: 'kiln',
    bonus: ['Interrupting a cast gives you +10% damage for 8s.', 'A foe you interrupt takes +15% damage for 6s.'],
  },
  tidewalker: {
    id: 'tidewalker', name: 'Tidewalker', verb: 'Keep moving', dungeon: 'foundry',
    bonus: ['You take 6% less damage while moving.', 'After 2s on the move, your next hit deals +30% damage.'],
  },
  glarewarden: {
    id: 'glarewarden', name: 'Glarewarden', verb: 'Step out', dungeon: 'glarewell',
    bonus: ['Stepping out of a marked attack before it lands heals 1.5% of your health (at most every 4s).', 'Stepping out also gives +10% damage for 4s.'],
  },
  hearthkeeper: {
    id: 'hearthkeeper', name: 'Hearthkeeper', verb: 'Keep the flame', dungeon: 'coldmarrow',
    bonus: ['Each kill adds a Warmth (up to 5, one fades every 2s without a kill) for +2% damage each. In the Coldmarrow, kills feed your Hearthcoal 50% more.', 'At 5 Warmth you take 8% less damage.'],
  },
};

export const SET_IDS = Object.keys(SETS) as SetId[];

/** The set a dungeon drops, if it has one (the group dungeons and the raid have none yet). */
export function setForDungeon(d: DungeonId): SetId | undefined {
  return SET_IDS.find((s) => SETS[s].dungeon === d);
}

/** Tuning. `dropChance` applies when the boss's item rolls into a set slot. */
export const SET_TUNING = {
  dropChance: 0.6,
  kbDamage: 0.1, kbTime: 8, kbExposed: 0.15, kbExposedTime: 6,
  twCut: 0.06, twCharge: 2, twSurge: 0.3,
  gwHeal: 0.015, gwDamage: 0.1, gwTime: 4, gwEvery: 4,
  /** Hearthkeeper: Warmth stacks from kills, damage per stack, seconds before a stack fades, Hearthcoal feed bonus, and the cut at full Warmth. */
  hkMax: 5, hkDamage: 0.02, hkFade: 2, hkFeed: 0.5, hkCut: 0.08,
};
