/**
 * Relics (1.0 CP2; docs/design/checkpoint-2-grey-box.md item 7, roadmap "Potions, in-run quests: cut; one Relic per
 * run"). After the door guard falls, each hero picks 1 of 2 Relics: one thing of the Court's, carried for the rest of
 * the delve (world.md, "Relics"). Each bends one rule and has a cost, never a plain stat. They replace the potions and
 * the in-run quests, which are gone. The first delve has none (unlock-curve.md: Relics from the second delve).
 *
 * Names: plain kiln and pottery words in the world's voice (world.md). Searched 27 Nov 2026 against World of Warcraft
 * and Azeroth Survivors with no match for the exact names; "firebricks" is a generic material in other games. They
 * are Steve's to veto (design brief, 1.0 queue).
 */
export type RelicId = 'spareWick' | 'looseLid' | 'fireBrick' | 'slipGlaze';

export interface RelicDef {
  id: RelicId;
  name: string;
  /** One line on the card: the rule it bends, then its cost. */
  text: string;
  /** Offered only in solo-style dungeons (in a group dungeon the party picks you up instead). */
  soloOnly?: boolean;
  /** Offered only where the boss has a Boil-over clock (World.boilAfter); a raid boss ends on its hard enrage instead. */
  needsBoil?: boolean;
}

export const RELICS: Record<RelicId, RelicDef> = {
  spareWick: { id: 'spareWick', name: 'Spare Wick', text: 'The first blow that would fell you leaves you at a quarter of your health. Your health is 15% lower.', soloOnly: true },
  looseLid: { id: 'looseLid', name: 'Loose Lid', text: 'The boss comes in with 20% less health, but boils over 30 s sooner.', needsBoil: true },
  fireBrick: { id: 'fireBrick', name: 'Fire Brick', text: 'Standing still, you take 30% less damage. Moving, you take 15% more.' },
  slipGlaze: { id: 'slipGlaze', name: 'Slip Glaze', text: 'Your dodge roll comes back twice as fast, but each roll costs 4% of your health.' },
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

/** Tuning (design, 27 Nov; measured in teams/design.md "Relics"). */
export const RELIC = {
  wickHp: 0.25,
  wickShield: 2,
  wickMaxHp: 0.85,
  lidHp: 0.8,
  lidSooner: 30,
  brickStill: 0.7,
  brickMoving: 1.15,
  /** World units a hero may drift in a tick and still count as standing still. */
  brickDrift: 0.5,
  glazeCd: 0.5,
  glazeCost: 0.04,
};

/** How many Relics a pick offers. */
export const RELIC_OFFER = 2;
