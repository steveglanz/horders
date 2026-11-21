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
  | 'cinderBrute' | 'ashmaw' | 'kilnMother'
  | 'glassWarden' | 'emberTwin' | 'sluiceCrawler' | 'maelra'
  | 'lensbearer' | 'shade' | 'brandkeeper' | 'twinLamp' | 'lensmother'
  | 'worldShadow' | 'ondrel' | 'ysmeret' | 'oskel'
  | 'rimehound' | 'snuffer' | 'frostWarden' | 'hoarfrostWeaver' | 'nhevra'
  | 'grandmotherSlag' | 'slagling'
  | 'coalmouth' | 'craw'
  | 'colossus'
  | 'shoalLurker' | 'bargeHauler' | 'hessa';

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ashling: { id: 'ashling', name: 'Ashling', hp: 10, speed: 52, damage: 5, radius: 9, xp: 1, rank: 'normal' },
  cinderhound: { id: 'cinderhound', name: 'Cinderhound', hp: 150, speed: 100, damage: 7, radius: 11, xp: 1, rank: 'elite', title: 'Pack hunter' },
  husk: { id: 'husk', name: 'Hollow Warden', hp: 700, speed: 40, damage: 14, radius: 20, xp: 4, rank: 'elite', title: 'Guardian' },
  rift: { id: 'rift', name: 'Hollow Rift', hp: 420, speed: 0, damage: 0, radius: 22, xp: 12, rank: 'normal', stationary: true },
  acolyte: { id: 'acolyte', name: 'Ember Acolyte', hp: 380, speed: 0, damage: 8, radius: 14, xp: 8, rank: 'elite', stationary: true, title: 'Healer' },
  cinderBrute: { id: 'cinderBrute', name: 'Cinder Brute', hp: 1500, speed: 46, damage: 18, radius: 26, xp: 40, rank: 'elite', title: 'Elite' },
  ashmaw: { id: 'ashmaw', name: 'Coalmouth the Glutton', hp: 1700, speed: 58, damage: 14, radius: 24, xp: 50, rank: 'rare', title: 'Rare' },
  glassWarden: { id: 'glassWarden', name: 'Glass Warden', hp: 950, speed: 42, damage: 14, radius: 20, xp: 6, rank: 'elite', title: 'Mirror' },
  emberTwin: { id: 'emberTwin', name: 'Ember Twin', hp: 620, speed: 62, damage: 10, radius: 16, xp: 5, rank: 'elite', title: 'Twin' },
  sluiceCrawler: { id: 'sluiceCrawler', name: 'Sluice Crawler', hp: 820, speed: 50, damage: 12, radius: 18, xp: 6, rank: 'elite', title: 'Tidecaller' },
  maelra: { id: 'maelra', name: 'Maelra, the Drowned Bellows', hp: 6000, speed: 36, damage: 24, radius: 40, xp: 0, rank: 'boss', title: 'Boss' },
  // The Glarewell: light hurts, shadow hides you, and shadow has things in it.
  lensbearer: { id: 'lensbearer', name: 'Lensbearer', hp: 1000, speed: 34, damage: 12, radius: 20, xp: 6, rank: 'elite', title: 'Glare' },
  shade: { id: 'shade', name: 'Shade', hp: 300, speed: 70, damage: 8, radius: 13, xp: 2, rank: 'elite', title: 'Shadowborn' },
  brandkeeper: { id: 'brandkeeper', name: 'Brandkeeper', hp: 900, speed: 44, damage: 12, radius: 19, xp: 6, rank: 'elite', title: 'Brand' },
  twinLamp: { id: 'twinLamp', name: 'Twin Lamp', hp: 760, speed: 30, damage: 10, radius: 17, xp: 5, rank: 'elite', title: 'Lamp' },
  lensmother: { id: 'lensmother', name: 'The Lensmother', hp: 6200, speed: 32, damage: 22, radius: 40, xp: 0, rank: 'boss', title: 'Boss' },
  // A shadow of the shared world boss: it can't be killed, only hurt for 60 seconds.
  worldShadow: { id: 'worldShadow', name: 'Shadow of the World Boss', hp: 1e9, speed: 34, damage: 22, radius: 48, xp: 0, rank: 'boss', title: 'World boss' },
  // The Hammerdeep's group boss: role checks rather than dodge checks.
  oskel: { id: 'oskel', name: 'Oskel of the Pressworks', hp: 6400, speed: 32, damage: 16, radius: 44, xp: 0, rank: 'boss', title: 'Group boss' },
  ysmeret: { id: 'ysmeret', name: 'Ysmeret, the Twofold Flame', hp: 6200, speed: 36, damage: 15, radius: 42, xp: 0, rank: 'boss', title: 'Group boss' },
  // The Coldmarrow (C1): frost-touched foes. Killing one feeds your Hearthcoal.
  rimehound: { id: 'rimehound', name: 'Rimehound', hp: 260, speed: 92, damage: 9, radius: 14, xp: 2, rank: 'elite', title: 'Frost-touched' },
  snuffer: { id: 'snuffer', name: 'Snuffer', hp: 200, speed: 40, damage: 4, radius: 15, xp: 3, rank: 'elite', title: 'Dims your coal' },
  frostWarden: { id: 'frostWarden', name: 'Frost Warden', hp: 700, speed: 30, damage: 16, radius: 24, xp: 8, rank: 'elite', title: 'Warm it to crack it' },
  hoarfrostWeaver: { id: 'hoarfrostWeaver', name: 'Hoarfrost Weaver', hp: 700, speed: 36, damage: 8, radius: 18, xp: 6, rank: 'elite', title: 'Frost Lace' },
  nhevra: { id: 'nhevra', name: 'Nhevra, the Cold Hearth', hp: 3400, speed: 30, damage: 20, radius: 42, xp: 0, rank: 'boss', title: 'Boss' },
  ondrel: { id: 'ondrel', name: 'Ondrel of the Hammerdeep', hp: 4800, speed: 34, damage: 16, radius: 44, xp: 0, rank: 'boss', title: 'Group boss' },
  // The raid (C3): the world boss in person, and her adds.
  grandmotherSlag: { id: 'grandmotherSlag', name: 'Grandmother Slag', hp: 22000, speed: 30, damage: 18, radius: 56, xp: 0, rank: 'boss', title: 'Raid boss' },
  // Raid 2 (Phase 7): the next world boss in person, and the Craw that holds a swallowed hero.
  colossus: { id: 'colossus', name: 'The Cinder Colossus', hp: 17750, speed: 26, damage: 20, radius: 56, xp: 0, rank: 'boss', title: 'Raid boss' },
  coalmouth: { id: 'coalmouth', name: 'Old Coalmouth', hp: 18000, speed: 30, damage: 18, radius: 56, xp: 0, rank: 'boss', title: 'Raid boss' },
  craw: { id: 'craw', name: 'Craw', hp: 120, speed: 0, damage: 0, radius: 22, xp: 0, rank: 'elite', stationary: true, title: 'Break it to free your ally' },
  slagling: { id: 'slagling', name: 'Slagling', hp: 120, speed: 70, damage: 6, radius: 11, xp: 1, rank: 'normal' },
  // The Wrackline (fifth solo dungeon): the Ebb drags everything to the drain, except what swims in it.
  shoalLurker: { id: 'shoalLurker', name: 'Shoal Lurker', hp: 280, speed: 84, damage: 6, radius: 14, xp: 2, rank: 'elite', title: "Can't board rafts" },
  bargeHauler: { id: 'bargeHauler', name: 'Barge Hauler', hp: 950, speed: 34, damage: 15, radius: 22, xp: 8, rank: 'elite', title: 'Haul' },
  hessa: { id: 'hessa', name: 'Hessa of the Ebb', hp: 3400, speed: 0, damage: 9, radius: 44, xp: 0, rank: 'boss', title: 'Boss' },
  kilnMother: { id: 'kilnMother', name: 'Smolderhusk, the Kiln Mother', hp: 3800, speed: 30, damage: 25, radius: 42, xp: 0, rank: 'boss', title: 'Boss' },
};
