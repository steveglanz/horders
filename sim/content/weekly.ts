/**
 * P1 weekly quests: three goals a week, the same three for every player, that
 * pay embers, and a title for finishing all three. Pure: the client passes the
 * week (weekOf in omens.ts), the sim never reads the clock. Spec:
 * docs/design/weekly-quests.md.
 */
import { Rng } from '../rng';
import { DUNGEONS, DungeonId, WEEKLY_DUNGEON_IDS } from './dungeon';

export type WeeklyId = 'wins' | 'interrupts' | 'named' | 'dungeon' | 'kills' | 'bounties' | 'wall' | 'party';

export interface WeeklyDef {
  id: WeeklyId;
  name: string;
  /** What to do; `{d}` is the week's dungeon. */
  text: string;
  goal: number;
}

export const WEEKLY_QUESTS: Record<WeeklyId, WeeklyDef> = {
  wins: { id: 'wins', name: 'Delver', text: 'Win 5 delves', goal: 5 },
  interrupts: { id: 'interrupts', name: 'Quench Them All', text: 'Interrupt 30 casts', goal: 30 },
  named: { id: 'named', name: 'Name Hunter', text: 'Defeat 3 named elites', goal: 3 },
  dungeon: { id: 'dungeon', name: 'Into the Deep', text: 'Win 2 delves in {d}', goal: 2 },
  kills: { id: 'kills', name: 'Cull the Deep', text: 'Defeat 600 foes', goal: 600 },
  bounties: { id: 'bounties', name: 'Bounty Hunter', text: 'Win 3 daily bounties', goal: 3 },
  wall: { id: 'wall', name: 'Push the Wall', text: 'Win a delve at your best tier', goal: 1 },
  party: { id: 'party', name: 'Delve Together', text: 'Win 2 group dungeons with another real hero', goal: 2 },
};
/** The pool the three weekly quests are drawn from. The party quest is extra, not in it, so the rolls stay as they were. */
export const WEEKLY_IDS: WeeklyId[] = ['wins', 'interrupts', 'named', 'dungeon', 'kills', 'bounties', 'wall'];

export const WEEKLY = {
  /** Quests a week. */
  count: 3,
  /** Embers for each quest: base plus per tier of the hero's best (set when the week starts). */
  emberBase: 40,
  emberPerTier: 8,
  /** Weekly titles for finishing all three, in turn. Original, searched 21 Nov 2026. */
  /** The party quest: open once the hero can enter the Hammerdeep, and it pays this many times a normal quest. */
  partyTier: 4,
  partyPay: 1.5,
  titles: ['the Unquenched', 'Emberhand', 'of the Deep Road', 'the Slagproof', 'Cinderstrider', 'Keeper of the Last Coal'],
};

/** One of a hero's quests this week. */
export interface WeeklyQuest {
  id: WeeklyId;
  goal: number;
  progress: number;
  /** Embers it pays when done. */
  embers: number;
  /** The `dungeon` quest's dungeon. */
  dungeon?: DungeonId;
  done: boolean;
}

/** A hero's week: the quests rolled when they first played it, and whether the title was given. */
export interface WeeklyState {
  week: number;
  quests: WeeklyQuest[];
  titled: boolean;
  /** The extra party quest: win group dungeons with real heroes. Not part of the title. */
  party?: WeeklyQuest;
}

/** What one run adds to the quests, from its summary. */
export interface WeeklyRun {
  victory: boolean;
  dungeon: DungeonId;
  tier: number;
  /** The hero's best tier before this run. */
  maxTier: number;
  kills: number;
  interrupts: number;
  namedKills: number;
  bounty: boolean;
  /** A group dungeon or the raid. */
  group?: boolean;
  /** Real heroes in the party, bots left out (1 or missing for a solo run). */
  realHeroes?: number;
}

export function weeklyEmbers(maxTier: number): number {
  return WEEKLY.emberBase + WEEKLY.emberPerTier * Math.max(1, maxTier);
}

/** The week's title, for finishing all three. */
export function weeklyTitle(week: number): string {
  return WEEKLY.titles[((week % WEEKLY.titles.length) + WEEKLY.titles.length) % WEEKLY.titles.length];
}

/**
 * The week's quests. The three ids and the dungeon come only from the week, so
 * everyone shares them; if the week's dungeon is still locked for this hero,
 * they get the Kiln. Bounties need tier 2 (the bounty's unlock), so a brand-new
 * hero gets another quest in its place.
 */
export function weeklyFor(week: number, maxTier: number): WeeklyQuest[] {
  const rng = new Rng(((week | 0) * 2654435761) ^ 0x7765656b);
  const pool = [...WEEKLY_IDS];
  const ids: WeeklyId[] = [];
  while (ids.length < WEEKLY.count) ids.push(pool.splice(rng.int(pool.length), 1)[0]);
  const weekDungeon = WEEKLY_DUNGEON_IDS[rng.int(WEEKLY_DUNGEON_IDS.length)];
  const dungeon = DUNGEONS[weekDungeon].unlockTier <= maxTier ? weekDungeon : 'kiln';
  const embers = weeklyEmbers(maxTier);
  // The bounty opens at tier 2: a brand-new hero gets another quest in its place.
  const stand = (['wins', 'kills', 'interrupts'] as WeeklyId[]).find((k) => !ids.includes(k)) ?? 'wins';
  return ids.map((id) => {
    const q = id === 'bounties' && maxTier < 2 ? stand : id;
    return { id: q, goal: WEEKLY_QUESTS[q].goal, progress: 0, embers, done: false, ...(q === 'dungeon' ? { dungeon } : {}) };
  });
}

/** The week's party quest, or none before the hero can enter a group dungeon. */
export function partyQuestFor(maxTier: number): WeeklyQuest | undefined {
  if (maxTier < WEEKLY.partyTier) return undefined;
  return { id: 'party', goal: WEEKLY_QUESTS.party.goal, progress: 0, embers: Math.round(weeklyEmbers(maxTier) * WEEKLY.partyPay), done: false };
}

/** The hero's week, rolled fresh when the week has turned. The party quest is added once it opens (older saves too). */
export function weekState(cur: WeeklyState | undefined, week: number, maxTier: number): WeeklyState {
  const st = cur && cur.week === week ? cur : { week, quests: weeklyFor(week, maxTier), titled: false };
  if (!st.party) {
    const party = partyQuestFor(maxTier);
    if (party) st.party = party;
  }
  return st;
}

/** How far one run moves a quest. */
export function weeklyStep(q: WeeklyQuest, r: WeeklyRun): number {
  switch (q.id) {
    case 'wins': return r.victory && !r.bounty ? 1 : 0;
    case 'interrupts': return r.interrupts;
    case 'named': return r.namedKills;
    case 'dungeon': return r.victory && !r.bounty && r.dungeon === q.dungeon ? 1 : 0;
    case 'kills': return r.kills;
    case 'bounties': return r.victory && r.bounty ? 1 : 0;
    case 'wall': return r.victory && !r.bounty && r.tier >= r.maxTier ? 1 : 0;
    case 'party': return r.victory && r.group && (r.realHeroes ?? 1) >= 2 ? 1 : 0;
  }
}

/** A quest's text for the hub. */
export function weeklyText(q: WeeklyQuest): string {
  return WEEKLY_QUESTS[q.id].text.replace('{d}', q.dungeon ? DUNGEONS[q.dungeon].name : 'the Kiln Depths');
}
