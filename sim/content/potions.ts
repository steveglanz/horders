/**
 * Alchemy (R8): one potion, brewed in the hub for embers before a delve and
 * used up by it. Each potion changes one thing about the run, never a raw
 * stat: get up once, Quench more often, or start a level ahead.
 */
export type PotionId = 'risingDraught' | 'stillwater' | 'kindling';

export interface PotionDef {
  id: PotionId;
  name: string;
  /** One line for the hub. */
  blurb: string;
  /** Embers to brew (at tier 1; see potionCost). */
  cost: number;
  /** P7: extra embers per tier above 1 of the hero's best tier, so the potion stays a choice as income grows. */
  costPerTier?: number;
}

export const POTIONS: Record<PotionId, PotionDef> = {
  risingDraught: { id: 'risingDraught', name: 'Rising Draught', blurb: 'The first blow that would fell you leaves you at a quarter of your health instead. Solo dungeons only.', cost: 30, costPerTier: 6 },
  stillwater: { id: 'stillwater', name: 'Stillwater Tonic', blurb: 'Your interrupt recovers 40% faster this delve.', cost: 10 },
  kindling: { id: 'kindling', name: 'Kindling Brew', blurb: 'Start the delve one level up, with a Spark to catch.', cost: 12 },
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];

/**
 * Embers to brew a potion for a hero whose best tier is `maxTier`. Rising Draught
 * grows with the tier: at a flat 30 embers the P7 economy pass found it brewed
 * before 26 to 29 of 30 delves (docs/design/economy.md).
 */
export function potionCost(id: PotionId, maxTier: number): number {
  const p = POTIONS[id];
  return p.cost + (p.costPerTier ?? 0) * Math.max(0, maxTier - 1);
}

/** Tuning for the potion effects. */
export const POTION = { riseHp: 0.25, riseShield: 2, stillwaterCd: 0.6 };
