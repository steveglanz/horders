/**
 * Every sound effect in Horders, as a synth recipe (see synth.ts). All of them
 * are designed for this game; none are sampled or copied from anywhere.
 *
 * Loudness guide: frequent sounds (hits, swings) stay quiet and short so a big
 * fight doesn't turn to mush; rare moments (boss horn, level up) are loud.
 */
import { note, Recipe } from './synth';

// Pitches used for chimes and fanfares (semitones from A4).
const C5 = note(3), D5 = note(5), E5 = note(7), G5 = note(10), A5 = note(12), C6 = note(15), E6 = note(19), G6 = note(22);

const chime = (f: number, delay = 0, vol = 0.35, dur = 0.5): Recipe => [
  { wave: 'sine', f, dur, delay, vol, curve: 3 },
  { wave: 'sine', f: f * 2.01, dur: dur * 0.6, delay, vol: vol * 0.3, curve: 4 },
  { wave: 'tri', f: f * 3, dur: dur * 0.3, delay, vol: vol * 0.12, curve: 5 },
];

const clang = (f: number, vol = 0.4, dur = 0.45): Recipe => [
  // Inharmonic partials read as struck metal.
  { wave: 'sine', f, dur, vol: vol * 0.6, curve: 3 },
  { wave: 'sine', f: f * 1.47, dur: dur * 0.8, vol: vol * 0.4, curve: 4 },
  { wave: 'sine', f: f * 2.09, dur: dur * 0.6, vol: vol * 0.3, curve: 5 },
  { wave: 'sine', f: f * 2.76, dur: dur * 0.4, vol: vol * 0.2, curve: 6 },
  { wave: 'noise', f: 0, dur: 0.04, vol: vol * 0.6, lp: 6000 },
];

const boom = (low: number, dur: number, vol = 0.7): Recipe => [
  { wave: 'sine', f: low * 2.2, f2: low * 0.6, dur, vol: vol * 0.55, a: 0.005, curve: 2 },
  { wave: 'noise', f: 0, dur: dur * 0.9, vol: vol * 0.7, lp: 2400, lp2: 200, curve: 2.5 },
  { wave: 'tri', f: low * 1.1, f2: low * 0.5, dur: dur * 0.6, vol: vol * 0.3, curve: 2 },
  // Phone speakers can't play the sub: a growl in the 200-600 Hz range carries the weight there.
  { wave: 'saw', f: low * 6, f2: low * 3, dur: dur * 0.6, vol: vol * 0.45, lp: 1600, lp2: 400, curve: 2.5 },
  { wave: 'noise', f: 0, dur: 0.03, vol: vol * 0.5, lp: 5000 },
];

const whoosh = (from: number, to: number, dur: number, vol = 0.3): Recipe => [
  { wave: 'noise', f: 0, dur, vol, a: dur * 0.3, lp: from, lp2: to, curve: 1.5 },
];

const horn = (f: number, dur: number, vol = 0.45): Recipe => [
  { wave: 'saw', f: f * 0.97, f2: f, dur, vol: vol * 0.5, a: 0.12, lp: 900, lp2: 2200, curve: 1.2, vib: [5, 0.006] },
  { wave: 'saw', f: f * 1.005, dur, vol: vol * 0.4, a: 0.15, lp: 1200, curve: 1.2, vib: [4.4, 0.008] },
  { wave: 'sine', f: f / 2, dur, vol: vol * 0.3, a: 0.1, curve: 1.2 },
];

const join = (...parts: Recipe[]): Recipe => parts.flat();
const B5 = () => note(14);

export const SOUNDS = {
  // ---- combat, frequent (keep these tiny)
  hit: [
    { wave: 'tri', f: 420, f2: 220, dur: 0.05, vol: 0.22, curve: 3 },
    { wave: 'noise', f: 0, dur: 0.03, vol: 0.18, lp: 3500 },
  ],
  crit: [
    { wave: 'square', f: 880, f2: 560, dur: 0.07, vol: 0.16, lp: 4000, curve: 3 },
    { wave: 'noise', f: 0, dur: 0.05, vol: 0.25, lp: 5000 },
    { wave: 'sine', f: 1760, dur: 0.12, vol: 0.12, curve: 4 },
  ],
  kill: [
    { wave: 'noise', f: 0, dur: 0.1, vol: 0.25, lp: 1600, lp2: 300 },
    { wave: 'sine', f: 240, f2: 90, dur: 0.1, vol: 0.25 },
  ],
  bigKill: join(boom(55, 1.1, 0.8), chime(E5, 0.15, 0.2, 0.8)),
  swing: whoosh(3200, 1200, 0.09, 0.14),
  mote: [{ wave: 'sine', f: 1500, f2: 2100, dur: 0.05, vol: 0.06, curve: 3 }],
  hurt: [
    { wave: 'sine', f: 170, f2: 70, dur: 0.18, vol: 0.35 },
    { wave: 'tri', f: 420, f2: 200, dur: 0.12, vol: 0.3 },
    { wave: 'noise', f: 0, dur: 0.1, vol: 0.3, lp: 1800 },
  ],
  hurtBig: [
    { wave: 'sine', f: 140, f2: 45, dur: 0.35, vol: 0.3 },
    { wave: 'noise', f: 0, dur: 0.22, vol: 0.45, lp: 2200, lp2: 300 },
    { wave: 'square', f: 260, f2: 120, dur: 0.2, vol: 0.18, lp: 1500 },
  ],
  heal: [
    { wave: 'sine', f: A5, f2: E6, dur: 0.3, vol: 0.12, a: 0.05, curve: 2 },
    { wave: 'sine', f: E5, dur: 0.3, vol: 0.08, a: 0.06 },
  ],
  explode: boom(70, 0.5, 0.5),
  slam: join(boom(45, 0.7, 0.7), [{ wave: 'noise', f: 0, dur: 0.06, vol: 0.4, lp: 3000 }]),
  parry: clang(1250, 0.45, 0.5),
  ward: join(chime(G6, 0, 0.18, 0.4), chime(E6, 0.05, 0.12, 0.4)),

  // ---- abilities by class (slot 0..3)
  emberWave: [
    { wave: 'noise', f: 0, dur: 0.4, vol: 0.4, a: 0.02, lp: 2800, lp2: 500 },
    { wave: 'saw', f: 140, f2: 70, dur: 0.3, vol: 0.12, lp: 900 },
  ],
  emberBlink: [
    { wave: 'sine', f: 300, f2: 1300, dur: 0.18, vol: 0.2 },
    ...whoosh(800, 5000, 0.18, 0.18),
  ],
  emberNova: join(boom(60, 0.9, 0.75), whoosh(4000, 300, 0.7, 0.3)),
  zap: [
    { wave: 'square', f: 1600, f2: 2400, dur: 0.07, vol: 0.12, lp: 6000 },
    { wave: 'sine', f: 2400, f2: 1800, dur: 0.15, vol: 0.12, curve: 3 },
  ],
  duskDash: join(whoosh(1500, 6000, 0.2, 0.35), [{ wave: 'saw', f: 400, f2: 900, dur: 0.12, vol: 0.06, lp: 3000 }]),
  duskStep: whoosh(5000, 1800, 0.22, 0.22),
  duskExecute: [
    { wave: 'saw', f: 220, f2: 50, dur: 0.35, vol: 0.3, lp: 1800, lp2: 300 },
    { wave: 'noise', f: 0, dur: 0.2, vol: 0.45, lp: 5000, lp2: 800 },
    { wave: 'sine', f: 80, f2: 40, dur: 0.4, vol: 0.3 },
  ],
  bulwarkSlam: join(clang(420, 0.35, 0.35), boom(60, 0.35, 0.45)),
  bulwarkCharge: join(whoosh(600, 3000, 0.25, 0.3), [{ wave: 'sine', f: 90, f2: 50, dur: 0.25, delay: 0.18, vol: 0.3 }, { wave: 'tri', f: 320, f2: 160, dur: 0.18, delay: 0.18, vol: 0.3 }]),
  bulwarkBastion: join(clang(330, 0.4, 0.9), horn(165, 0.6, 0.25)),
  lumenBurst: join(chime(C6, 0, 0.18, 0.45), chime(G5, 0.02, 0.14, 0.45), [{ wave: 'noise', f: 0, dur: 0.2, vol: 0.12, lp: 6000, hp: 2000 }]),
  lumenSanctuary: join(chime(C5, 0, 0.25, 1.2), chime(E5, 0.08, 0.2, 1.1), chime(G5, 0.16, 0.18, 1.0), chime(C6, 0.24, 0.15, 0.9)),
  lumenStep: [{ wave: 'sine', f: E6, f2: G6, dur: 0.2, vol: 0.14, curve: 3 }, ...whoosh(2000, 6000, 0.18, 0.12)],

  // Slagbinder: molten slag poured, hardening and cracking.
  /** Slag Lob: a wet molten glob that lands with a splat. */
  slagLob: [
    { wave: 'sine', f: 700, f2: 220, dur: 0.12, vol: 0.14, curve: 2 },
    { wave: 'tri', f: 1400, f2: 500, dur: 0.08, vol: 0.06, curve: 3 },
    { wave: 'noise', f: 0, dur: 0.12, delay: 0.06, vol: 0.18, lp: 2600, lp2: 700, curve: 2.5 },
  ],
  /** Molten Plating: slag pours over a hero with a sizzle, then hardens with a dull clink. */
  slagPlate: join(
    [{ wave: 'noise', f: 0, dur: 0.45, vol: 0.22, a: 0.05, lp: 5000, lp2: 2500, hp: 1200, trem: [22, 0.4] },
     { wave: 'saw', f: 180, f2: 120, dur: 0.35, vol: 0.12, a: 0.04, lp: 1400 }],
    clang(520, 0.22, 0.4).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.32 })),
  ),
  /** Interpose: a heavy leap, landing in front of a friend with a thud. */
  slagLeap: join(whoosh(500, 3500, 0.22, 0.3), boom(70, 0.35, 0.4).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.18 }))),
  /** Cooling Shell: a quenching hiss as the slag sets hard, with crackles and a deep ring. */
  coolingShell: join(
    [{ wave: 'noise', f: 0, dur: 0.9, vol: 0.3, a: 0.03, lp: 8000, lp2: 1800, hp: 900, curve: 1.6 }],
    clang(260, 0.35, 0.9),
    ...[0.25, 0.4, 0.62].map((d) => [{ wave: 'noise' as const, f: 0, dur: 0.05, delay: d, vol: 0.25, lp: 7000, hp: 2000, curve: 3 }]),
  ),
  /** Clinker: a lump of slag hurled hard, cracking on impact. */
  clinker: join(whoosh(2500, 900, 0.14, 0.25), [
    { wave: 'noise', f: 0, dur: 0.1, delay: 0.12, vol: 0.45, lp: 4500, lp2: 900, curve: 2.5 },
    { wave: 'tri', f: 300, f2: 140, dur: 0.18, delay: 0.12, vol: 0.25, curve: 2 },
    { wave: 'noise', f: 0, dur: 0.04, delay: 0.2, vol: 0.25, lp: 7000, hp: 2500, curve: 3 },
  ]),
  /** A foe turns Brittle: hardened slag cracking like glass. */
  brittle: join(
    ...[0, 0.05, 0.11].map((d, k) => [{ wave: 'noise' as const, f: 0, dur: 0.04, delay: d, vol: 0.3 - k * 0.06, lp: 9000, hp: 2500, curve: 3 }]),
    [{ wave: 'tri', f: 2600, f2: 2200, dur: 0.2, vol: 0.08, curve: 3 }],
  ),

  // Ability options (one per class, chosen instead of a slot's own ability).
  /** Ember Ward: a ring of fire flares up around you, crackling. */
  emberWard: join(whoosh(400, 4500, 0.4, 0.3), [
    { wave: 'saw', f: 160, f2: 320, dur: 0.45, vol: 0.12, a: 0.08, lp: 2200, vib: [13, 0.03] },
    ...[0.12, 0.22, 0.35, 0.5].map((d) => ({ wave: 'noise' as const, f: 0, dur: 0.04, delay: d, vol: 0.18, lp: 7000, hp: 2000, curve: 3 })),
  ]),
  /** Hamstring: a quick low cut, then the foe drags, slowed. */
  hamstring: join(whoosh(5000, 1500, 0.12, 0.3), [
    { wave: 'saw', f: 500, f2: 140, dur: 0.12, vol: 0.18, lp: 3500 },
    { wave: 'tri', f: 260, f2: 130, dur: 0.5, delay: 0.1, vol: 0.14, a: 0.05, curve: 1.5, vib: [4, 0.03] },
  ]),
  /** Muster: a rising two-horn call over a stamp. */
  rallyingCry: join(
    horn(note(-16), 0.35, 0.32),
    horn(note(-9), 0.8, 0.36).map((v) => ({ ...v, delay: 0.25 })),
    boom(70, 0.4, 0.4),
  ),
  /** Glow Pool: a spring of light opens, a bright rising arpeggio with shimmer. */
  lightwell: join(chime(C5, 0, 0.22, 0.9), chime(G5, 0.1, 0.2, 0.9), chime(C6, 0.2, 0.2, 1.0), chime(E6, 0.3, 0.16, 1.1), [
    { wave: 'noise', f: 0, dur: 1.0, vol: 0.08, a: 0.4, lp: 10000, hp: 5000, trem: [5, 0.5] },
  ]),
  /** Cinder Sump: a pool of slag spreads, glugging and bubbling. */
  slagPit: join(
    [{ wave: 'noise', f: 0, dur: 0.7, vol: 0.22, a: 0.08, lp: 1800, lp2: 600, trem: [9, 0.6] }],
    ...[0.05, 0.2, 0.33, 0.5, 0.62].map((d, k) => [{ wave: 'sine' as const, f: 260 + k * 40, f2: 520 + k * 60, dur: 0.07, delay: d, vol: 0.16, curve: 2 }]),
  ),

  // ---- interrupts and enemy casts
  interrupt: join(clang(1480, 0.5, 0.45), [
    { wave: 'square', f: 2000, f2: 600, dur: 0.12, vol: 0.12, lp: 5000 },
    { wave: 'noise', f: 0, dur: 0.08, vol: 0.35, lp: 7000, hp: 1500 },
  ]),
  castWarn: [
    // Two-tone alarm: read at a glance even with the screen busy.
    { wave: 'tri', f: E5, dur: 0.16, vol: 0.3, curve: 1 },
    { wave: 'tri', f: A5, dur: 0.22, delay: 0.17, vol: 0.32, curve: 1.4 },
    { wave: 'sine', f: A5 / 2, dur: 0.4, vol: 0.12, a: 0.05 },
  ],
  castDone: boom(50, 0.45, 0.45),
  glare: [
    { wave: 'noise', f: 0, dur: 0.6, vol: 0.35, a: 0.25, lp: 2000, lp2: 9000, curve: 1.2 },
    { wave: 'sine', f: 2000, f2: 3000, dur: 0.6, vol: 0.12, a: 0.3, curve: 1.2 },
  ],
  glareHit: join(boom(50, 0.5, 0.55), [{ wave: 'sine', f: 3000, f2: 1500, dur: 0.3, vol: 0.15 }]),
  crack: [
    { wave: 'noise', f: 0, dur: 0.12, vol: 0.5, lp: 7000, hp: 1200, curve: 3 },
    { wave: 'tri', f: 180, f2: 90, dur: 0.15, vol: 0.2 },
  ],
  brand: join(boom(80, 0.4, 0.45), [{ wave: 'saw', f: 300, f2: 120, dur: 0.3, vol: 0.12, lp: 1500 }]),

  // ---- loot and progress
  drop: chime(C6, 0, 0.18, 0.25),
  dropRare: join(chime(E6, 0, 0.2, 0.4), chime(G6, 0.07, 0.16, 0.5)),
  dropEpic: join(chime(C6, 0, 0.2, 0.5), chime(E6, 0.06, 0.18, 0.5), chime(G6, 0.12, 0.18, 0.7)),
  dropMythic: join(chime(C5, 0, 0.22, 1.0), chime(G5, 0.06, 0.2, 1.0), chime(C6, 0.12, 0.2, 1.0), chime(E6, 0.18, 0.2, 1.1), chime(G6, 0.24, 0.18, 1.2)),
  equip: [
    { wave: 'square', f: 1200, dur: 0.05, vol: 0.08, lp: 4000 },
    { wave: 'square', f: 1800, dur: 0.12, delay: 0.06, vol: 0.08, lp: 4000, curve: 3 },
  ],
  chest: join(chime(G5, 0, 0.2, 0.4), chime(C6, 0.06, 0.2, 0.4), chime(E6, 0.12, 0.2, 0.5), chime(G6, 0.18, 0.2, 0.7), [{ wave: 'noise', f: 0, dur: 0.3, vol: 0.1, lp: 9000, hp: 4000 }]),
  gather: [{ wave: 'noise', f: 0, dur: 0.3, vol: 0.2, a: 0.05, lp: 1500, lp2: 5000 }, { wave: 'sine', f: 300, f2: 600, dur: 0.3, vol: 0.12 }],
  levelUp: join(
    chime(C5, 0, 0.3, 0.6), chime(E5, 0.08, 0.3, 0.6), chime(G5, 0.16, 0.3, 0.6), chime(C6, 0.24, 0.35, 1.0),
    [{ wave: 'noise', f: 0, dur: 0.8, vol: 0.08, a: 0.3, lp: 9000, hp: 5000 }],
  ),
  /** An achievement unlocked at the end of a run: a bright four-note rise over a warm horn, with a sparkle. */
  achievement: join(
    horn(note(-21), 1.2, 0.22),
    chime(G5, 0, 0.26, 0.5), chime(C6, 0.1, 0.26, 0.5), chime(E6, 0.2, 0.26, 0.6), chime(G6, 0.3, 0.3, 1.2),
    [{ wave: 'noise', f: 0, dur: 0.9, delay: 0.3, vol: 0.08, a: 0.2, lp: 11000, hp: 6000 }],
  ),
  /** A capstone taken: a low anvil ring, then a deep rising horn and a bell, as the branch opens up below. */
  capstone: join(
    clang(note(-9), 0.3, 1.2),
    horn(note(-21), 0.9, 0.28).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.12 })),
    horn(note(-14), 0.9, 0.26).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.32 })),
    chime(G6, 0.5, 0.2, 0.9),
  ),
  /** A new season-track level: a quick climbing run of five notes into a bright bell, over a whoosh. */
  seasonUp: join(
    chime(C5, 0, 0.2, 0.3), chime(E5, 0.06, 0.2, 0.3), chime(G5, 0.12, 0.2, 0.3), chime(C6, 0.18, 0.22, 0.3),
    clang(note(22), 0.2, 1.0).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.26 })),
    whoosh(800, 7000, 0.4, 0.1),
  ),
  /** A title or reward unlocked: a smaller three-note chime. */
  unlock: join(chime(E5, 0, 0.22, 0.4), chime(A5, 0.08, 0.22, 0.4), chime(E6, 0.16, 0.24, 0.8)),
  quest: join(chime(G5, 0, 0.25, 0.4), chime(D5 * 2, 0.1, 0.25, 0.7)),
  victory: join(
    horn(note(-9), 0.5, 0.25), chime(C5, 0, 0.25, 0.4), chime(E5, 0.15, 0.25, 0.4), chime(G5, 0.3, 0.28, 0.4),
    chime(C6, 0.45, 0.32, 1.4), chime(E6, 0.45, 0.18, 1.4), horn(note(3) / 2, 1.2, 0.2).map((v) => ({ ...v, delay: 0.45 })),
  ),
  defeat: [
    { wave: 'tri', f: note(0), dur: 0.5, vol: 0.25, a: 0.02, curve: 1.5 },
    { wave: 'tri', f: note(-4), dur: 0.5, delay: 0.35, vol: 0.25, a: 0.02, curve: 1.5 },
    { wave: 'tri', f: note(-7), dur: 1.4, delay: 0.7, vol: 0.28, a: 0.02, curve: 1.5, vib: [4, 0.01] },
    { wave: 'sine', f: note(-19), dur: 2.0, delay: 0.7, vol: 0.3, a: 0.2 },
  ],
  /** G6: an ally starts picking a downed hero up: a soft rising pair. */
  reviveStart: join(chime(C5, 0, 0.2, 0.4), chime(G5, 0.1, 0.2, 0.5)),
  /** Each second of a pick-up: a quiet ember pulse (louder as it nears the end). */
  reviveTick: [
    { wave: 'tri', f: E6, dur: 0.14, vol: 0.12, curve: 3 },
    { wave: 'noise', f: 0, dur: 0.08, vol: 0.06, lp: 8000, hp: 3000, curve: 3 },
  ],
  /** The pick-up broke off (the ally stepped out): a fizzling fall. */
  reviveLost: [
    { wave: 'tri', f: G5, f2: C5, dur: 0.35, vol: 0.18, curve: 1.5 },
    { wave: 'noise', f: 0, dur: 0.3, vol: 0.1, lp: 4000, lp2: 800, hp: 600, curve: 2 },
  ],
  /** The boss fight's one pick-up is spent: a low toll, so everyone knows the next fall is for good. */
  revivesSpent: join(clang(note(-2), 0.4, 1.4), clang(note(-14), 0.25, 1.4), horn(note(-14), 1.0, 0.22)),
  revive: join(chime(C5, 0, 0.25, 0.8), chime(G5, 0.1, 0.25, 0.8), chime(C6, 0.2, 0.3, 1.0), whoosh(500, 6000, 0.6, 0.15)),

  // ---- encounters
  bossSpawn: join(horn(note(-28) * 2, 1.6, 0.4), horn(note(-28), 1.6, 0.25), horn(note(-21), 1.4, 0.3).map((v) => ({ ...v, delay: 0.25 })), boom(40, 1.2, 0.5)),
  eliteSpawn: horn(note(-21), 0.8, 0.35),
  /** A named elite joins the fight: a short minor fanfare (low, then a minor third and a fifth up) under a cold bell. */
  namedSpawn: join(
    horn(note(-21), 0.35, 0.3),
    horn(note(-18), 0.35, 0.3).map((v) => ({ ...v, delay: 0.22 })),
    horn(note(-14), 0.9, 0.34).map((v) => ({ ...v, delay: 0.44 })),
    clang(note(15), 0.2, 0.9).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.44 })),
  ),
  /** A named elite falls: a heavy thud, then a rising sparkle for the loot it drops. */
  namedKill: join(boom(60, 0.6, 0.45), chime(E5, 0.15, 0.22, 0.5), chime(B5(), 0.25, 0.22, 0.5), chime(E6, 0.35, 0.26, 0.9)),
  rareSpawn: join(horn(note(-16), 0.8, 0.3), chime(E6, 0.3, 0.15, 0.6)),
  enrage: [
    { wave: 'saw', f: 70, f2: 55, dur: 1.0, vol: 0.4, a: 0.1, lp: 900, lp2: 2000, vib: [9, 0.05] },
    { wave: 'saw', f: 141, f2: 111, dur: 1.0, vol: 0.3, a: 0.1, lp: 2000, vib: [9, 0.05] },
    { wave: 'noise', f: 0, dur: 0.9, vol: 0.3, a: 0.2, lp: 1200 },
    { wave: 'sine', f: 45, dur: 1.0, vol: 0.25, a: 0.1 },
    // A snarl in the 500 Hz-2 kHz band, so a phone speaker hears the enrage over a busy fight.
    { wave: 'square', f: 282, f2: 222, dur: 0.9, vol: 0.1, a: 0.1, lp: 2400, vib: [9, 0.05] },
  ],
  phase: join(boom(45, 0.8, 0.55), [{ wave: 'saw', f: 110, f2: 220, dur: 0.6, vol: 0.12, lp: 900, a: 0.2 }]),
  riftOpen: [
    { wave: 'sine', f: 220, f2: 55, dur: 0.9, vol: 0.25, a: 0.2, vib: [7, 0.04] },
    { wave: 'tri', f: 660, f2: 220, dur: 0.9, vol: 0.2, a: 0.2, vib: [7, 0.04] },
    { wave: 'noise', f: 0, dur: 0.9, vol: 0.25, a: 0.4, lp: 600, lp2: 2400 },
  ],
  riftClosed: join(boom(90, 0.4, 0.4), chime(E6, 0.05, 0.15, 0.4)),
  fork: join(chime(E5, 0, 0.2, 0.5), chime(A5, 0.12, 0.2, 0.6)),
  gate: [{ wave: 'tri', f: 660, dur: 0.06, vol: 0.18 }, { wave: 'tri', f: 990, dur: 0.1, delay: 0.06, vol: 0.18 }],
  soakOk: chime(A5, 0, 0.22, 0.4),
  soakFail: [{ wave: 'square', f: 280, f2: 200, dur: 0.3, vol: 0.14, lp: 1800 }],

  // ---- the Hammerdeep (group dungeon): Ondrel of the Hammerdeep
  /** Anvilfall wind-up (2.5 s): a swelling, rising grind the whole party learns to fear. */
  anvilWarn: [
    { wave: 'saw', f: 90, f2: 260, dur: 2.5, vol: 0.3, a: 2.2, curve: 0.6, lp: 400, lp2: 2600 },
    { wave: 'saw', f: 181, f2: 523, dur: 2.5, vol: 0.12, a: 2.2, curve: 0.6, lp: 800, lp2: 3000 },
    { wave: 'noise', f: 0, dur: 2.5, vol: 0.18, a: 2.3, curve: 0.5, lp: 500, lp2: 4000 },
    { wave: 'tri', f: E5, dur: 0.16, vol: 0.25, curve: 1 },
    { wave: 'tri', f: E5, dur: 0.16, delay: 1.2, vol: 0.3, curve: 1 },
    { wave: 'tri', f: A5, dur: 0.22, delay: 2.1, vol: 0.35, curve: 1 },
  ],
  anvilfall: join(clang(196, 0.6, 1.2), boom(40, 1.1, 0.8)),
  /** Choir of Iron: the party-wide pulse, a dissonant iron chord that thumps everyone. */
  choir: join(
    [note(-17), note(-11), note(-10)].flatMap((f) => [
      { wave: 'saw' as const, f, dur: 0.9, vol: 0.14, a: 0.25, curve: 1.6, lp: 1600, vib: [5.5, 0.012] as [number, number] },
    ]),
    boom(55, 0.5, 0.45).map((v) => ({ ...v, delay: 0.3 })),
  ),
  /** Slag Grip: molten slag clamps on, a sizzle that gets angrier with each stack. */
  slag: [
    { wave: 'noise', f: 0, dur: 0.45, vol: 0.3, a: 0.01, lp: 6000, lp2: 2500, hp: 1500, trem: [22, 0.6] },
    { wave: 'saw', f: 220, f2: 130, dur: 0.25, vol: 0.14, lp: 1400 },
    { wave: 'tri', f: 380, f2: 180, dur: 0.12, vol: 0.2 },
  ],
  /** Cleanse: an ally's heal knocks the slag loose, a bright rinse upward. */
  cleanse: join(chime(E6, 0, 0.18, 0.4), chime(A5 * 2, 0.06, 0.16, 0.5), whoosh(1500, 8000, 0.3, 0.14)),
  sweep: join(whoosh(900, 4500, 0.35, 0.4), [{ wave: 'saw', f: 160, f2: 90, dur: 0.3, vol: 0.12, lp: 1500 }]),

  /** You are Anvilfall's target: a sharp, rising triple ping that cuts through everything. */
  targeted: [
    { wave: 'square', f: note(19), dur: 0.09, vol: 0.16, lp: 5000, curve: 1 },
    { wave: 'square', f: note(19), dur: 0.09, delay: 0.12, vol: 0.18, lp: 5000, curve: 1 },
    { wave: 'square', f: note(24), dur: 0.2, delay: 0.24, vol: 0.2, lp: 5000, curve: 1.5 },
    { wave: 'sine', f: note(12), dur: 0.5, vol: 0.12, a: 0.02 },
  ],

  // ---- boss phase changes (one per boss; 'phase' above is the fallback)
  phaseKiln: join(boom(45, 0.9, 0.55), [
    { wave: 'noise', f: 0, dur: 0.9, vol: 0.4, a: 0.3, lp: 600, lp2: 5000, curve: 1.2 },
    { wave: 'saw', f: 90, f2: 180, dur: 0.8, vol: 0.18, a: 0.2, lp: 1400, vib: [8, 0.03] },
  ]),
  phaseMaelra: join(boom(40, 0.8, 0.5), [
    { wave: 'noise', f: 0, dur: 1.1, vol: 0.35, a: 0.5, lp: 300, lp2: 3000, curve: 1.3, trem: [3, 0.4] },
    { wave: 'sine', f: 330, f2: 110, dur: 1.0, vol: 0.2, a: 0.1 },
  ], chime(E6, 0.6, 0.12, 0.4), chime(A5 * 2, 0.75, 0.1, 0.4)),
  phaseLens: join(
    chime(E5, 0, 0.18, 1.2), chime(note(11), 0.05, 0.16, 1.2), chime(note(18), 0.1, 0.15, 1.2),
    whoosh(2000, 10000, 0.9, 0.18), boom(38, 0.9, 0.45).map((v) => ({ ...v, delay: 0.5 })),
  ),
  phaseOndrel: join(clang(196, 0.5, 0.7), clang(147, 0.55, 0.9).map((v) => ({ ...v, delay: 0.32 })), boom(42, 0.9, 0.55).map((v) => ({ ...v, delay: 0.32 }))),
  phaseShadow: [
    { wave: 'saw', f: note(-17), dur: 1.4, vol: 0.14, a: 0.9, curve: 0.8, lp: 900 },
    { wave: 'saw', f: note(-16), dur: 1.4, vol: 0.14, a: 0.9, curve: 0.8, lp: 900 },
    { wave: 'saw', f: note(-11), dur: 1.4, vol: 0.12, a: 0.9, curve: 0.8, lp: 1200 },
    { wave: 'noise', f: 0, dur: 1.4, vol: 0.25, a: 1.1, curve: 0.6, lp: 400, lp2: 3000 },
    ...boom(40, 0.8, 0.5).map((v) => ({ ...v, delay: 1.2 })),
  ],

  // ---- the Ashvents: Ysmeret, the Twofold Flame
  /** Twin Vents opening: two hot breaths, one each side, and a gold rising call to split up. */
  ventWarn: join(
    whoosh(400, 3500, 0.55, 0.35), whoosh(400, 3500, 0.55, 0.3).map((v) => ({ ...v, delay: 0.45 })),
    chime(E5, 0.1, 0.2, 0.5), chime(B5(), 0.55, 0.22, 0.7),
  ),
  /** Scatter Embers (and the raid's Cinder Marks): a crackling sparkle that says "get apart". */
  scatterWarn: [
    { wave: 'noise', f: 0, dur: 1.2, vol: 0.25, a: 0.9, curve: 0.7, lp: 3000, lp2: 9000, hp: 1200, trem: [14, 0.7] },
    { wave: 'square', f: note(14), dur: 0.08, vol: 0.12, lp: 5000 },
    { wave: 'square', f: note(14), dur: 0.08, delay: 0.5, vol: 0.12, lp: 5000 },
    { wave: 'square', f: note(17), dur: 0.12, delay: 1.0, vol: 0.14, lp: 5000 },
  ],
  scatter: join(...[0, 0.05, 0.11, 0.16].map((d, k) => boom(90 + k * 20, 0.3, 0.3).map((v) => ({ ...v, delay: d })))),
  /** Bellow Slam wind-up: shorter cousin of Anvilfall's, a growl with a single alarm. */
  bellowWarn: [
    { wave: 'saw', f: 110, f2: 240, dur: 1.5, vol: 0.28, a: 1.3, curve: 0.6, lp: 500, lp2: 2400 },
    { wave: 'noise', f: 0, dur: 1.5, vol: 0.2, a: 1.3, curve: 0.5, lp: 600, lp2: 3500 },
    { wave: 'tri', f: A5, dur: 0.2, delay: 1.25, vol: 0.3, curve: 1 },
  ],
  bellow: join(boom(45, 0.9, 0.75), whoosh(5000, 400, 0.6, 0.35)),
  phaseYsmeret: join(whoosh(300, 6000, 0.7, 0.4), whoosh(300, 6000, 0.7, 0.35).map((v) => ({ ...v, delay: 0.35 })), boom(45, 0.9, 0.55).map((v) => ({ ...v, delay: 0.6 }))),

  // ---- the Coldmarrow: Nhevra, the Cold Hearth
  /** Long Night wind-up: a choir-like wind swelling as the cold closes in. */
  longNightWarn: [
    ...[note(-9), note(-6), note(-2), note(3)].map((f) => ({ wave: 'tri' as const, f, dur: 2.2, vol: 0.1, a: 1.8, curve: 0.6, lp: 1800, vib: [5, 0.01] as [number, number] })),
    { wave: 'noise', f: 0, dur: 2.2, vol: 0.25, a: 1.9, curve: 0.5, lp: 800, lp2: 6000, hp: 300 },
  ],
  /** Long Night lands: the room freezes with a glassy crack. */
  longNight: [
    { wave: 'noise', f: 0, dur: 0.2, vol: 0.5, lp: 9000, hp: 2000, curve: 3 },
    { wave: 'sine', f: note(27), dur: 1.2, vol: 0.12, curve: 3 },
    { wave: 'sine', f: note(27) * 2.76, dur: 0.8, vol: 0.06, curve: 4 },
    { wave: 'sine', f: note(22), dur: 1.4, delay: 0.05, vol: 0.12, curve: 3 },
    ...boom(40, 0.8, 0.4),
  ],
  /** Snuff: your coal's light shrinks (a fire hissing down). */
  snuff: [
    { wave: 'noise', f: 0, dur: 0.6, vol: 0.35, lp: 6000, lp2: 300, curve: 1.5 },
    { wave: 'sine', f: 400, f2: 120, dur: 0.5, vol: 0.15 },
  ],
  snufferTide: join(whoosh(200, 1500, 0.9, 0.3), [{ wave: 'tri', f: note(-2), f2: note(-7), dur: 0.9, vol: 0.18, a: 0.2, vib: [6, 0.02] }]),
  /** Frost Lace: a ring of ice knitting itself at your feet, high glassy notes closing in. */
  frostLace: join(
    ...[0, 0.09, 0.18, 0.27, 0.36].map((d, k) => chime(note(27 - k * 2), d, 0.16, 0.35)),
    [{ wave: 'noise', f: 0, dur: 0.6, vol: 0.12, a: 0.4, lp: 9000, hp: 3000 }],
  ),
  /** Ice cracking: Nhevra's phase change. */
  phaseIce: join(
    ...[0, 0.12, 0.2, 0.38].map((d, k) => [{ wave: 'noise' as const, f: 0, dur: 0.12, delay: d, vol: 0.4 - k * 0.05, lp: 8000, hp: 1500, curve: 3 }]),
    [{ wave: 'saw', f: 70, f2: 50, dur: 1.2, delay: 0.1, vol: 0.2, a: 0.3, lp: 700, vib: [3, 0.04] }],
    boom(40, 0.7, 0.35).map((v) => ({ ...v, delay: 0.38 })),
  ),

  // ---- the Wrackline: Hessa of the Ebb
  /** The Ebb is coming (3 s warning): the sea draws in, a rising inrush over the water sucking back. */
  ebbWarn: [
    { wave: 'noise', f: 0, dur: 2.8, vol: 0.35, a: 2.4, curve: 0.5, lp: 300, lp2: 4500, hp: 200 },
    { wave: 'tri', f: 220, f2: 110, dur: 2.8, vol: 0.14, a: 1.0, curve: 0.8, vib: [3, 0.03] },
    { wave: 'sine', f: 600, f2: 1500, dur: 2.6, vol: 0.08, a: 2.0, curve: 0.6 },
  ],
  /** The Ebb pulls: a heavy, churning drag toward the drain. */
  ebbPull: [
    { wave: 'saw', f: 75, f2: 60, dur: 2.2, vol: 0.3, a: 0.15, lp: 900, trem: [5, 0.5] },
    { wave: 'saw', f: 150, f2: 120, dur: 2.2, vol: 0.14, a: 0.15, lp: 1800, trem: [5, 0.5] },
    { wave: 'noise', f: 0, dur: 2.2, vol: 0.3, a: 0.1, lp: 1800, lp2: 700, trem: [5, 0.6] },
    // A churning surface hiss on the same tremolo: phone speakers lose the rumble, so this carries the pull (busycheck had it 2.5 dB over a party).
    { wave: 'noise', f: 0, dur: 2.1, vol: 0.26, a: 0.12, lp: 5000, lp2: 2500, hp: 900, trem: [5, 0.7] },
    { wave: 'saw', f: 300, f2: 240, dur: 2.1, vol: 0.11, a: 0.2, lp: 2400, trem: [5, 0.5] },
  ],
  /** Sink winds up (2.2 s): a raft's planks groan and bubbles rise under it. */
  sinkWarn: join(
    [{ wave: 'saw', f: 180, f2: 120, dur: 1.9, vol: 0.14, a: 0.3, lp: 1800, vib: [2.5, 0.06] }],
    // The bubbles carry the warning on a phone (a busy party masked them at 0.13), so they sit brighter and louder.
    ...[0.2, 0.5, 0.75, 1.0, 1.2, 1.4, 1.6, 1.75].map((d, k) => [{ wave: 'sine' as const, f: 420 + k * 55, f2: 820 + k * 90, dur: 0.07, delay: d, vol: 0.18, curve: 2 }]),
  ),
  /** Sink lands: a raft goes under with a splash and a deep glug. */
  sink: join(whoosh(3000, 500, 0.5, 0.4), boom(50, 0.7, 0.45), [{ wave: 'sine', f: 400, f2: 120, dur: 0.4, delay: 0.15, vol: 0.2 }]),
  /** Haul winds up (1.6 s): a hawser creaks taut. */
  haulWarn: [
    { wave: 'saw', f: 140, f2: 260, dur: 1.5, vol: 0.14, a: 0.5, lp: 1600, vib: [9, 0.03] },
    { wave: 'noise', f: 0, dur: 1.5, vol: 0.12, a: 1.0, lp: 2500, hp: 600, trem: [13, 0.7] },
  ],
  /** Haul lands: the rope snaps tight, a yank and a thud. */
  haul: join(whoosh(800, 4000, 0.2, 0.35), [{ wave: 'saw', f: 300, f2: 90, dur: 0.18, vol: 0.2, lp: 2500 }], boom(70, 0.35, 0.4).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.15 }))),
  /** Call the Shoal: a hollow conch call, then splashes as Lurkers swim in. */
  shoalCall: join(
    horn(note(-17), 0.8, 0.3),
    ...[0.6, 0.8].map((d) => whoosh(4000, 900, 0.25, 0.25).map((v) => ({ ...v, delay: d }))),
  ),
  /** Hessa's phase 2, Riptide: a wave breaks over the harbour under a falling horn. */
  phaseHessa: join(whoosh(500, 6000, 1.0, 0.45), boom(40, 1.0, 0.5), horn(note(-14), 1.2, 0.3), horn(note(-19), 1.0, 0.28).map((v) => ({ ...v, delay: 0.5 }))),
  // Verb-set procs (sim/content/sets.ts). Short and mid-loud: they reward a habit, so they repeat often.
  /** Wrackrider: Planted. Two stakes knock into wet timber. */
  planted: join(
    [{ wave: 'sine', f: 240, f2: 150, dur: 0.12, vol: 0.2, curve: 3 }, { wave: 'noise', f: 0, dur: 0.03, vol: 0.22, lp: 4000, hp: 600 }],
    [{ wave: 'sine', f: 300, f2: 180, dur: 0.1, delay: 0.07, vol: 0.16, curve: 3 }, { wave: 'noise', f: 0, dur: 0.025, delay: 0.07, vol: 0.18, lp: 4500, hp: 700 }],
  ),
  /** Tidewalker: the 30% surge is ready. A quick rising swell of water. */
  surgeReady: join(whoosh(700, 5000, 0.28, 0.18), [{ wave: 'sine', f: E5, f2: A5, dur: 0.22, vol: 0.1, a: 0.04, curve: 2 }]),
  /** Kilnbreaker: an interrupt sharpens you. A whetstone scrape that rings. */
  sharpen: join([{ wave: 'noise', f: 0, dur: 0.14, vol: 0.16, lp: 9000, hp: 3000, curve: 2 }], clang(1900, 0.18, 0.3).map((v) => ({ ...v, delay: 0.08 }))),
  /** Glarewarden: stepped out of a marked attack in time. A light sidestep and a teal ping. */
  dodged: join(whoosh(4500, 1400, 0.16, 0.16), chime(E6, 0.05, 0.14, 0.3)),
  /** Hearthkeeper: Warmth reaches 5. A low fire swells and two warm notes settle. */
  warmthFull: join(
    [{ wave: 'noise', f: 0, dur: 0.45, vol: 0.18, a: 0.15, lp: 2200, hp: 400, trem: [18, 0.5] }],
    chime(C5, 0.1, 0.16, 0.5), chime(G5, 0.22, 0.14, 0.5),
  ),

  // ---- the raid: Grandmother Slag
  ladleWarn: [
    { wave: 'sine', f: 180, f2: 90, dur: 1.0, vol: 0.15, a: 0.3, vib: [9, 0.05] },
    { wave: 'tri', f: 540, f2: 270, dur: 1.0, vol: 0.15, a: 0.3, vib: [9, 0.05] },
    { wave: 'noise', f: 0, dur: 1.0, vol: 0.3, a: 0.5, lp: 900, lp2: 2800, trem: [9, 0.6] },
  ],
  /** Ladle Pour lands: a heavy molten glug and splash. */
  ladle: join(boom(50, 0.8, 0.6), [
    { wave: 'sine', f: 140, f2: 360, dur: 0.15, delay: 0.05, vol: 0.25 },
    { wave: 'sine', f: 120, f2: 300, dur: 0.15, delay: 0.25, vol: 0.2 },
    { wave: 'noise', f: 0, dur: 0.5, delay: 0.05, vol: 0.25, lp: 2500, lp2: 600 },
  ]),
  /** The Pour winds up (1.6 s): the crucible tips, a deepening molten roar with a rising hiss. */
  pourWarn: [
    { wave: 'saw', f: 220, f2: 110, dur: 1.5, vol: 0.14, a: 0.6, lp: 1600, vib: [7, 0.04] },
    { wave: 'noise', f: 0, dur: 1.5, vol: 0.3, a: 1.2, curve: 0.6, lp: 1200, lp2: 5000, hp: 400 },
    { wave: 'tri', f: note(-2), f2: note(5), dur: 1.5, vol: 0.12, a: 0.8, curve: 0.8 },
  ],
  /** Crucible Vents: two soak circles. A bright two-bell call that says "stand here". */
  soakCall: join(chime(note(10), 0, 0.3, 0.45), chime(note(15), 0.18, 0.3, 0.45), chime(note(10), 0.5, 0.26, 0.45), chime(note(15), 0.68, 0.3, 0.7), [
    { wave: 'noise', f: 0, dur: 0.9, vol: 0.12, a: 0.3, lp: 3000, hp: 800, trem: [6, 0.5] },
  ]),
  /** Last Ember (a 5 s hard enrage): a low drone climbing a fifth under a racing pulse. */
  lastEmberWarn: join(
    [{ wave: 'saw', f: note(-26), f2: note(-19), dur: 2.6, vol: 0.2, a: 0.5, lp: 1200, lp2: 2400, vib: [5, 0.02] },
     { wave: 'square', f: note(-14), f2: note(-7), dur: 2.6, vol: 0.14, a: 1.0, lp: 3000 },
     { wave: 'saw', f: note(-2), f2: note(5), dur: 2.6, vol: 0.08, a: 1.4, lp: 3500 }],
    ...[0, 0.55, 1.0, 1.4, 1.75, 2.05, 2.3].map((d) => boom(70, 0.2, 0.3).map((v) => ({ ...v, delay: (v.delay ?? 0) + d }))),
  ),
  /** Last Ember goes off: everything burns. */
  lastEmber: join(boom(40, 1.6, 0.7), whoosh(200, 6000, 1.4, 0.5), horn(note(-21), 1.4, 0.3)),
  calledOut: join(horn(note(-16), 0.6, 0.3), chime(E5, 0.1, 0.2, 0.4)),
  /** Phase 2, The Pour: brass rises as the pit floods. */
  phaseRaid2: join(horn(note(-21), 1.6, 0.4), horn(note(-14), 1.4, 0.3).map((v) => ({ ...v, delay: 0.3 })),
    [{ wave: 'noise', f: 0, dur: 1.6, vol: 0.3, a: 0.6, lp: 300, lp2: 2500, trem: [7, 0.5] }], boom(40, 0.8, 0.5)),
  /** Phase 3, Last Ember: a bell, then a drum roll into double time. */
  phaseRaid3: join(clang(note(-9), 0.5, 1.4), ...[0.3, 0.42, 0.54, 0.62, 0.7, 0.76, 0.82].map((d) => boom(70, 0.18, 0.35).map((v) => ({ ...v, delay: d }))),
    horn(note(-14), 1.2, 0.3).map((v) => ({ ...v, delay: 0.85 }))),

  // ---- burnout (every fight ends: a 30 s warning, then the fire drains everyone)
  /** 30 s left: a rising heat alarm over a building sizzle. */
  burnoutWarn: [
    { wave: 'noise', f: 0, dur: 1.4, vol: 0.25, a: 1.0, curve: 0.7, lp: 1500, lp2: 7000, hp: 600 },
    { wave: 'square', f: note(7), dur: 0.14, vol: 0.13, lp: 4000, curve: 1 },
    { wave: 'square', f: note(10), dur: 0.14, delay: 0.3, vol: 0.14, lp: 4000, curve: 1 },
    { wave: 'square', f: note(14), dur: 0.14, delay: 0.6, vol: 0.15, lp: 4000, curve: 1 },
    { wave: 'square', f: note(19), dur: 0.35, delay: 0.9, vol: 0.17, lp: 4000, curve: 1.5 },
  ],
  /** The fire takes hold: a roaring ignition. */
  burnout: join(whoosh(300, 5000, 0.9, 0.45), boom(55, 0.9, 0.5), [
    { wave: 'saw', f: 110, f2: 220, dur: 0.9, vol: 0.15, a: 0.3, lp: 1500, vib: [11, 0.04] },
  ]),

  // ---- co-op
  /** G4: the party's tank or healer went down: the ally-down fall over a low alarm horn, because the fight just changed. */
  roleDown: join(
    [{ wave: 'tri', f: A5, f2: note(5), dur: 0.25, vol: 0.3, curve: 1.5 },
     { wave: 'tri', f: note(5), f2: note(0), dur: 0.4, delay: 0.22, vol: 0.3, curve: 1.5 }],
    horn(note(-14), 0.5, 0.3).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.15 })),
    horn(note(-15), 0.6, 0.3).map((v) => ({ ...v, delay: (v.delay ?? 0) + 0.55 })),
  ),
  allyDown: [
    { wave: 'tri', f: A5, f2: note(5), dur: 0.25, vol: 0.3, curve: 1.5 },
    { wave: 'tri', f: note(5), f2: note(0), dur: 0.4, delay: 0.22, vol: 0.3, curve: 1.5 },
    { wave: 'noise', f: 0, dur: 0.15, delay: 0.22, vol: 0.2, lp: 1500 },
  ],
  selfDown: join(boom(50, 0.8, 0.6), [
    { wave: 'tri', f: note(0), f2: note(-12), dur: 0.9, vol: 0.3, a: 0.02, curve: 1.2 },
  ]),
  allyUp: join(chime(G5, 0, 0.2, 0.5), chime(C6, 0.09, 0.22, 0.7)),
  matchFound: join(chime(C5, 0, 0.25, 0.4), chime(G5, 0.09, 0.25, 0.4), chime(C6, 0.18, 0.3, 0.9), whoosh(800, 7000, 0.4, 0.12)),
  partyJoin: join(chime(E5, 0, 0.22, 0.4), chime(A5, 0.08, 0.22, 0.6)),
  partyLeave: join(chime(A5, 0, 0.18, 0.4), chime(E5, 0.08, 0.18, 0.5)),

  // ---- interface
  click: [{ wave: 'tri', f: 1100, f2: 900, dur: 0.035, vol: 0.12, curve: 3 }],
  /** Picking one of a set (class, dungeon, tier): a bright, short double tick. */
  select: [
    { wave: 'tri', f: 1320, dur: 0.03, vol: 0.12, curve: 3 },
    { wave: 'sine', f: 1980, dur: 0.06, delay: 0.025, vol: 0.1, curve: 3 },
  ],
  /** Delve / Delve again: a confident rising pair with a breath of air. */
  confirm: join(chime(G5, 0, 0.18, 0.25), chime(D5 * 2, 0.07, 0.2, 0.4), whoosh(1200, 6000, 0.25, 0.08)),
  /** Back, close, main menu: the same pair, falling and softer. */
  back: [
    { wave: 'tri', f: 990, dur: 0.04, vol: 0.1, curve: 2 },
    { wave: 'tri', f: 740, dur: 0.07, delay: 0.04, vol: 0.09, curve: 3 },
  ],
  /** Opening a panel (bags, pause): a soft upward swell. */
  open: [{ wave: 'sine', f: 600, f2: 1100, dur: 0.12, vol: 0.12, a: 0.03 }, { wave: 'noise', f: 0, dur: 0.1, vol: 0.05, lp: 5000, hp: 1500 }],

  // ---- the ember purse (shared by every class): embers in, embers spent
  /** Salvage: the item crumbles to cinders and embers clink into the purse. */
  salvage: join(
    [{ wave: 'noise', f: 0, dur: 0.22, vol: 0.18, lp: 3500, lp2: 900, hp: 400, curve: 2 }],
    chime(E6, 0.12, 0.14, 0.25), chime(A5 * 2, 0.2, 0.14, 0.35),
  ),
  /** Upgrade at the Forge: one ringing hammer strike on the anvil, with sparks. */
  forge: join(clang(880, 0.32, 0.6), [
    { wave: 'noise', f: 0, dur: 0.05, vol: 0.35, lp: 6000, hp: 1200, curve: 3 },
    ...[0.06, 0.12, 0.2].map((d) => ({ wave: 'noise' as const, f: 0, dur: 0.03, delay: d, vol: 0.12, lp: 11000, hp: 5000, curve: 3 })),
  ]),
  /** Temper: a hammer strike, then the quench hiss as the reforged bonus sets. */
  temper: join(clang(660, 0.28, 0.4), [
    { wave: 'noise', f: 0, dur: 0.6, delay: 0.15, vol: 0.2, a: 0.02, lp: 9000, lp2: 2500, hp: 1500, curve: 1.6 },
  ]),
  /** Brew a potion: bubbles rise and a cork pops. */
  brew: join(
    ...[0, 0.07, 0.13, 0.2, 0.26].map((d, k) => [{ wave: 'sine' as const, f: 500 + k * 90, f2: 900 + k * 120, dur: 0.06, delay: d, vol: 0.12, curve: 2 }]),
    [{ wave: 'noise', f: 0, dur: 0.04, delay: 0.36, vol: 0.3, lp: 5000, hp: 900, curve: 3 }, { wave: 'sine', f: 900, f2: 500, dur: 0.06, delay: 0.36, vol: 0.12 }],
  ),
} satisfies Record<string, Recipe>;

export type SoundId = keyof typeof SOUNDS;
