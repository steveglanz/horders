/**
 * The Kiln Depths: a run is a short route of hand-built encounters ending in
 * the Kiln Mother. Few enemies, each with mechanics worth learning.
 */
import { EnemyKind } from './enemies';

export type EncounterId = 'pack' | 'wardens' | 'warpack' | 'brute' | 'ashmaw' | 'acolytes' | 'kilnMother' | 'worldShadow';

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
  worldShadow: { id: 'worldShadow', name: 'Shadow of the World Boss', tip: 'Bonus fight: 60 seconds to hurt it. Every hit counts triple toward the world boss.', spawns: [{ kind: 'worldShadow', n: 1 }] },
  kilnMother: { id: 'kilnMother', name: 'Smolderhusk, the Kiln Mother', tip: 'Dodge the red, Quench her Cataclysm, stand in the gold.', spawns: [{ kind: 'kilnMother', n: 1 }] },
};

const OPENERS: EncounterId[] = ['pack', 'wardens', 'warpack'];
const NAMED: EncounterId[] = ['brute', 'ashmaw'];
const HARD: EncounterId[] = ['acolytes', 'ashmaw'];

/** Rolls a 5-fight route: two openers, a named foe, a hard fight, the boss. */
export function rollRoute(pick: (n: number) => number): EncounterId[] {
  const open = [...OPENERS];
  const a = open.splice(pick(open.length), 1)[0];
  const b = open.splice(pick(open.length), 1)[0];
  const named = NAMED[pick(NAMED.length)];
  const hard = HARD.filter((h) => h !== named);
  return [a, b, named, hard[pick(hard.length)], 'kilnMother'];
}
