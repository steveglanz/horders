/**
 * Dungeons: a run is a short route of hand-built encounters ending in a boss.
 * Few enemies, each with mechanics worth learning. The Kiln Depths is the
 * first dungeon; the Drowned Foundry unlocks later and adds new verbs.
 */
import { EnemyKind } from './enemies';

export type EncounterId =
  | 'pack' | 'wardens' | 'warpack' | 'brute' | 'ashmaw' | 'acolytes' | 'kilnMother' | 'shrine'
  | 'twins' | 'glass' | 'crawlers' | 'bellwarden' | 'tidepair' | 'twinsAcolyte' | 'maelra'
  | 'shades' | 'lensbearer' | 'brandkeeper' | 'lamps' | 'lensShades' | 'brandShades' | 'lensmother'
  | 'worldShadow' | 'anvilguard' | 'ondrel' | 'ysmeret'
  | 'rimepack' | 'snuffers' | 'frostwardens' | 'weaver' | 'weaverWardens' | 'nhevra'
  | 'grandmotherSlag'
  | 'lurkers' | 'haulers' | 'wardenShoal' | 'twoHaulers' | 'haulerWarden' | 'hessa'
  | 'oskel' | 'vorhulm' | 'colossus' | 'regent'
  | 'spitters' | 'riftfall' | 'ashbucks' | 'spitterBrute' | 'ashbuckWarden';

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
  ashmaw: { id: 'ashmaw', name: 'Vorhulm the Glutton', tip: 'Quench its Gorge, or it heals.', spawns: [{ kind: 'ashmaw', n: 1 }] },
  acolytes: { id: 'acolytes', name: 'The Brute and its Acolytes', tip: 'Two acolytes heal the Brute. Kill the healers first.', spawns: [{ kind: 'cinderBrute', n: 1 }, { kind: 'acolyte', n: 2 }] },
  // V1 (variety): Kiln fights that move and hit differently: range, a swarm source, and a charge down a lane.
  spitters: { id: 'spitters', name: 'Ember Spitters', tip: 'They keep their distance and lob fire where you stand. Keep moving and run them down.', spawns: [{ kind: 'emberSpitter', n: 2 }, { kind: 'cinderhound', n: 2 }] },
  riftfall: { id: 'riftfall', name: 'The Hollow Rift', tip: 'The Rift spits Ashlings until it breaks. Break the Rift first.', spawns: [{ kind: 'rift', n: 1 }, { kind: 'cinderhound', n: 2 }] },
  ashbucks: { id: 'ashbucks', name: 'The Ashbucks', tip: 'An Ashbuck shows its lane, then charges down it. Step to the side, not back.', spawns: [{ kind: 'ashbuck', n: 2 }, { kind: 'cinderhound', n: 1 }] },
  spitterBrute: { id: 'spitterBrute', name: 'Brute and Spitters', tip: 'Quench the Ground Pound, and keep moving through the lobs.', spawns: [{ kind: 'cinderBrute', n: 1 }, { kind: 'emberSpitter', n: 2 }] },
  ashbuckWarden: { id: 'ashbuckWarden', name: 'Warden and Ashbucks', tip: 'Stay out of the Warden\'s slam without stepping into a lane.', spawns: [{ kind: 'husk', n: 1 }, { kind: 'ashbuck', n: 2 }] },
  shrine: { id: 'shrine', name: 'Ember Shrine', tip: 'A quiet shrine. You heal fully and gain a level, but find no loot.', spawns: [] },
  twins: { id: 'twins', name: 'The Ember Twins', tip: 'Kill them close together, or Quench the Rekindle.', spawns: [{ kind: 'emberTwin', n: 2 }] },
  glass: { id: 'glass', name: 'Glass Warden and Hounds', tip: 'Quench Mirror Ward, or your damage comes back at you.', spawns: [{ kind: 'glassWarden', n: 1 }, { kind: 'cinderhound', n: 2 }] },
  crawlers: { id: 'crawlers', name: 'Sluice Crawler and Hounds', tip: 'Drag the blue ring away from the hounds before it bursts.', spawns: [{ kind: 'sluiceCrawler', n: 1 }, { kind: 'cinderhound', n: 2 }] },
  bellwarden: { id: 'bellwarden', name: 'Warden of the Bell', tip: 'A Glass Warden guards a Brute. Choose which cast to Quench.', spawns: [{ kind: 'cinderBrute', n: 1 }, { kind: 'glassWarden', n: 1 }] },
  tidepair: { id: 'tidepair', name: 'The Tide Pair', tip: 'Two Sluice Crawlers. Keep their rings apart from them.', spawns: [{ kind: 'sluiceCrawler', n: 2 }] },
  twinsAcolyte: { id: 'twinsAcolyte', name: 'Twins and their Keeper', tip: 'Kill the Acolyte, then the twins together.', spawns: [{ kind: 'emberTwin', n: 2 }, { kind: 'acolyte', n: 1 }] },
  maelra: { id: 'maelra', name: 'Maelra, the Drowned Bellows', tip: 'Kite her over the steam vents to boil off her Temper.', spawns: [{ kind: 'maelra', n: 1 }] },
  shades: { id: 'shades', name: 'Shades in the Dark', tip: 'Shades barely feel hits in shadow. Pull them into the light.', spawns: [{ kind: 'shade', n: 4 }] },
  lensbearer: { id: 'lensbearer', name: 'The Lensbearer', tip: 'When it raises the lens, hide behind a pillar, or Quench the Glare.', spawns: [{ kind: 'lensbearer', n: 1 }, { kind: 'shade', n: 2 }] },
  brandkeeper: { id: 'brandkeeper', name: 'The Brandkeeper', tip: 'A Brand on you bursts: get clear of pillars and enemies first.', spawns: [{ kind: 'brandkeeper', n: 1 }, { kind: 'shade', n: 2 }] },
  lamps: { id: 'lamps', name: 'The Twin Lamps', tip: 'Never stand in the light between the lamps. Kill one to break it.', spawns: [{ kind: 'twinLamp', n: 2 }] },
  lensShades: { id: 'lensShades', name: 'Lensbearer and the Dark', tip: 'Hide from the Glare, but the shadows are full of Shades.', spawns: [{ kind: 'lensbearer', n: 1 }, { kind: 'shade', n: 4 }] },
  brandShades: { id: 'brandShades', name: 'Brand and Lens', tip: 'Brands crack pillars. Burst them in the open so you keep your cover.', spawns: [{ kind: 'brandkeeper', n: 1 }, { kind: 'lensbearer', n: 1 }] },
  lensmother: { id: 'lensmother', name: 'The Lensmother', tip: 'Hide from her Glare, burst Brands in the open, and save your pillars.', spawns: [{ kind: 'lensmother', n: 1 }] },
  worldShadow: { id: 'worldShadow', name: 'Shadow of the World Boss', tip: 'Bonus fight: 60 seconds to hurt it. Every hit counts triple toward the world boss.', spawns: [{ kind: 'worldShadow', n: 1 }] },
  anvilguard: { id: 'anvilguard', name: 'The Anvil Guard', tip: 'Two Brutes at once: one hero holds both while the rest Quench.', spawns: [{ kind: 'cinderBrute', n: 2 }] },
  ondrel: { id: 'ondrel', name: 'Ondrel of the Hammerdeep', tip: 'Tank holds Anvilfall, everyone else stays behind it, healer clears Slag Grip.', spawns: [{ kind: 'ondrel', n: 1 }] },
  ysmeret: { id: 'ysmeret', name: 'Ysmeret, the Twofold Flame', tip: 'Someone in each gold vent, spread out when Embers mark you, tank takes Bellow Slam.', spawns: [{ kind: 'ysmeret', n: 1 }] },
  rimepack: { id: 'rimepack', name: 'The Rime Pack', tip: 'Five hounds out of the dark. Every kill feeds your coal.', spawns: [{ kind: 'rimehound', n: 5 }] },
  snuffers: { id: 'snuffers', name: 'Snuffers in the Dark', tip: 'Snuffers drink your light. Kill them before they touch you.', spawns: [{ kind: 'snuffer', n: 2 }, { kind: 'rimehound', n: 2 }] },
  frostwardens: { id: 'frostwardens', name: 'The Frost Wardens', tip: 'Ice shrugs off hits. Fight them inside your coal\'s light to crack them.', spawns: [{ kind: 'frostWarden', n: 2 }] },
  weaver: { id: 'weaver', name: 'The Hoarfrost Weaver', tip: 'Step out of Frost Lace, or Quench it, or the cold gets in.', spawns: [{ kind: 'hoarfrostWeaver', n: 1 }, { kind: 'rimehound', n: 3 }] },
  weaverWardens: { id: 'weaverWardens', name: 'Weaver and Warden', tip: 'Quench the Lace while you warm the Warden.', spawns: [{ kind: 'hoarfrostWeaver', n: 1 }, { kind: 'frostWarden', n: 1 }, { kind: 'snuffer', n: 1 }] },
  // The Wrackline: get on a raft before the Ebb, or it drags you to the drain.
  lurkers: { id: 'lurkers', name: 'Shoal Lurkers', tip: "They swim, so they can't climb onto a raft. Stand in its middle.", spawns: [{ kind: 'shoalLurker', n: 3 }, { kind: 'cinderhound', n: 2 }] },
  haulers: { id: 'haulers', name: 'The Barge Hauler', tip: 'Quench its Haul, or it yanks you off your raft.', spawns: [{ kind: 'bargeHauler', n: 1 }, { kind: 'shoalLurker', n: 2 }] },
  wardenShoal: { id: 'wardenShoal', name: 'Warden in the Shoals', tip: 'Let the water take the Warden: the drain wears it down while you wait on a raft.', spawns: [{ kind: 'husk', n: 2 }, { kind: 'shoalLurker', n: 3 }] },
  twoHaulers: { id: 'twoHaulers', name: 'Two Haulers', tip: 'They take turns to Haul. Save a Quench for each.', spawns: [{ kind: 'bargeHauler', n: 2 }] },
  haulerWarden: { id: 'haulerWarden', name: 'Hauler and Warden', tip: 'Quench the Haul, or it yanks you off your raft and into the Warden\'s reach.', spawns: [{ kind: 'bargeHauler', n: 1 }, { kind: 'husk', n: 1 }, { kind: 'shoalLurker', n: 2 }] },
  regent: { id: 'regent', name: 'The Furnace Regent', tip: 'Its Decree burns whoever holds it: walk it to an ally to pass it on before it bursts. You can\'t take it back for a while. It never lands on the tank, but the tank can take one.', spawns: [{ kind: 'regent', n: 1 }] },
  colossus: { id: 'colossus', name: 'The Cinder Colossus', tip: 'His front is plated: the tank holds it, everyone else hits his back. Step out of the Slag Sweep. When he Wheels, he turns on whoever hurt him most.', spawns: [{ kind: 'colossus', n: 1 }] },
  vorhulm: { id: 'vorhulm', name: 'Old Vorhulm', tip: 'Interrupt his Gorge. When he swallows an ally, break the Craw at his side. In the end, grab the spilled embers before he does.', spawns: [{ kind: 'vorhulm', n: 1 }] },
  oskel: { id: 'oskel', name: 'Oskel of the Pressworks', tip: 'Take turns under the Downstroke: a Pressed hero must stay out. Dodge the Rivets, tank takes the Stamp.', spawns: [{ kind: 'oskel', n: 1 }] },
  hessa: { id: 'hessa', name: 'Hessa of the Ebb', tip: 'She holds the drain. Hit her between pulls, and keep a raft afloat.', spawns: [{ kind: 'hessa', n: 1 }] },
  nhevra: { id: 'nhevra', name: 'Nhevra, the Cold Hearth', tip: 'Quench her Snuff, kill the Snuffers, and keep your coal bright for the Long Night.', spawns: [{ kind: 'nhevra', n: 1 }] },
  grandmotherSlag: { id: 'grandmotherSlag', name: 'Grandmother Slag', tip: 'Heal the Ladle burn off the tank, dodge the molten lanes, then fill the vents and spread for the Cinder Marks.', spawns: [{ kind: 'grandmotherSlag', n: 1 }] },
  kilnMother: { id: 'kilnMother', name: 'Smolderhusk, the Kiln Mother', tip: 'Dodge the red, Quench her Cataclysm, stand in the gold.', spawns: [{ kind: 'kilnMother', n: 1 }] },
};

export type DungeonId = 'kiln' | 'foundry' | 'glarewell' | 'hammerdeep' | 'ashvents' | 'coldmarrow' | 'crucible' | 'wrackline' | 'pressworks' | 'hoard' | 'smeltery' | 'flue';

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
  /**
   * 'solo': any party, 1 to 4 heroes, any classes. 'group': a party of at least
   * `minParty`, built around a tank and a healer (recommended, not enforced).
   */
  style: 'solo' | 'group';
  minParty: number;
  /** C3: a raid. Its route is two openers and a named fight, then the boss, with no hard fight and no shadow fight after. */
  raid?: boolean;
  /**
   * W3: a raid's world boss, by its name on the server's rotation. Hits on the raid boss count
   * triple toward the world boss only while this boss is the live one (raidCountsTriple).
   */
  worldBoss?: string;
}

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  kiln: {
    id: 'kiln', name: 'The Kiln Depths', boss: 'kilnMother', unlockTier: 1,
    openers: ['pack', 'wardens', 'warpack', 'spitters', 'riftfall', 'ashbucks'], named: ['brute', 'ashmaw', 'spitterBrute', 'ashbuckWarden'], hard: ['acolytes', 'ashmaw'],
    blurb: 'Dodge, interrupt and soak your way to the Kiln Mother.', style: 'solo', minParty: 1,
  },
  foundry: {
    id: 'foundry', name: 'The Drowned Foundry', boss: 'maelra', unlockTier: 4,
    openers: ['twins', 'glass', 'crawlers'], named: ['bellwarden', 'tidepair'], hard: ['twinsAcolyte', 'tidepair'],
    blurb: 'Mirrors, twins and rising water. Kite Maelra through the steam.', style: 'solo', minParty: 1,
  },
  glarewell: {
    id: 'glarewell', name: 'The Glarewell', boss: 'lensmother', unlockTier: 7,
    openers: ['shades', 'lensbearer', 'brandkeeper'], named: ['lamps', 'brandShades'], hard: ['lensShades', 'lamps'],
    blurb: 'A sunken observatory. Hide behind pillars from the Glare; burst Brands in the open.', style: 'solo', minParty: 1,
  },
  coldmarrow: {
    id: 'coldmarrow', name: 'The Coldmarrow', boss: 'nhevra', unlockTier: 10,
    openers: ['rimepack', 'snuffers', 'frostwardens'], named: ['weaver', 'frostwardens'], hard: ['weaverWardens', 'snuffers'],
    blurb: 'The deep under the Kiln, where the fires went out. Keep your Hearthcoal alive: it is the only warmth down here.', style: 'solo', minParty: 1,
  },
  wrackline: {
    id: 'wrackline', name: 'The Wrackline', boss: 'hessa', unlockTier: 13,
    openers: ['lurkers', 'haulers', 'wardenShoal'], named: ['twoHaulers', 'wardenShoal'], hard: ['haulerWarden', 'twoHaulers'],
    blurb: 'A wrecked quay where the Ebb drags everything to the drain. Ride the rafts when the water pulls.', style: 'solo', minParty: 1,
  },
  hammerdeep: {
    id: 'hammerdeep', name: 'The Hammerdeep', boss: 'ondrel', unlockTier: 4,
    openers: ['warpack', 'wardens', 'glass'], named: ['anvilguard', 'bellwarden'], hard: ['acolytes', 'anvilguard'],
    blurb: 'A group dungeon. A tank holds Ondrel\'s Anvilfall, a healer keeps the party standing.', style: 'group', minParty: 2,
  },
  ashvents: {
    id: 'ashvents', name: 'The Ashvents', boss: 'ysmeret', unlockTier: 7,
    openers: ['glass', 'crawlers', 'warpack'], named: ['anvilguard', 'tidepair'], hard: ['acolytes', 'bellwarden'],
    blurb: 'A group dungeon. Split up to cover both of Ysmeret\'s vents, and never stand together when the Embers mark you.', style: 'group', minParty: 2,
  },
  pressworks: {
    id: 'pressworks', name: 'The Pressworks', boss: 'oskel', unlockTier: 10,
    openers: ['warpack', 'glass', 'wardens'], named: ['anvilguard', 'bellwarden'], hard: ['acolytes', 'anvilguard'],
    blurb: 'A group dungeon. Oskel\'s Downstroke needs a hero under it every time, and nobody can take two in a row: take turns.', style: 'group', minParty: 2,
  },
  crucible: {
    id: 'crucible', name: 'The Crucible', boss: 'grandmotherSlag', unlockTier: 8,
    openers: ['warpack', 'glass', 'crawlers'], named: ['anvilguard', 'bellwarden'], hard: [],
    blurb: 'The raid. Four heroes face Grandmother Slag herself, and while she is the live world boss, every hit on her counts triple toward it.', style: 'group', minParty: 4, raid: true,
    worldBoss: 'Grandmother Slag',
  },
  hoard: {
    id: 'hoard', name: 'The Hoard', boss: 'vorhulm', unlockTier: 9,
    openers: ['warpack', 'glass', 'crawlers'], named: ['anvilguard', 'bellwarden'], hard: [],
    blurb: 'The second raid. Four heroes face Old Vorhulm in his ember hoard. When he swallows one of you, the rest break the Craw to get them out. While he is the live world boss, every hit on him counts triple toward it.', style: 'group', minParty: 4, raid: true,
    worldBoss: 'Old Vorhulm',
  },
  smeltery: {
    id: 'smeltery', name: 'The Smeltery', boss: 'colossus', unlockTier: 10,
    openers: ['warpack', 'glass', 'crawlers'], named: ['anvilguard', 'bellwarden'], hard: [],
    blurb: 'The third raid. Four heroes face the Cinder Colossus. His front is plated, so the tank holds it and the rest work his back. While he is the live world boss, every hit on him counts triple toward it.', style: 'group', minParty: 4, raid: true,
    worldBoss: 'The Cinder Colossus',
  },
  flue: {
    id: 'flue', name: 'The Flue', boss: 'regent', unlockTier: 11,
    openers: ['warpack', 'glass', 'crawlers'], named: ['anvilguard', 'bellwarden'], hard: [],
    blurb: 'The fourth raid. Four heroes face the Furnace Regent. Its Decree burns whoever holds it, so pass it on before it bursts. While it is the live world boss, every hit on it counts triple toward it.', style: 'group', minParty: 4, raid: true,
    worldBoss: 'The Furnace Regent',
  },
};

/** Solo-friendly dungeons, in the order the daily bounty draws from (unchanged by group dungeons). */
export const SOLO_DUNGEON_IDS = (Object.keys(DUNGEONS) as DungeonId[]).filter((id) => DUNGEONS[id].style === 'solo');
/**
 * The dungeons the daily bounty draws from, in its fixed order. Kept explicit so a
 * new dungeon doesn't reshuffle every past and future day's bounty.
 */
export const BOUNTY_DUNGEON_IDS: DungeonId[] = ['kiln', 'foundry', 'glarewell'];
/**
 * The dungeons weekly quests draw from, in their fixed order. Kept explicit for the
 * same reason: the Wrackline (added mid-week) must not reshuffle this week's quests.
 */
export const WEEKLY_DUNGEON_IDS: DungeonId[] = ['kiln', 'foundry', 'glarewell', 'coldmarrow'];

/** Party roles, from the classes' roles. A Slagbinder's comes from its stance: Anvil tanks, Bellows deals damage. */
export type PartyRole = 'tank' | 'healer' | 'damage';
export function roleOf(cls: string, stance?: string): PartyRole {
  if (cls === 'slagbinder') return stance === 'anvil' ? 'tank' : 'damage';
  return cls === 'bulwark' ? 'tank' : cls === 'lumen' ? 'healer' : 'damage';
}

/** Why a party can't enter this dungeon, or '' if it can. */
export function partyBlocker(d: DungeonId, partySize: number): string {
  const def = DUNGEONS[d];
  return partySize < def.minParty ? `Needs a party of ${def.minParty} or more` : '';
}

/** The delve-setup label: who the dungeon is built for, and what this party lacks. */
export function partyLabel(d: DungeonId, party: (string | { cls: string; stance?: string })[]): { label: string; missing: PartyRole[] } {
  if (DUNGEONS[d].style === 'solo') return { label: 'Solo friendly · any party', missing: [] };
  // A Slagbinder's role comes from its stance, so an Anvil Slagbinder fills the tank slot.
  const roles = party.map((m) => (typeof m === 'string' ? roleOf(m) : roleOf(m.cls, m.stance)));
  const missing = (['tank', 'healer'] as PartyRole[]).filter((r) => !roles.includes(r));
  return { label: 'Group · tank + healer recommended', missing };
}

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
  if (DUNGEONS[dungeon].raid) return [a, b, named, boss];
  const hard = HARD.filter((h) => h !== named);
  return [a, b, named, hard[pick(hard.length)], boss];
}

/**
 * W3: whether a run's boss hits (shadowDamage) count triple toward the live world boss. A shadow
 * fight always does: it is the live boss's shadow. A raid does only when its own boss is the live
 * one; in another week its hits still count, once, as ordinary delve damage (finishRun in main.ts).
 */
export function raidCountsTriple(dungeon: DungeonId | undefined, liveBoss: string | undefined): boolean {
  const d = dungeon ? DUNGEONS[dungeon] : undefined;
  return !d?.raid || (!!d.worldBoss && d.worldBoss === liveBoss);
}
