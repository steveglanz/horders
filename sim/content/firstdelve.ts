/**
 * L1, the first delve: a brand-new hero's first run in the Kiln at tier 1. The
 * route teaches one verb per fight in a fixed order, and foes hit softer while the
 * player learns. See docs/design/first-delve.md.
 */
import type { EncounterId } from './dungeon';

export const FIRST_DELVE = {
  /**
   * Steve, 26 Nov: a very small tutorial Kiln that is almost impossible to lose, room to room like every other run. One
   * fight per room on its own map (sim/halls.ts genTutorial): dodge (hounds), step out of the Brute's red ring, kill the
   * healers (acolytes), then the Kiln Mother.
   */
  route: ['pack', 'brute', 'acolytes', 'kilnMother'] as EncounterId[],
  /** Foe health and damage multipliers for the first delve. */
  hp: 0.85,
  dmg: 0.5,
  /** The Kiln Mother's health share on the first delve (with `hp` on top), so the first boss is short. */
  bossHp: 0.5,
};

/**
 * The first delve's coach line for each fight, in place of the fight's usual tip.
 * `quench` is the hero's interrupt (action slot 4, ringed in blue): Quench, Kick, Shield Toss, Hush or Clinker.
 * F opens at character level 1 (SLOT_UNLOCK), so a new character has its interrupt or stun; with `quench` left out the
 * lines teach stepping out of the cast instead.
 */
export function coachLine(encounter: EncounterId, quench?: string): string | undefined {
  switch (encounter) {
    case 'pack': return 'Your attacks fire on their own. Keep moving, and don\'t let the hounds corner you.';
    case 'wardens': return 'Red on the floor means a slam is coming. Walk out of the red before it fills.';
    case 'brute': return quench ? `The bar over the Brute is a cast. Press ${quench}, the blue button, while it fills to stop it.` : 'The bar over the Brute is a cast. When it fills, the Brute pounds the ground: step out of the ring.';
    case 'acolytes': return 'The two acolytes heal the Brute. Kill them first, then the Brute.';
    case 'kilnMother': return quench ? `All three at once: dodge the red, ${quench} her Cataclysm, and stand in the gold circles when they appear.` : 'All three at once: dodge the red, and stand in the gold circles when they appear.';
    default: return undefined;
  }
}
