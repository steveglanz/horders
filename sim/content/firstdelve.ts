/**
 * The opening (CP3, docs/design/opening.md): a new save's first run, in the Kiln at tier 1. Four small rooms on the
 * tutorial map (sim/halls.ts genTutorial), each teaching one answer, then the Kiln Mother. You can't lose it: the hero's
 * health never drops below 1 (World.hurtPlayer), and the blows that would have felled you are counted (floorSaves).
 * Pillar 2 (read it, answer it).
 */
import type { EncounterId } from './dungeon';
import type { EnemyKind } from './enemies';
import type { KilnSay } from './kilnmother';

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
  /** The Kiln Mother's health share in the opening (with `hp` on top), tuned so her short fight lasts 60-90 s. */
  bossHp: 2.7,
  /**
   * The short Kiln Mother (opening.md, "The short Kiln Mother"; World.runKilnOpening). Stage 1 to half health: a Swipe
   * every swipeEvery[0] s, shown swipeShow s ahead. Stage 2: a Swipe every swipeEvery[1] s plus one blue cast (Kiln
   * Ripple, interruptible) every castEvery s, the first castFirst s into the stage (after her stage line has been read); un-Quenched it lands as one light
   * ring (rippleDamage, before `dmg`). Her Swipe reaches past a caster's usual range, so the roll is the answer from
   * anywhere in front of her; her sides and back are safe. Engineering's picks: swipeFirst, castFirst, the reach, arc
   * and damages.
   */
  boss: {
    stage2At: 0.5,
    swipeEvery: [6, 8] as [number, number],
    swipeFirst: 3,
    swipeShow: 1.2,
    swipeReach: 340,
    swipeArc: (90 * Math.PI) / 180,
    swipeDamage: 24,
    castEvery: 12,
    castFirst: 6,
    castTime: 3,
    rippleDamage: 30,
  },
  /** Her lines in the opening (opening.md), in place of the seed's pick from sim/content/kilnmother.ts. */
  says: {
    enter: "A thief from Wick. I thought you'd all gone cold.",
    stage2: 'Mind the pots. I fired every one of them.',
    sheFalls: 'Take it, then. I can always make more than you can carry.',
  } as Partial<Record<KilnSay, string>>,
};

/**
 * The opening's banner line for each room, in place of the fight's usual tip (opening.md coach lines). `q` is the
 * hero's first button (Flame Wave for the Emberwright). `quench` is the interrupt or stun (action slot 4, the blue
 * button): Quench, Kick, Shield Toss, Hush or Clinker. F opens at character level 1 (SLOT_UNLOCK, #898); with `quench`
 * left out the caster's line teaches stepping out of the cast instead.
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
