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
  revive: join(chime(C5, 0, 0.25, 0.8), chime(G5, 0.1, 0.25, 0.8), chime(C6, 0.2, 0.3, 1.0), whoosh(500, 6000, 0.6, 0.15)),

  // ---- encounters
  bossSpawn: join(horn(note(-28) * 2, 1.6, 0.4), horn(note(-28), 1.6, 0.25), horn(note(-21), 1.4, 0.3).map((v) => ({ ...v, delay: 0.25 })), boom(40, 1.2, 0.5)),
  eliteSpawn: horn(note(-21), 0.8, 0.35),
  rareSpawn: join(horn(note(-16), 0.8, 0.3), chime(E6, 0.3, 0.15, 0.6)),
  enrage: [
    { wave: 'saw', f: 70, f2: 55, dur: 1.0, vol: 0.4, a: 0.1, lp: 900, lp2: 2000, vib: [9, 0.05] },
    { wave: 'saw', f: 141, f2: 111, dur: 1.0, vol: 0.3, a: 0.1, lp: 2000, vib: [9, 0.05] },
    { wave: 'noise', f: 0, dur: 0.9, vol: 0.3, a: 0.2, lp: 1200 },
    { wave: 'sine', f: 45, dur: 1.0, vol: 0.25, a: 0.1 },
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

  // ---- the Hammerdeep (group dungeon): Ondrel, the Anvilward
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

  // ---- co-op
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
} satisfies Record<string, Recipe>;

export type SoundId = keyof typeof SOUNDS;
