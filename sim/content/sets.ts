/**
 * Verb sets (R4): each dungeon's boss can drop pieces of that dungeon's set.
 * A set is three pieces (head, hands, trinket) with a bonus at 2 and at 3.
 * Every bonus rewards one verb the dungeon teaches, never a raw stat, and
 * never a cooldown cut (so it can't stack into interrupting everything).
 */
import type { DungeonId } from './dungeon';
import type { Slot } from './items';

export type SetId = 'kilnbreaker' | 'tidewalker' | 'glarewarden' | 'hearthkeeper' | 'wrackrider' | 'deepguard' | 'ventwalker' | 'kinbound';

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
  wrackrider: {
    id: 'wrackrider', name: 'Wrackrider', verb: 'Stand fast', dungeon: 'wrackline',
    bonus: ['After 0.5s standing still you are Planted, and you stay Planted for 1s after you move: you take 6% less damage. In the Wrackline, a raft keeps you Planted even while you walk.', 'While Planted, your hits deal +8% damage.'],
  },
  deepguard: {
    id: 'deepguard', name: 'Deepguard', verb: 'Stay close', dungeon: 'hammerdeep',
    bonus: ['While an ally stands within 140 of you, you take 3% less damage. (A group set: it does nothing solo.)', 'Allies within 140 of you take 2.5% less damage.'],
  },
  ventwalker: {
    id: 'ventwalker', name: 'Ventwalker', verb: 'Split up', dungeon: 'ashvents',
    bonus: ['While an ally is alive in the fight and none stands within 140 of you, you deal 6% more damage. (A group set: it does nothing solo.)', 'Standing in a gold circle when it lands heals you 5% of your health.'],
  },
  kinbound: {
    id: 'kinbound', name: 'Kinbound', verb: 'Cover each other', dungeon: 'crucible',
    bonus: ['When an ally heals you, you take 6% less damage for 4s. (A group set: it does nothing solo.)', 'When you heal an ally, or taunt the boss off one, you and that ally deal 6% more damage for 4s.'],
  },
};

export const SET_IDS = Object.keys(SETS) as SetId[];

/** The set a dungeon drops, if it has one. Every dungeon has one since the raid's Kinbound. */
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
  /** Wrackrider: seconds standing still to be Planted, seconds it lasts once you walk off, the damage cut while Planted (2), and the damage while Planted (3). */
  wrStill: 0.5, wrHold: 1, wrCut: 0.06, wrDamage: 0.08,
  /** Deepguard: how close an ally must be, the cut with an ally near (2), and the cut the wearer gives allies near it (3, does not stack). */
  dgRange: 140, dgCut: 0.03, dgAura: 0.025,
  /** Ventwalker: the damage while split from every living ally (2, same 140 range as Deepguard), and the heal for standing in a gold circle (3). */
  vwDamage: 0.06, vwHeal: 0.05,
  /** Kinbound: the cut after an ally's heal (2), the damage after you cover an ally (3, for you and them), and how long each lasts. */
  knCovered: 0.06, knBond: 0.06, knTime: 4,
};
