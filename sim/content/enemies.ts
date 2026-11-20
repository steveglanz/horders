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
  | 'worldShadow';

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ashling: { id: 'ashling', name: 'Ashling', hp: 10, speed: 52, damage: 5, radius: 9, xp: 1, rank: 'normal' },
  cinderhound: { id: 'cinderhound', name: 'Cinderhound', hp: 150, speed: 100, damage: 7, radius: 11, xp: 1, rank: 'elite', title: 'Pack hunter' },
  husk: { id: 'husk', name: 'Hollow Warden', hp: 700, speed: 40, damage: 14, radius: 20, xp: 4, rank: 'elite', title: 'Guardian' },
  rift: { id: 'rift', name: 'Hollow Rift', hp: 420, speed: 0, damage: 0, radius: 22, xp: 12, rank: 'normal', stationary: true },
  acolyte: { id: 'acolyte', name: 'Ember Acolyte', hp: 380, speed: 0, damage: 8, radius: 14, xp: 8, rank: 'elite', stationary: true, title: 'Healer' },
  cinderBrute: { id: 'cinderBrute', name: 'Cinder Brute', hp: 1500, speed: 46, damage: 18, radius: 26, xp: 40, rank: 'elite', title: 'Elite' },
  ashmaw: { id: 'ashmaw', name: 'Ashmaw the Glutton', hp: 1700, speed: 58, damage: 14, radius: 24, xp: 50, rank: 'rare', title: 'Rare' },
  glassWarden: { id: 'glassWarden', name: 'Glass Warden', hp: 950, speed: 42, damage: 14, radius: 20, xp: 6, rank: 'elite', title: 'Mirror' },
  emberTwin: { id: 'emberTwin', name: 'Ember Twin', hp: 620, speed: 62, damage: 10, radius: 16, xp: 5, rank: 'elite', title: 'Twin' },
  sluiceCrawler: { id: 'sluiceCrawler', name: 'Sluice Crawler', hp: 820, speed: 50, damage: 12, radius: 18, xp: 6, rank: 'elite', title: 'Tidecaller' },
  maelra: { id: 'maelra', name: 'Maelra, the Drowned Bellows', hp: 6000, speed: 36, damage: 24, radius: 40, xp: 0, rank: 'boss', title: 'Boss' },
  // A shadow of the shared world boss: it can't be killed, only hurt for 60 seconds.
  worldShadow: { id: 'worldShadow', name: 'Shadow of the World Boss', hp: 1e9, speed: 34, damage: 22, radius: 48, xp: 0, rank: 'boss', title: 'World boss' },
  kilnMother: { id: 'kilnMother', name: 'Smolderhusk, the Kiln Mother', hp: 3800, speed: 30, damage: 25, radius: 42, xp: 0, rank: 'boss', title: 'Boss' },
};
