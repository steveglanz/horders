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
  | 'cinderBrute' | 'ashmaw' | 'kilnMother';

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ashling: { id: 'ashling', name: 'Ashling', hp: 10, speed: 52, damage: 5, radius: 9, xp: 1, rank: 'normal' },
  cinderhound: { id: 'cinderhound', name: 'Cinderhound', hp: 7, speed: 92, damage: 5, radius: 8, xp: 1, rank: 'normal' },
  husk: { id: 'husk', name: 'Hollow Husk', hp: 48, speed: 34, damage: 10, radius: 15, xp: 4, rank: 'normal' },
  rift: { id: 'rift', name: 'Hollow Rift', hp: 420, speed: 0, damage: 0, radius: 22, xp: 12, rank: 'normal', stationary: true },
  acolyte: { id: 'acolyte', name: 'Ember Acolyte', hp: 380, speed: 0, damage: 8, radius: 14, xp: 8, rank: 'elite', stationary: true, title: 'Heals the Kiln Mother' },
  cinderBrute: { id: 'cinderBrute', name: 'Cinder Brute', hp: 900, speed: 46, damage: 18, radius: 26, xp: 40, rank: 'elite', title: 'Elite' },
  ashmaw: { id: 'ashmaw', name: 'Ashmaw the Glutton', hp: 1300, speed: 58, damage: 14, radius: 24, xp: 50, rank: 'rare', title: 'Rare' },
  kilnMother: { id: 'kilnMother', name: 'Smolderhusk, the Kiln Mother', hp: 5500, speed: 30, damage: 25, radius: 42, xp: 0, rank: 'boss', title: 'Boss' },
};
