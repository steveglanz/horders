/** Enemy definitions. Content is data so new zones are mostly data work. */
export interface EnemyDef {
  id: EnemyKind;
  name: string;
  hp: number;
  speed: number; // world units per second
  damage: number; // per contact hit
  radius: number;
  xp: number;
  /** Bosses, elites and rares run scripted abilities instead of only chasing. */
  rank: 'normal' | 'elite' | 'rare' | 'boss';
  /** Does not move (rifts, channelers). */
  stationary?: boolean;
  /** Shown under the name on nameplates and the target frame. */
  title?: string;
}

export type EnemyKind =
  | 'ashling' | 'cinderhound' | 'husk'
  | 'rift' | 'acolyte'
  | 'cinderBrute' | 'ashmaw' | 'kilnMother' | 'kilnBellows'
  | 'glassWarden' | 'emberTwin' | 'sluiceCrawler' | 'maelra'
  | 'lensbearer' | 'shade' | 'brandkeeper' | 'twinLamp' | 'lensmother'
  | 'worldShadow' | 'ondrel' | 'ysmeret' | 'oskel'
  | 'rimehound' | 'snuffer' | 'frostWarden' | 'hoarfrostWeaver' | 'nhevra'
  | 'grandmotherSlag' | 'slagling'
  | 'vorhulm' | 'craw'
  | 'colossus'
  | 'regent'
  | 'shoalLurker' | 'bargeHauler' | 'hessa'
  | 'emberSpitter' | 'ashbuck'
  | 'ashwall' | 'ballast' | 'lampeye' | 'dimhorn' | 'conchblower';

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ashling: { id: 'ashling', name: 'Ashling', hp: 10, speed: 52, damage: 5, radius: 9, xp: 1, rank: 'normal' },
  // V1 (variety): a ranged foe that keeps its distance, and a charger that dashes down a lane.
  emberSpitter: { id: 'emberSpitter', name: 'Ember Spitter', hp: 420, speed: 48, damage: 8, radius: 14, xp: 4, rank: 'elite', title: 'Spitter' },
  ashbuck: { id: 'ashbuck', name: 'Ashbuck', hp: 520, speed: 52, damage: 12, radius: 18, xp: 5, rank: 'elite', title: 'Charger' },
  // Phase 16 U2: a slab of cooled slag carried as a shield. It turns to face you and shelters the foes behind it.
  ashwall: { id: 'ashwall', name: 'Ashwall', hp: 900, speed: 40, damage: 12, radius: 22, xp: 6, rank: 'elite', title: 'Shields those behind it' },
  // Phase 16 U2 (the Foundry): it drops anchor when you stand in its reach, and planted it shrugs off hits. Keep it walking.
  ballast: { id: 'ballast', name: 'Ballast', hp: 950, speed: 46, damage: 14, radius: 21, xp: 6, rank: 'elite', title: 'Keep it moving' },
  // Phase 16 U2 (the Glarewell): a lamp with an eye in it. While it can see you its gaze builds, and when it is full it sears you. Look away behind a pillar.
  lampeye: { id: 'lampeye', name: 'Lampeye', hp: 800, speed: 28, damage: 10, radius: 18, xp: 6, rank: 'elite', title: 'Break its gaze' },
  conchblower: { id: 'conchblower', name: 'Conchblower', hp: 560, speed: 50, damage: 9, radius: 17, xp: 6, rank: 'elite', title: 'Calls the Ebb' },
  dimhorn: { id: 'dimhorn', name: 'Dimhorn', hp: 750, speed: 70, damage: 9, radius: 17, xp: 6, rank: 'elite', title: 'Calls from the dark' },
  cinderhound: { id: 'cinderhound', name: 'Cinderhound', hp: 150, speed: 100, damage: 7, radius: 11, xp: 1, rank: 'elite', title: 'Pack hunter' },
  husk: { id: 'husk', name: 'Hollow Warden', hp: 700, speed: 40, damage: 14, radius: 20, xp: 4, rank: 'elite', title: 'Guardian' },
  rift: { id: 'rift', name: 'Hollow Rift', hp: 420, speed: 0, damage: 0, radius: 22, xp: 12, rank: 'normal', stationary: true },
  acolyte: { id: 'acolyte', name: 'Ember Acolyte', hp: 380, speed: 0, damage: 8, radius: 14, xp: 8, rank: 'elite', stationary: true, title: 'Healer' },
  cinderBrute: { id: 'cinderBrute', name: 'Cinder Brute', hp: 1500, speed: 46, damage: 18, radius: 26, xp: 40, rank: 'elite', title: 'Elite' },
  ashmaw: { id: 'ashmaw', name: 'The Taster', hp: 1700, speed: 58, damage: 14, radius: 24, xp: 50, rank: 'rare', title: 'Rare' },
  glassWarden: { id: 'glassWarden', name: 'Glass Warden', hp: 950, speed: 42, damage: 14, radius: 20, xp: 6, rank: 'elite', title: 'Mirror' },
  emberTwin: { id: 'emberTwin', name: 'Ember Twin', hp: 620, speed: 62, damage: 10, radius: 16, xp: 5, rank: 'elite', title: 'Twin' },
  sluiceCrawler: { id: 'sluiceCrawler', name: 'Sluice Crawler', hp: 820, speed: 50, damage: 12, radius: 18, xp: 6, rank: 'elite', title: 'Tidecaller' },
  maelra: { id: 'maelra', name: 'Dowager Bellows', hp: 6000, speed: 36, damage: 24, radius: 40, xp: 0, rank: 'boss', title: 'Boss' },
  // The Glarewell: light hurts, shadow hides you, and shadow has things in it.
  lensbearer: { id: 'lensbearer', name: 'Lensbearer', hp: 1000, speed: 34, damage: 12, radius: 20, xp: 6, rank: 'elite', title: 'Glare' },
  shade: { id: 'shade', name: 'Shade', hp: 300, speed: 70, damage: 8, radius: 13, xp: 2, rank: 'elite', title: 'Shadowborn' },
  brandkeeper: { id: 'brandkeeper', name: 'Brandkeeper', hp: 900, speed: 44, damage: 12, radius: 19, xp: 6, rank: 'elite', title: 'Brand' },
  twinLamp: { id: 'twinLamp', name: 'Twin Lamp', hp: 760, speed: 30, damage: 10, radius: 17, xp: 5, rank: 'elite', title: 'Lamp' },
  lensmother: { id: 'lensmother', name: 'The Glass Heir', hp: 6200, speed: 32, damage: 22, radius: 40, xp: 0, rank: 'boss', title: 'Boss' },
  // A shadow of the shared world boss: it can't be killed, only hurt for 60 seconds.
  worldShadow: { id: 'worldShadow', name: 'Shadow of the World Boss', hp: 1e9, speed: 34, damage: 22, radius: 48, xp: 0, rank: 'boss', title: 'World boss' },
  // The Hammerdeep's group boss: role checks rather than dodge checks.
  oskel: { id: 'oskel', name: 'Cousin Stamp', hp: 6400, speed: 32, damage: 16, radius: 44, xp: 0, rank: 'boss', title: 'Group boss' },
  ysmeret: { id: 'ysmeret', name: 'Cousin Fork', hp: 5800, speed: 36, damage: 15, radius: 42, xp: 0, rank: 'boss', title: 'Group boss' },
  // The Coldmarrow (C1): frost-touched foes. Killing one feeds your Hearthcoal.
  rimehound: { id: 'rimehound', name: 'Rimehound', hp: 260, speed: 92, damage: 9, radius: 14, xp: 2, rank: 'elite', title: 'Frost-touched' },
  snuffer: { id: 'snuffer', name: 'Snuffer', hp: 200, speed: 40, damage: 4, radius: 15, xp: 3, rank: 'elite', title: 'Dims your coal' },
  frostWarden: { id: 'frostWarden', name: 'Frost Warden', hp: 700, speed: 30, damage: 16, radius: 24, xp: 8, rank: 'elite', title: 'Warm it to crack it' },
  hoarfrostWeaver: { id: 'hoarfrostWeaver', name: 'Hoarfrost Weaver', hp: 700, speed: 36, damage: 8, radius: 18, xp: 6, rank: 'elite', title: 'Frost Lace' },
  nhevra: { id: 'nhevra', name: 'The Banked Queen', hp: 3400, speed: 30, damage: 20, radius: 42, xp: 0, rank: 'boss', title: 'Boss' },
  ondrel: { id: 'ondrel', name: 'The Iron Uncle', hp: 4800, speed: 34, damage: 16, radius: 44, xp: 0, rank: 'boss', title: 'Group boss' },
  // The raid (C3): the world boss in person, and her adds.
  grandmotherSlag: { id: 'grandmotherSlag', name: 'Grandmother Slag', hp: 22000, speed: 30, damage: 18, radius: 56, xp: 0, rank: 'boss', title: 'Raid boss' },
  // Raid 2 (Phase 7): the next world boss in person, and the Craw that holds a swallowed hero.
  regent: { id: 'regent', name: 'The Furnace Regent', hp: 15500, speed: 24, damage: 20, radius: 52, xp: 0, rank: 'boss', title: 'Raid boss' },
  colossus: { id: 'colossus', name: 'The Colossus', hp: 19500, speed: 26, damage: 20, radius: 56, xp: 0, rank: 'boss', title: 'Raid boss' },
  vorhulm: { id: 'vorhulm', name: 'Uncle Glut', hp: 18000, speed: 30, damage: 18, radius: 56, xp: 0, rank: 'boss', title: 'Raid boss' },
  craw: { id: 'craw', name: 'Craw', hp: 120, speed: 0, damage: 0, radius: 22, xp: 0, rank: 'elite', stationary: true, title: 'Break it to free your ally' },
  slagling: { id: 'slagling', name: 'Slagling', hp: 120, speed: 70, damage: 6, radius: 11, xp: 1, rank: 'normal' },
  // The Wrackline (fifth solo dungeon): the Ebb drags everything to the drain, except what swims in it.
  shoalLurker: { id: 'shoalLurker', name: 'Shoal Lurker', hp: 280, speed: 84, damage: 6, radius: 14, xp: 2, rank: 'elite', title: "Can't board rafts" },
  bargeHauler: { id: 'bargeHauler', name: 'Barge Hauler', hp: 950, speed: 34, damage: 15, radius: 22, xp: 8, rank: 'elite', title: 'Haul' },
  hessa: { id: 'hessa', name: 'Aunt Ebb', hp: 3400, speed: 0, damage: 9, radius: 44, xp: 0, rank: 'boss', title: 'Boss' },
  kilnMother: { id: 'kilnMother', name: 'The Kiln Mother', hp: 3800, speed: 30, damage: 25, radius: 42, xp: 0, rank: 'boss', title: 'Boss' },
  /** BOSSV2 (design, 25 Nov): the Kiln Mother's stage 2 bellows. They don't attack; break all 3 and she falls out stunned. */
  kilnBellows: { id: 'kilnBellows', name: 'Kiln Bellows', hp: 200, speed: 0, damage: 0, radius: 24, xp: 0, rank: 'normal', stationary: true },
};
