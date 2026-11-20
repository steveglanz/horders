/**
 * Dungeons: a run is a short route of hand-built encounters ending in a boss.
 * Few enemies, each with mechanics worth learning. The Kiln Depths is the
 * first dungeon; the Drowned Foundry unlocks later and adds new verbs.
 */
import { EnemyKind } from './enemies';

export type EncounterId =
  | 'pack' | 'wardens' | 'warpack' | 'brute' | 'ashmaw' | 'acolytes' | 'kilnMother' | 'shrine'
  | 'twins' | 'glass' | 'crawlers' | 'bellwarden' | 'tidepair' | 'twinsAcolyte' | 'maelra';

export interface EncounterDef {
  id: EncounterId;
  name: string;
  /** One-line tip shown when the fight starts. */
  tip: string;
  spawns: { kind: EnemyKind; n: number }[];
}

export const ENCOUNTERS: Record<EncounterId, EncounterDef> = {
  pack: { id: 'pack', name: 'The Cinder Pack', tip: 'Four hounds that hunt together. Step aside when they snap.', spawns: [{ kind: 'cinderhound', n: 4 }] },
  wardens: { id: 'wardens', name: 'Hollow Wardens', tip: 'Two hulking guards. Get clear of their slams.', spawns: [{ kind: 'husk', n: 2 }] },
  warpack: { id: 'warpack', name: 'Warden and Hounds', tip: 'A warden with its hounds. Thin the hounds first.', spawns: [{ kind: 'husk', n: 1 }, { kind: 'cinderhound', n: 2 }] },
  brute: { id: 'brute', name: 'Cinder Brute', tip: 'Quench its Ground Pound.', spawns: [{ kind: 'cinderBrute', n: 1 }] },
  ashmaw: { id: 'ashmaw', name: 'Ashmaw the Glutton', tip: 'Quench its Gorge, or it heals.', spawns: [{ kind: 'ashmaw', n: 1 }] },
  acolytes: { id: 'acolytes', name: 'The Brute and its Acolytes', tip: 'Two acolytes heal the Brute. Kill the healers first.', spawns: [{ kind: 'cinderBrute', n: 1 }, { kind: 'acolyte', n: 2 }] },
  shrine: { id: 'shrine', name: 'Ember Shrine', tip: 'A quiet shrine. You heal fully and gain a level, but find no loot.', spawns: [] },
  twins: { id: 'twins', name: 'The Ember Twins', tip: 'Kill them close together, or Quench the Rekindle.', spawns: [{ kind: 'emberTwin', n: 2 }] },
  glass: { id: 'glass', name: 'Glass Warden and Hounds', tip: 'Quench Mirror Ward, or your damage comes back at you.', spawns: [{ kind: 'glassWarden', n: 1 }, { kind: 'cinderhound', n: 2 }] },
  crawlers: { id: 'crawlers', name: 'Sluice Crawler and Hounds', tip: 'Drag the blue ring away from the hounds before it bursts.', spawns: [{ kind: 'sluiceCrawler', n: 1 }, { kind: 'cinderhound', n: 2 }] },
  bellwarden: { id: 'bellwarden', name: 'Warden of the Bell', tip: 'A Glass Warden guards a Brute. Choose which cast to Quench.', spawns: [{ kind: 'cinderBrute', n: 1 }, { kind: 'glassWarden', n: 1 }] },
  tidepair: { id: 'tidepair', name: 'The Tide Pair', tip: 'Two Sluice Crawlers. Keep their rings apart from them.', spawns: [{ kind: 'sluiceCrawler', n: 2 }] },
  twinsAcolyte: { id: 'twinsAcolyte', name: 'Twins and their Keeper', tip: 'Kill the Acolyte, then the twins together.', spawns: [{ kind: 'emberTwin', n: 2 }, { kind: 'acolyte', n: 1 }] },
  maelra: { id: 'maelra', name: 'Maelra, the Drowned Bellows', tip: 'Kite her over the steam vents to boil off her Temper.', spawns: [{ kind: 'maelra', n: 1 }] },
  kilnMother: { id: 'kilnMother', name: 'Smolderhusk, the Kiln Mother', tip: 'Dodge the red, Quench her Cataclysm, stand in the gold.', spawns: [{ kind: 'kilnMother', n: 1 }] },
};

export type DungeonId = 'kiln' | 'foundry';

export interface DungeonDef {
  id: DungeonId;
  name: string;
  boss: EncounterId;
  openers: EncounterId[];
  named: EncounterId[];
  hard: EncounterId[];
  /** Highest tier unlocked (hero.maxTier) needed to enter. */
  unlockTier: number;
  /** Shown in the hub. */
  blurb: string;
}

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  kiln: {
    id: 'kiln', name: 'The Kiln Depths', boss: 'kilnMother', unlockTier: 1,
    openers: ['pack', 'wardens', 'warpack'], named: ['brute', 'ashmaw'], hard: ['acolytes', 'ashmaw'],
    blurb: 'Dodge, interrupt and soak your way to the Kiln Mother.',
  },
  foundry: {
    id: 'foundry', name: 'The Drowned Foundry', boss: 'maelra', unlockTier: 4,
    openers: ['twins', 'glass', 'crawlers'], named: ['bellwarden', 'tidepair'], hard: ['twinsAcolyte', 'tidepair'],
    blurb: 'Mirrors, twins and rising water. Kite Maelra through the steam.',
  },
};

export const DUNGEON_IDS = Object.keys(DUNGEONS) as DungeonId[];

/** A fork between fights: walk into one of two gates. */
export type GateKind = 'steady' | 'named' | 'shrine';

export interface GateOffer {
  kind: GateKind;
  encounter: EncounterId;
}

/**
 * The fork offered before fight `index` (1 to 3): the planned fight, or a
 * harder named fight with better loot, or sometimes a shrine. Returns null
 * where there's no fork (the first fight and the boss).
 */
export function rollFork(
  route: EncounterId[], index: number, pick: (n: number) => number, chance: (p: number) => boolean, dungeon: DungeonId = 'kiln',
): [GateOffer, GateOffer] | null {
  const { named: NAMED, hard: HARD } = DUNGEONS[dungeon];
  if (index < 1 || index > 3 || index >= route.length - 1) return null;
  const steady: GateOffer = { kind: 'steady', encounter: route[index] };
  const used = new Set(route);
  const harder: EncounterId[] = (index === 1 ? NAMED : [...HARD, ...NAMED]).filter((e) => !used.has(e));
  if (!harder.length || chance(0.3)) return [steady, { kind: 'shrine', encounter: 'shrine' }];
  return [steady, { kind: 'named', encounter: harder[pick(harder.length)] }];
}

/** Rolls a 5-fight route: two openers, a named foe, a hard fight, the boss. */
export function rollRoute(pick: (n: number) => number, dungeon: DungeonId = 'kiln'): EncounterId[] {
  const { openers: OPENERS, named: NAMED, hard: HARD, boss } = DUNGEONS[dungeon];
  const open = [...OPENERS];
  const a = open.splice(pick(open.length), 1)[0];
  const b = open.splice(pick(open.length), 1)[0];
  const named = NAMED[pick(NAMED.length)];
  const hard = HARD.filter((h) => h !== named);
  return [a, b, named, hard[pick(hard.length)], boss];
}
