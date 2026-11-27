/**
 * The Kiln Mother's taunts (1.0 CP3 remake, docs/design/kiln-mother.md). The Court's voice (docs/design/world.md, voice
 * guide): grand, old, greedy, dryly funny, 12 words or fewer, no exclamation marks. Each moment of the fight says one
 * line once a fight, picked by the run's seed (no run-rng draws, so bot balance is unchanged). Drafts: Steve can veto any.
 *
 * Boil-over's line stays in sim/world.ts BOIL_TAUNT (it is shown with the Boil-over banner).
 */
export type KilnSay = 'enter' | 'stage2' | 'eggHatch' | 'eggStamp' | 'fallen' | 'kilnOut' | 'stage3' | 'heroLow' | 'oldTricks' | 'heroFalls' | 'sheFalls';

export const KILN_TAUNTS: Record<KilnSay, string[]> = {
  /** She is met at the boss door. */
  enter: [
    'Back again, little thief? You still smell of my kiln.',
    'Wipe your feet. I only just swept these ashes.',
    'Every pot in here is mine. So is every ember.',
    "A thief from Wick. I thought you'd all gone cold.",
  ],
  /** Stage 2: she walks into her kiln. */
  stage2: [
    'Mind the pots. I fired every one of them.',
    "Into the kiln. Let's see how you like the heat.",
    'Stand still, dear. The heat does the rest.',
  ],
  /** The first egg in a fight hatches. */
  eggHatch: [
    'There. A fresh batch, straight from the kiln.',
    "You let them hatch. They'll want feeding.",
  ],
  /** The first egg in a fight is stamped. */
  eggStamp: [
    'Those were my eggs, little thief.',
    "Clumsy. I'll fire another dozen tonight.",
  ],
  /** All three bellows broken: she falls out of the kiln. */
  fallen: [
    'My bellows. Do you know how old those were?',
    'Put me back. Put me back this instant.',
  ],
  /** She comes out on her own (the bellows weren't all broken in time). */
  kilnOut: [
    'Done hiding? So am I.',
  ],
  /** Stage 3: her first signature move. */
  stage3: [
    "Enough. I'll fire you myself.",
    "Now you've made me hot under the lid.",
    'All right. The last of my fire, then.',
  ],
  /** The hero first drops under 30% health in the fight. */
  heroLow: [
    'Cracking already? Poor glaze.',
    "You're cooling, little thief. I can tell.",
  ],
  /** Old Tricks: her first move borrowed from her other version. */
  oldTricks: [
    'I know an older trick than that.',
  ],
  /** The hero (or the whole party) falls. */
  heroFalls: [
    'Into the kiln with you. Everything comes out harder.',
    'Leave the embers by the door, dear.',
    "Come back when you're better fired.",
  ],
  /** She falls. */
  sheFalls: [
    'Take it, then. I can always make more than you can carry.',
    "Take your ember. I'll be warm again by morning.",
  ],
};

/** The line for one moment of one run: picked from the seed alone, so it never draws on the run's rng. */
export function kilnTaunt(say: KilnSay, seed: number): string {
  const lines = KILN_TAUNTS[say];
  let h = (seed * 2654435761) >>> 0;
  for (let k = 0; k < say.length; k++) h = Math.imul(h ^ say.charCodeAt(k), 16777619) >>> 0;
  return lines[h % lines.length];
}
