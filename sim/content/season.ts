/**
 * P2 Season track: 30 levels over a 6-week season, earned by playing, with
 * cosmetic rewards only (titles and hero glows), so it never touches power.
 * Pure: the client passes the week and day (weekOf, dayOf); the sim never
 * reads the clock. Spec: docs/design/season.md.
 */

import type { DungeonId } from './dungeon';

export interface SeasonState {
  /** Season number (seasonOf(week)). A new season starts the track again; cosmetics stay. */
  id: number;
  marks: number;
  /** The last day a win paid the first-win-of-the-day bonus. */
  firstWinDay?: number;
}

export interface Glow { id: string; name: string; color: string }

/**
 * A mote trail behind the hero while they move. One per season, earned in three
 * stages (SEASON.trailAt): stage 1 a few motes, 2 a denser, longer trail, 3 adds
 * a burst of motes on a dash. Looks only.
 */
export interface Trail { id: string; name: string; color: string }

export interface SeasonDef {
  name: string;
  glows: [Glow, Glow, Glow];
  /** The season's trail, earned in three stages. */
  trail: Trail;
  /** The season's dungeon: a win there (delve, key run or bounty) pays SEASON.featured more marks. */
  dungeon: DungeonId;
}

export const SEASON = {
  weeks: 6,
  levels: 30,
  marksPerLevel: 500,
  /** Marks for a delve, key run or bounty: a win, or a loss's base plus each fight cleared. */
  win: 120,
  lossBase: 20,
  lossPerFight: 10,
  /** The first win of each day. */
  firstWin: 200,
  /** Each weekly quest finished. */
  weekly: 150,
  /** Extra marks for a win in the season's own dungeon (SeasonDef.dungeon). */
  featured: 60,
  /** Reward levels: a glow at 5, 15 and 25, a title at 10, 20 and 30. */
  glowAt: [5, 15, 25],
  titleAt: [10, 20, 30],
  titleWords: ['Delver', 'Veteran', 'Paragon'],
  /** The season trail's three stages, in three of the five-level gaps between the glows and titles. */
  trailAt: [8, 18, 28],
};

/** Season themes, in turn. Every name is Horders' own (its world, bosses and tagline). */
export const SEASONS: SeasonDef[] = [
  { name: 'the Hollow Tide', glows: [{ id: 'tideSilver', name: 'Tide Silver', color: '#9fd8ff' }, { id: 'hollowViolet', name: 'Hollow Violet', color: '#b48cff' }, { id: 'undertowTeal', name: 'Undertow Teal', color: '#4fe3c1' }], trail: { id: 'saltMist', name: 'Salt Mist', color: '#bfe9ff' }, dungeon: 'foundry' },
  { name: 'the Deep Bellows', glows: [{ id: 'bellowsOrange', name: 'Bellows Orange', color: '#ff9a3c' }, { id: 'kilnRed', name: 'Kiln Red', color: '#ff5a4a' }, { id: 'whiteHeat', name: 'White Heat', color: '#fff1d6' }], trail: { id: 'bellowsSparks', name: 'Bellows Sparks', color: '#ffb04a' }, dungeon: 'hammerdeep' },
  { name: 'the Cold Hearth', glows: [{ id: 'rimeBlue', name: 'Rime Blue', color: '#8fb8ff' }, { id: 'coalGlow', name: 'Coal Glow', color: '#ffb36b' }, { id: 'frostbite', name: 'Frostbite', color: '#d8f4ff' }], trail: { id: 'rimeDust', name: 'Rime Dust', color: '#e6f6ff' }, dungeon: 'coldmarrow' },
  { name: 'the Slag Moon', glows: [{ id: 'slagGold', name: 'Slag Gold', color: '#ffc861' }, { id: 'moonAsh', name: 'Moon Ash', color: '#c9c2b8' }, { id: 'pourCrimson', name: 'Pour Crimson', color: '#ff6a8a' }], trail: { id: 'slagDrips', name: 'Slag Drips', color: '#ffcf6e' }, dungeon: 'glarewell' },
  { name: 'the Falling Press', glows: [{ id: 'oilGreen', name: 'Oil Green', color: '#7fd46a' }, { id: 'rivetBlue', name: 'Rivet Blue', color: '#4f7dff' }, { id: 'hotStamp', name: 'Hot Stamp', color: '#ff4fd8' }], trail: { id: 'oilSheen', name: 'Oil Sheen', color: '#b8f07a' }, dungeon: 'pressworks' },
  { name: 'the Low Ebb', glows: [{ id: 'wrackOlive', name: 'Wrack Olive', color: '#b5c24a' }, { id: 'drainBlue', name: 'Drain Blue', color: '#2fa8d8' }, { id: 'ebbIndigo', name: 'Ebb Indigo', color: '#7a5cff' }], trail: { id: 'raftSplinters', name: 'Raft Splinters', color: '#c8915a' }, dungeon: 'wrackline' },
  { name: 'the Long Hunger', glows: [{ id: 'gulletRed', name: 'Gullet Red', color: '#ff3300' }, { id: 'crawRose', name: 'Craw Rose', color: '#e07bb8' }, { id: 'hoardGilt', name: 'Hoard Gilt', color: '#ffe926' }], trail: { id: 'emberCrumbs', name: 'Ember Crumbs', color: '#bf5c43' }, dungeon: 'hoard' },
  { name: 'the Cracked Plate', glows: [{ id: 'cinderViolet', name: 'Cinder Violet', color: '#be26ff' }, { id: 'crackCyan', name: 'Crack Cyan', color: '#26e9ff' }, { id: 'slagLime', name: 'Slag Lime', color: '#d4ff26' }], trail: { id: 'plateShards', name: 'Plate Shards', color: '#0073bf' }, dungeon: 'smeltery' },
];

/** Season 1 starts on the week of 21 Nov 2026: weekOf(Date.UTC(2026, 10, 21)) = 2968. */
export const SEASON_START_WEEK = 2968;

export function seasonOf(week: number): number {
  return Math.floor((week - SEASON_START_WEEK) / SEASON.weeks);
}

export function seasonDef(id: number): SeasonDef {
  return SEASONS[((id % SEASONS.length) + SEASONS.length) % SEASONS.length];
}

/** Display number: season id 0 is Season 1. */
export function seasonNumber(id: number): number {
  return id + 1;
}

/** The first week of a season, and the week after its last. */
export function seasonWeeks(id: number): [number, number] {
  const a = SEASON_START_WEEK + id * SEASON.weeks;
  return [a, a + SEASON.weeks];
}

export function seasonLevel(marks: number): number {
  return Math.min(SEASON.levels, Math.floor(marks / SEASON.marksPerLevel));
}

/** The state for `week`: this season's track, or a fresh one if the season turned. */
export function seasonState(prev: SeasonState | undefined, week: number): SeasonState {
  const id = seasonOf(week);
  return prev && prev.id === id ? prev : { id, marks: 0 };
}

export type SeasonReward =
  | { level: number; kind: 'glow'; glow: Glow }
  | { level: number; kind: 'title'; title: string }
  | { level: number; kind: 'trail'; trail: Trail; stage: 1 | 2 | 3 };

/** Every reward on a season's track, in level order. */
export function seasonRewards(id: number): SeasonReward[] {
  const def = seasonDef(id);
  const out: SeasonReward[] = [];
  SEASON.glowAt.forEach((level, k) => out.push({ level, kind: 'glow', glow: def.glows[k] }));
  SEASON.titleAt.forEach((level, k) => out.push({ level, kind: 'title', title: `${SEASON.titleWords[k]} of ${def.name}` }));
  SEASON.trailAt.forEach((level, k) => out.push({ level, kind: 'trail', trail: def.trail, stage: (k + 1) as 1 | 2 | 3 }));
  return out.sort((a, b) => a.level - b.level);
}

/** Every glow any season can give, by id (for wearing one from an earlier season). */
export const GLOWS: Record<string, Glow> = Object.fromEntries(SEASONS.flatMap((s) => s.glows).map((g) => [g.id, g]));

/** Every trail any season can give, by id. */
export const TRAILS: Record<string, Trail> = Object.fromEntries(SEASONS.map((s) => [s.trail.id, s.trail]));

/** "Bellows Sparks" at stage 1, "Bellows Sparks II" and "III" after. */
export function trailLabel(t: Trail, stage: number): string {
  return stage >= 3 ? `${t.name} III` : stage === 2 ? `${t.name} II` : t.name;
}

/** Marks for one run. `featured`: the run was in the season's own dungeon (only a win pays it). */
export function runMarks(victory: boolean, fightsCleared: number, weeklyDone: number, firstWin: boolean, featured = false): number {
  const base = victory ? SEASON.win : SEASON.lossBase + SEASON.lossPerFight * Math.max(0, Math.min(5, fightsCleared));
  return base + (victory && featured ? SEASON.featured : 0) + (firstWin ? SEASON.firstWin : 0) + SEASON.weekly * weeklyDone;
}
