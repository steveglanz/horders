/** Enemy definitions. Content is data so new zones are mostly data work. */
export interface EnemyDef {
  id: EnemyKind;
  name: string;
  hp: number;
  speed: number; // world units per second
  damage: number; // per contact hit
  radius: number;
  xp: number;
  /** Bosses and elites run scripted abilities instead of only chasing. */
  rank: 'normal' | 'elite' | 'boss';
}

export type EnemyKind = 'ashling' | 'cinderhound' | 'husk' | 'cinderBrute' | 'kilnMother';

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ashling: { id: 'ashling', name: 'Ashling', hp: 10, speed: 52, damage: 5, radius: 9, xp: 1, rank: 'normal' },
  cinderhound: { id: 'cinderhound', name: 'Cinderhound', hp: 7, speed: 92, damage: 5, radius: 8, xp: 1, rank: 'normal' },
  husk: { id: 'husk', name: 'Hollow Husk', hp: 48, speed: 34, damage: 10, radius: 15, xp: 4, rank: 'normal' },
  cinderBrute: { id: 'cinderBrute', name: 'Cinder Brute', hp: 900, speed: 46, damage: 18, radius: 26, xp: 40, rank: 'elite' },
  kilnMother: { id: 'kilnMother', name: 'Smolderhusk, the Kiln Mother', hp: 3200, speed: 30, damage: 25, radius: 42, xp: 0, rank: 'boss' },
};
