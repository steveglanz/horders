/**
 * Horders style source of truth (1.0 vision v2, Checkpoint 1; docs/design/roadmap.md, vision.md section 7).
 * Pillar 5 "one world, one voice, honestly made": no colour exists outside this file.
 * Pillar 2 "read it, answer it": every threat uses one SIGNAL colour AND its shape.
 *
 * The look is "kiln-lit dioramas": low-poly figures built in code, a 3-step toon ramp, a dark outline,
 * rooms floating in black and lit only by fire. The material rule: everything the Court made is fired
 * clay; everything the town made is iron, cloth and brass.
 *
 * Rules (tests/style.test.ts checks them):
 * - MASTER is exactly 24 colours. Places add two ACCENTS each, used on props and glaze, never as a wash.
 * - SIGNAL colours are reserved: drawn unlit ("if it glows flat, it matters"), only for gameplay signals.
 *   No other in-world colour may sit close to one (SIGNAL_CLEARANCE).
 * - CLOTH is one colour per class, on heroes only. RARITY is for UI and loot beams only.
 * - A file that starts with the line `// style: palette-only` may hold no hex colour outside PALETTE_ALL.
 *   New 3D figure kit and room code opts in; the old art (textures.ts, renderer.ts) is being replaced.
 */

/** The 24-colour master palette, grouped by material. Hex is lower case, #rrggbb. */
export const MASTER = {
  /** Void, floors, outlines. Never pure black: outlines use soot[1]. */
  soot: ['#0e0b0a', '#120d0b', '#261d19', '#3d2f28', '#574539'],
  /** The Court's creatures: terracotta to biscuit. */
  clay: ['#6b4a3a', '#8e6248', '#b5835e', '#d9ae82'],
  /** Wick's heroes and props: dark iron to polished. */
  iron: ['#23262b', '#414750', '#646c76', '#8a929c'],
  /**
   * Light, embers and the glowing cracks in clay. Darkest to white-hot. fire[3] is #ffa040, not the
   * #ffb347 in vision.md: that sat 18.8 dE from Stand-here gold, under SIGNAL_CLEARANCE (27 Nov).
   */
  fire: ['#7a1e0e', '#c2410c', '#f07a1f', '#ffa040', '#ffe2a0'],
  /** Wick's other two materials: brass fittings and bone-white highlights (also the Lumen's cloth). */
  hearth: ['#9c7a3c', '#ede3cf'],
  /** Reserved gameplay signals. Drawn unlit and never used for anything else. */
  signal: ['#ff2d6f', '#ffd34d', '#59c7ff', '#5dff8a'],
} as const;

export type SignalId = 'danger' | 'stand' | 'interrupt' | 'ally';

/** Each signal's colour and its shape, so colour-blind players can read it from the shape alone. */
export const SIGNAL: Record<SignalId, { color: string; shape: string; means: string }> = {
  danger: { color: MASTER.signal[0], shape: 'jagged', means: 'move out: a filled zone with a serrated, crawling edge' },
  stand: { color: MASTER.signal[1], shape: 'chevron-ring', means: 'stand here: a solid ring with chevrons pointing in' },
  interrupt: { color: MASTER.signal[2], shape: 'cracked-ring', means: 'interrupt: a cracked ring round the caster' },
  ally: { color: MASTER.signal[3], shape: 'solid-ring', means: 'you and your allies: a plain ring and outline' },
};

/** How each signal shape is drawn. Numbers are in world units and seconds. */
export const SIGNAL_SHAPE = {
  /** Danger: the edge has teeth that crawl along it, so it reads as "moving, get out". */
  jagged: { teethPerUnit: 2.5, toothDepth: 0.12, crawlUnitsPerSec: 0.6, fillOpacity: 0.28, edgeWidth: 0.08 },
  /** Stand here: a steady ring, chevrons point to the centre and pulse inward. */
  chevronRing: { chevrons: 4, chevronSize: 0.22, ringWidth: 0.08, pulseSec: 0.9 },
  /** Interrupt: a ring broken into segments; the gaps widen as the cast nears its end. */
  crackedRing: { segments: 5, gapStartDeg: 6, gapEndDeg: 22, ringWidth: 0.09 },
  /** Ally: a plain ring under the feet plus a thin outline. No teeth, no chevrons, no gaps. */
  solidRing: { ringWidth: 0.06, outlineWidth: 0.03 },
} as const;

/** Minimum warning for any telegraphed attack (pillar 2). */
export const MIN_WARNING_SEC = 0.8;

/** Two accents per place (sim dungeon ids). Props and glaze only, never a full-screen wash. */
export const ACCENTS: Record<'kiln' | 'foundry' | 'glarewell' | 'coldmarrow' | 'wrackline' | 'hammerdeep', [string, string]> = {
  /** Ash grey and a banked-ember glaze. */
  kiln: ['#8f8780', '#a8481e'],
  /** Verdigris and rust. */
  foundry: ['#3f8f7a', '#8a4a2a'],
  /** Polished brass and lens violet. Brass is #b8963e, not vision.md's #c9a227 (18.6 dE from Stand-here). */
  glarewell: ['#b8963e', '#8c7bff'],
  /** Frost (muted, so it never reads as Interrupt) and the one warm coal. */
  coldmarrow: ['#a9c8d8', '#b4552a'],
  /** Sea slate and lantern amber. */
  wrackline: ['#2f4a55', '#d99a3e'],
  /** Blued armoury steel and whetstone grey. (Not in vision.md yet: proposed here.) */
  hammerdeep: ['#3e5168', '#7d7466'],
};

export type ClassId = 'emberwright' | 'duskblade' | 'bulwark' | 'lumen' | 'slagbinder';

/** One cloth colour per class, on heroes only (vision.md section 7 shape-language table). */
export const CLOTH: Record<ClassId, string> = {
  emberwright: '#c27a2c', // amber
  duskblade: '#6e3a5e', // plum
  bulwark: '#4c6585', // slate blue
  lumen: MASTER.hearth[1], // ivory (bone)
  slagbinder: '#6b6b3a', // olive, with hearth brass fittings
};

/** Rarity colours, UI and loot beams only. Must match sim/content/items.ts RARITY (the test checks). */
export const RARITY_COLOR = {
  common: '#c9bfb5',
  uncommon: '#7fd67a',
  rare: '#5aa9ff',
  epic: '#c77dff',
  legendary: '#ffd84a',
  mythic: '#ff9a3d',
} as const;

/** Every colour any palette-only file may use. */
export const PALETTE_ALL: ReadonlySet<string> = new Set([
  ...Object.values(MASTER).flat(),
  ...Object.values(ACCENTS).flat(),
  ...Object.values(CLOTH),
  ...Object.values(RARITY_COLOR),
]);

/** In-world colours that must stay clear of the signals: everything except the signals and rarity. */
export const WORLD_NON_SIGNAL: readonly string[] = [
  ...MASTER.soot, ...MASTER.clay, ...MASTER.iron, ...MASTER.fire, ...MASTER.hearth,
  ...Object.values(ACCENTS).flat(), ...Object.values(CLOTH),
];

/** Smallest CIE76 colour difference allowed between a signal and any other in-world colour. */
export const SIGNAL_CLEARANCE = 25;

/**
 * Size targets on a 390x844 portrait phone (vision.md section 7, proposal-art.md section 3).
 * The camera is fixed: pitched about 55 degrees, 30-degree field of view, about 9 world units across.
 */
export const CAMERA = { pitchDeg: 55, fovDeg: 30, unitsAcross: 9, refWidthPx: 390, refHeightPx: 844 } as const;

export const SIZE = {
  /** Hero height in world units, and its target on screen. */
  heroUnits: 1.8,
  heroPx: [70, 80] as const,
  /** Smallest trash foe on screen. */
  trashMinPx: 40,
  elitePx: [60, 90] as const,
  /** A boss is at least a third of the screen width, and 3-5x hero height. */
  bossMinScreenFrac: 1 / 3,
  bossHeroScale: [3, 5] as const,
  /** Rooms are portrait, front walls cut away. */
  roomUnits: [9, 14] as const,
} as const;

/** Pixels per world unit at the reference phone width. */
export const pxPerUnit = (widthPx: number = CAMERA.refWidthPx): number => widthPx / CAMERA.unitsAcross;

/** Light budget per room (battery): a dim fill, one warm carried light per hero, at most four real lights. */
export const LIGHT = { maxRealLights: 4, heroLightRadius: 4, toonSteps: 3 } as const;

/**
 * Animation spec: every body is rigid parts moved by code tweens (no rigs). Times in seconds, angles in
 * degrees, scales as factors. docs/art/style/README.md explains each state with the reference games.
 */
export const ANIM = {
  idle: { bobPeriod: 1.6, bobHeightFrac: 0.03, breatheScale: 0.03, phaseJitter: true },
  move: { leanDeg: [8, 12] as const, stepsPerSec: 4, hopHeightFrac: 0.05, landSquash: [1.08, 0.92] as const },
  /** Wind-up: pull back and squash, hold, then strike. Telegraphed attacks hold for the whole tell. */
  windup: { pullBackDeg: 15, squash: [1.1, 0.9] as const, ease: 'easeOutQuad', minTrashSec: 0.35 },
  attack: { snapSec: [0.06, 0.09] as const, overshootDeg: 10, settleSec: 0.15, ease: 'easeOutBack' },
  hit: { flashSec: [0.06, 0.08] as const, flashColor: MASTER.hearth[1], squash: [1.12, 0.9] as const, knockbackUnits: 0.25, recoverSec: 0.12 },
  /** Clay foes shatter; the shards stay on the floor for the rest of the room. Iron heroes topple and dim. */
  die: { shards: [6, 10] as const, emberBurst: 12, shardsStay: true, heroTopple: { fallSec: 0.45, dimTo: 0.4 } },
} as const;

/** The first-line marker that opts a file into the palette check. */
export const PALETTE_ONLY_MARK = '// style: palette-only';

/**
 * Six-digit hex colours in `text` (#rrggbb or 0xrrggbb) that are not in PALETTE_ALL, lower-cased.
 * Short #rgb is not matched (it would catch PR numbers like #844 in comments), so palette-only files
 * must write colours as six digits, or better, import them from here.
 */
export function offPalette(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(?:#|0x)([0-9a-fA-F]{6})(?![0-9a-fA-F])/g)) {
    const h = '#' + m[1].toLowerCase();
    if (!PALETTE_ALL.has(h)) out.push(h);
  }
  return out;
}
