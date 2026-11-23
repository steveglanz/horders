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
  | 'spitters' | 'riftfall' | 'ashbucks' | 'spitterBrute' | 'ashbuckWarden'
  | 'glassSpitters' | 'crawlerCharge'
  | 'shadeSpitters' | 'shadeCharge' | 'lensCharge'
  | 'snufferPack' | 'wardenPack' | 'weaverSnuffers' | 'twoWeavers'
  | 'quaySpitters' | 'quayCharge' | 'shoalRift' | 'haulerSpitters';

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
  // V8: the Drowned Foundry's new fights mix the Kiln's new foes with its own.
  glassSpitters: { id: 'glassSpitters', name: 'Warden and Spitters', tip: 'Quench Mirror Ward, then run the Spitters down through their lobs.', spawns: [{ kind: 'glassWarden', n: 1 }, { kind: 'emberSpitter', n: 2 }] },
  crawlerCharge: { id: 'crawlerCharge', name: 'Crawler and Ashbuck', tip: 'Drag the blue ring away from the Ashbuck, and step aside from its lane.', spawns: [{ kind: 'sluiceCrawler', n: 1 }, { kind: 'ashbuck', n: 1 }, { kind: 'cinderhound', n: 1 }] },
  // V8: the Glarewell's new fights.
  shadeSpitters: { id: 'shadeSpitters', name: 'Shades and Spitters', tip: 'Pull the Shades into the light, and keep moving through the lobs.', spawns: [{ kind: 'shade', n: 2 }, { kind: 'emberSpitter', n: 2 }] },
  shadeCharge: { id: 'shadeCharge', name: 'The Ashbuck in the Dark', tip: 'The Ashbuck charges out of the shadows. Step aside from its lane, then pull the Shades into the light.', spawns: [{ kind: 'ashbuck', n: 1 }, { kind: 'shade', n: 3 }] },
  lensCharge: { id: 'lensCharge', name: 'Lens and Ashbucks', tip: 'Hide from the Glare without stepping into an Ashbuck\'s lane.', spawns: [{ kind: 'lensbearer', n: 1 }, { kind: 'ashbuck', n: 2 }] },
  // V8: the Coldmarrow's new fights, from its own cold foes (the fire foes don't live down here).
  snufferPack: { id: 'snufferPack', name: 'The Snuffer and the Pack', tip: 'Kill the Snuffer before it reaches you, while the hounds feed your coal.', spawns: [{ kind: 'snuffer', n: 1 }, { kind: 'rimehound', n: 3 }] },
  wardenPack: { id: 'wardenPack', name: 'Warden and Rime Pack', tip: 'Kill the hounds to feed your coal, then crack the Warden inside its light.', spawns: [{ kind: 'frostWarden', n: 1 }, { kind: 'rimehound', n: 3 }] },
  weaverSnuffers: { id: 'weaverSnuffers', name: 'Weaver and Snuffers', tip: 'Step out of the Lace, but don\'t let the Snuffers touch you while you do.', spawns: [{ kind: 'hoarfrostWeaver', n: 1 }, { kind: 'snuffer', n: 2 }] },
  twoWeavers: { id: 'twoWeavers', name: 'The Two Weavers', tip: 'Two Weavers take turns with Frost Lace. Save a Quench for each.', spawns: [{ kind: 'hoarfrostWeaver', n: 2 }, { kind: 'rimehound', n: 2 }] },
  // Phase 12 W1: the Wrackline's new fights mix the Kiln's new foes into the water.
  quaySpitters: { id: 'quaySpitters', name: 'Spitters on the Quay', tip: 'They lob fire onto the rafts. Run them down between pulls, and keep moving.', spawns: [{ kind: 'emberSpitter', n: 2 }, { kind: 'shoalLurker', n: 2 }] },
  quayCharge: { id: 'quayCharge', name: 'Ashbucks on the Quay', tip: 'An Ashbuck charges down its lane: step aside, but not off your raft when the water pulls.', spawns: [{ kind: 'ashbuck', n: 2 }, { kind: 'shoalLurker', n: 1 }] },
  shoalRift: { id: 'shoalRift', name: 'The Rift in the Wrack', tip: 'Break the Rift first. The water drags its Ashlings to the drain, so let the Ebb help.', spawns: [{ kind: 'rift', n: 1 }, { kind: 'shoalLurker', n: 2 }] },
  haulerSpitters: { id: 'haulerSpitters', name: 'Hauler and Spitters', tip: 'Quench the Haul, or it yanks you off your raft into the lobs.', spawns: [{ kind: 'bargeHauler', n: 1 }, { kind: 'emberSpitter', n: 2 }] },
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
/** V8: Nhevra's intro when this run's version brings the Emberdrift from phase 2. */
export const CREEPING_RIME_TIP = 'Quench her Snuff and kill the Snuffers. Later a patch of rime creeps after you and smothers your coal: keep moving and lead it away.';
export const EMBERDRIFT_TIP = 'Quench her Snuff and kill the Snuffers. Later the cold eats your coal fast, but embers fall: walk over them to keep your coal bright for the Long Night.';
/** V8: the Lensmother's intro when this run's version brings Glintfall from phase 2. */
export const CARRIED_LIGHT_TIP = 'Hide from her Glare behind a pillar. Later she carries the light herself: when a Glare starts, put a pillar between you and her.';
export const GLINTFALL_TIP = 'Hide from her Glare behind a pillar. Later her Glintfall drops light on every pillar: step off your cover until it lands.';
/** V8: Maelra's intro when this run's version brings the Sluicetide from phase 2. */
export const SLUICETIDE_TIP = 'Kite her over the steam vents to boil off her Temper. Later the Sluicetide runs across the room and pushes you: lean into it, and watch for it to turn.';
/** Phase 12 W2: Ysmeret's intro when this run's Twin Vents wander. */
/** Phase 15 Y3: Ysmeret's intro when this run's version rolls her vents round her one at a time. */
export const ROLLING_TIP = 'Her vents open one at a time, three in a row, each further round her than the last: spread round her so someone is always near the next. Never stand together when the Embers mark you.';
export const WANDER_TIP = 'Two of you stand in her vents, and they drift round her as they fuse: walk with them. Never stand together when the Embers mark you.';
/** Phase 12 W2: Oskel's intro when this run's version brings Die Cut instead of Rivets. */
/** Phase 15 Y3: Oskel's intro when this run's version runs Punch Lines out from him. */
export const PUNCH_TIP = 'Take turns under his Downstroke. His Punch Line runs three rows of punches out from his feet: step off the line, or cross it right behind a punch.';
export const DIECUT_TIP = 'Take turns under his Downstroke. His Die Cut stamps half the floor: get to the other side, toward the plate.';
/** Phase 12 W2: Ondrel's intro when this run's version brings Ironload instead of the Choir of Iron. */
export const IRONLOAD_TIP = 'The tank holds his Anvilfall. His Ironload marks one of you: everyone gather on them before it lands, and share the weight.';
/** Phase 15 Y3: Ondrel's intro when this run's version throws the Homeward Hammer instead of the Choir of Iron. */
export const HOMEWARD_TIP = 'The tank holds his Anvilfall. He throws his hammer at whoever stands farthest away: step out of where it lands, then off the straight line back to his hand.';
/** Phase 12 W1: Hessa's intro when this run's version turns the Ebb around (the Outsurge) from phase 2. */
export const WHIRL_TIP = 'She holds the drain. Hit her between pulls, and keep a raft afloat. Later the water swirls round the drain and carries you with it: it turns the other way each time, so watch which way and wade across it to a raft.';
export const OUTSURGE_TIP = 'She holds the drain. Hit her between pulls, and keep a raft afloat. Later the water turns and throws you out to the rim: the rim burns, so stay on a raft.';
/** Phase 12 W3: Grandmother Slag's intro when this run's version brings the Brimming (cooling islands) instead of the Pour's lanes. */
export const BRIMMING_TIP = 'Heal the Ladle burn off the tank. Later the pit fills: stand on the cooling islands and move before they sink. Then fill the vents and spread for the Cinder Marks.';
/** Phase 12 W3: Old Vorhulm's intro when this run's version lays Banked Coals instead of spilling embers. */
export const BANKED_TIP = 'Interrupt his Gorge. When he swallows an ally, break the Craw at his side. In the end, stand on each hot coal as it lands, or he eats it.';
/** Phase 12 W3: the Cinder Colossus's intro when this run's version shifts his plate instead of Wheeling. */
export const PLATE_SHIFT_TIP = 'His front is plated: the tank holds it, everyone else hits his back. Step out of the Slag Sweep. When his plate shifts, it moves to whoever hurt him most: find his open back again.';
/** Phase 12 W3: the Furnace Regent's intro when this run's version calls a Summons with the Ash Fall. */
export const COURT_TIP = 'Its Decree burns whoever holds it: walk it to an ally to pass it on before it bursts. Later, when he calls a Summons, step out of the ash and come close to him before it lands.';
/** V3: the Kiln Mother's intro when this run's version breathes in (Kiln Draw) from phase 2. */
export const KILN_DRAW_TIP = 'Quench her Cataclysm at first. Later she breathes in and pulls you to her fire: walk away from her.';
/** Phase 15 Y3: the Kiln Mother's intro when this run's version pours Turning Fire from phase 2. */
export const SEALED_VENTS_TIP = 'Kite her over the steam vents to boil off her Temper. Later only one vent steams: drag her to it, and watch for the steam to move.';
export const TURNING_FIRE_TIP = 'Quench her Cataclysm at first. Later she pours fire round herself, cone after cone: step back against the turn.';


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
    openers: ['twins', 'glass', 'crawlers', 'riftfall', 'glassSpitters', 'crawlerCharge'], named: ['bellwarden', 'tidepair', 'spitterBrute'], hard: ['twinsAcolyte', 'tidepair'],
    blurb: 'Mirrors, twins and rising water. Kite Maelra through the steam.', style: 'solo', minParty: 1,
  },
  glarewell: {
    id: 'glarewell', name: 'The Glarewell', boss: 'lensmother', unlockTier: 7,
    openers: ['shades', 'lensbearer', 'brandkeeper', 'shadeSpitters', 'shadeCharge', 'riftfall'], named: ['lamps', 'brandShades', 'lensCharge'], hard: ['lensShades', 'lamps'],
    blurb: 'A sunken observatory. Hide behind pillars from the Glare; burst Brands in the open.', style: 'solo', minParty: 1,
  },
  coldmarrow: {
    id: 'coldmarrow', name: 'The Coldmarrow', boss: 'nhevra', unlockTier: 10,
    openers: ['rimepack', 'snuffers', 'frostwardens', 'snufferPack', 'wardenPack', 'weaverSnuffers'], named: ['weaver', 'frostwardens', 'twoWeavers'], hard: ['weaverWardens', 'snuffers'],
    blurb: 'The deep under the Kiln, where the fires went out. Keep your Hearthcoal alive: it is the only warmth down here.', style: 'solo', minParty: 1,
  },
  wrackline: {
    id: 'wrackline', name: 'The Wrackline', boss: 'hessa', unlockTier: 13,
    openers: ['lurkers', 'haulers', 'wardenShoal', 'quaySpitters', 'quayCharge', 'shoalRift'], named: ['twoHaulers', 'wardenShoal', 'haulerSpitters'], hard: ['haulerWarden', 'twoHaulers'],
    blurb: 'A wrecked quay where the Ebb drags everything to the drain. Ride the rafts when the water pulls.', style: 'solo', minParty: 1,
  },
  hammerdeep: {
    id: 'hammerdeep', name: 'The Hammerdeep', boss: 'ondrel', unlockTier: 4,
    openers: ['warpack', 'wardens', 'glass', 'glassSpitters', 'riftfall', 'spitters'], named: ['anvilguard', 'bellwarden', 'spitterBrute'], hard: ['acolytes', 'anvilguard'],
    blurb: 'A group dungeon. A tank holds Ondrel\'s Anvilfall, a healer keeps the party standing.', style: 'group', minParty: 2,
  },
  ashvents: {
    id: 'ashvents', name: 'The Ashvents', boss: 'ysmeret', unlockTier: 7,
    openers: ['glass', 'crawlers', 'warpack', 'riftfall', 'glassSpitters', 'spitters'], named: ['anvilguard', 'tidepair', 'spitterBrute'], hard: ['acolytes', 'bellwarden'],
    blurb: 'A group dungeon. Split up to cover both of Ysmeret\'s vents, and never stand together when the Embers mark you.', style: 'group', minParty: 2,
  },
  pressworks: {
    id: 'pressworks', name: 'The Pressworks', boss: 'oskel', unlockTier: 10,
    openers: ['warpack', 'glass', 'wardens', 'riftfall', 'glassSpitters', 'spitters'], named: ['anvilguard', 'bellwarden', 'spitterBrute'], hard: ['acolytes', 'anvilguard'],
    blurb: 'A group dungeon. Oskel\'s Downstroke needs a hero under it every time, and nobody can take two in a row: take turns.', style: 'group', minParty: 2,
  },
  crucible: {
    id: 'crucible', name: 'The Crucible', boss: 'grandmotherSlag', unlockTier: 8,
    openers: ['warpack', 'glass', 'crawlers', 'riftfall', 'glassSpitters'], named: ['anvilguard', 'bellwarden', 'spitterBrute'], hard: [],
    blurb: 'The raid. Four heroes face Grandmother Slag herself, and while she is the live world boss, every hit on her counts triple toward it.', style: 'group', minParty: 4, raid: true,
    worldBoss: 'Grandmother Slag',
  },
  hoard: {
    id: 'hoard', name: 'The Hoard', boss: 'vorhulm', unlockTier: 9,
    openers: ['warpack', 'glass', 'crawlers', 'wardens', 'spitters'], named: ['anvilguard', 'bellwarden', 'spitterBrute'], hard: [],
    blurb: 'The second raid. Four heroes face Old Vorhulm in his ember hoard. When he swallows one of you, the rest break the Craw to get them out. While he is the live world boss, every hit on him counts triple toward it.', style: 'group', minParty: 4, raid: true,
    worldBoss: 'Old Vorhulm',
  },
  smeltery: {
    id: 'smeltery', name: 'The Smeltery', boss: 'colossus', unlockTier: 10,
    openers: ['warpack', 'glass', 'crawlers', 'wardens'], named: ['anvilguard', 'bellwarden'], hard: [],
    blurb: 'The third raid. Four heroes face the Cinder Colossus. His front is plated, so the tank holds it and the rest work his back. While he is the live world boss, every hit on him counts triple toward it.', style: 'group', minParty: 4, raid: true,
    worldBoss: 'The Cinder Colossus',
  },
  flue: {
    id: 'flue', name: 'The Flue', boss: 'regent', unlockTier: 11,
    openers: ['warpack', 'glass', 'crawlers', 'wardens'], named: ['anvilguard', 'bellwarden'], hard: [],
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
  // Raids always take four heroes (botfill.ts); a tank and healer are still advice, not a lock.
  return { label: DUNGEONS[d].raid ? 'Raid · 4 heroes · bring a tank + healer' : 'Group · tank + healer recommended', missing };
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
