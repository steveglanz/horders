/**
 * Plain-language help for the long-press tooltips (phone) and hover titles (desktop).
 * Facts here are checked against the code they describe; keep them in step.
 */
import { TREE_KEYSTONE_POINTS } from './trees';

export const HELP = {
  /** The hub's hero talents (PASSIVES in sim/hero.ts; points from pointsAvailable). */
  heroTalents:
    `Your talent tree is permanent. You get 1 point for each hero level after the first. Each branch's last talent opens at ${TREE_KEYSTONE_POINTS} points in that branch. Resetting is free.`,
  /** The level-up cards during a run (TALENTS in sim/content/emberwright.ts; World.rollDraft). */
  runTalents:
    'When you level up in a delve, catch 1 of 3 Sparks. Each draft offers one that changes how you play, until you take one. Sparks fade when the delve ends.',
  /** Under talent-card tooltips: damage figures are base numbers. */
  cardNumbers: 'Damage numbers on Sparks are before your damage bonuses from gear, Might and level.',
  /** One line that tells the two kinds apart, for the first time a player sees either. */
  bothKinds:
    'Hero talents stay with your hero for good. Sparks you catch in a delve last until the delve ends.',
};
