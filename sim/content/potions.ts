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
  /** Embers to brew. */
  cost: number;
}

export const POTIONS: Record<PotionId, PotionDef> = {
  risingDraught: { id: 'risingDraught', name: 'Rising Draught', blurb: 'The first blow that would fell you leaves you at a quarter of your health instead.', cost: 30 },
  stillwater: { id: 'stillwater', name: 'Stillwater Tonic', blurb: 'Your interrupt recovers 40% faster this delve.', cost: 10 },
  kindling: { id: 'kindling', name: 'Kindling Brew', blurb: 'Start the delve one level up, with a talent pick.', cost: 12 },
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];

/** Tuning for the potion effects. */
export const POTION = { riseHp: 0.25, riseShield: 2, stillwaterCd: 0.6 };
