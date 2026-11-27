/**
 * The opening (CP3, docs/design/opening.md): a new save's first run, in the Kiln at tier 1. Four small rooms on the
 * tutorial map (sim/halls.ts genTutorial), each teaching one answer, then the Kiln Mother. You can't lose it: the hero's
 * health never drops below 1 (World.hurtPlayer), and the blows that would have felled you are counted (floorSaves).
 * Pillar 2 (read it, answer it).
 */
import type { EncounterId } from './dungeon';
import type { EnemyKind } from './enemies';

export const FIRST_DELVE = {
  /**
   * One answer per room (opening.md, "The opening, beat by beat"): R1 three hounds (your attack and Q), R3 one slammer
   * (red on the floor: roll), R5 one caster (a blue bar: Quench), then the Kiln Mother.
   */
  route: ['pack', 'wardens', 'brute', 'kilnMother'] as EncounterId[],
  /** Foes per kind in the opening's rooms, in place of the encounter's own counts (no trash doubling either). */
  counts: { cinderhound: 3, husk: 1 } as Partial<Record<EnemyKind, number>>,
  /** R1's hounds are bigger and slower than the normal pack, and don't lunge (red is taught in R3). */
  hound: { speed: 0.7, size: 1.3 },
  /** R3's slammer slams every this many seconds. */
  slamEvery: 5,
  /**
   * Health per kind on top of `hp`, so each room lasts about as long as the spec asks: the slammer through about 4 slams,
   * the caster through about 3 casts (opening.md).
   */
  kindHp: { cinderhound: 1, husk: 1.5, cinderBrute: 0.8 } as Partial<Record<EnemyKind, number>>,
  /** A Quenched cast staggers the caster: it takes `taken` times the damage for `time` seconds (R5, opening.md). */
  stagger: { time: 3, taken: 2 },
  /** Foe health and damage multipliers for the opening. */
  hp: 0.85,
  dmg: 0.5,
  /** The Kiln Mother's health share in the opening (with `hp` on top). Tuned in PR 3 (the short Kiln Mother). */
  bossHp: 0.5,
};

/**
 * The opening's banner line for each room, in place of the fight's usual tip (opening.md coach lines). `q` is the
 * hero's first button (Flame Wave for the Emberwright). `quench` is the interrupt (action slot 4, the blue button):
 * Quench, Kick or Shield Toss. Until the F button opens at level 1 (opening PR 5, SLOT_UNLOCK) a new character has no
 * interrupt yet, so `quench` is left out and the caster's line teaches stepping out instead.
 * R3's red and R5's blue lines show at the moment they're needed (client/coach.ts), so their rooms open on an empty line.
 */
export function coachLine(encounter: EncounterId, quench?: string, q = 'Flame Wave'): string | undefined {
  switch (encounter) {
    case 'pack': return `Your attack fires on its own. Tap ${q} when they bunch up.`;
    case 'wardens': return '';
    case 'brute': return quench ? '' : 'The bar over the Brute is a cast. When it fills, the Brute pounds the ground: step out of the ring.';
    case 'kilnMother': return quench ? 'Roll out of the red. Quench her blue cast.' : 'Roll out of the red.';
    default: return undefined;
  }
}

/** The coach's lines at the moment they're needed (opening.md): the first slam, the first blue cast, the first draft. */
export const OPENING_LINES = {
  roll: 'Red on the floor is a hit coming. Tap Roll to get out.',
  rollKeys: 'Red on the floor is a hit coming. Press Space to roll out.',
  quench: (name: string) => `A blue bar is a cast. Tap ${name}, the blue button, to stop it.`,
  quenchKeys: (name: string, key: string) => `A blue bar is a cast. Press ${key} for ${name}, the blue button, to stop it.`,
  draft: 'Pick one. It lasts this delve.',
  /** The Hearthkeeper, on the first Quench. */
  firstQuench: 'It fears water. Of course it does.',
};
