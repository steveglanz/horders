/**
 * Which sound each simulation event makes. Pure so it can be tested without a
 * browser: GameScene hands every event to `cueFor`, and the audio engine plays
 * whatever comes back.
 */
import type { SimEvent } from '../../sim/world';
import type { ClassId } from '../../sim/content/emberwright';
import { ENEMIES } from '../../sim/content/enemies';
import type { SoundId } from './sounds';

export interface Cue {
  id: SoundId;
  /** Loudness multiplier (default 1). */
  vol?: number;
  /** Randomize pitch by up to this fraction, so repeats don't sound robotic. */
  jitter?: number;
}

/** What the cue needs to know about the run. */
export interface CueContext {
  cls: ClassId;
  /** The hero this screen plays (co-op: events for others are quieter or silent). */
  acting: number;
}

const ABILITY: Record<ClassId, (SoundId | null)[]> = {
  emberwright: ['emberWave', null, 'emberNova', 'zap'],
  lumen: ['lumenBurst', null, 'lumenSanctuary', 'zap'],
  bulwark: ['bulwarkSlam', null, 'bulwarkBastion', 'zap'],
  duskblade: [null, null, 'duskExecute', 'zap'],
};

export function cueFor(ev: SimEvent, c: CueContext): Cue | null {
  const mine = (hero?: number) => hero === undefined || hero === c.acting;
  switch (ev.type) {
    case 'hit': return ev.crit ? { id: 'crit', jitter: 0.08 } : { id: 'hit', jitter: 0.15 };
    case 'kill': {
      const rank = ENEMIES[ev.kind]?.rank;
      if (rank === 'boss' || rank === 'rare') return { id: 'bigKill' };
      if (rank === 'elite') return { id: 'explode', vol: 0.8, jitter: 0.1 };
      return { id: 'kill', jitter: 0.2 };
    }
    case 'playerHurt':
      if (!mine(ev.hero)) return null;
      return ev.amount >= 20 ? { id: 'hurtBig' } : { id: 'hurt', jitter: 0.1 };
    case 'levelUp': return mine(ev.hero) ? { id: 'levelUp' } : { id: 'levelUp', vol: 0.4 };
    case 'eliteSpawn': return { id: 'eliteSpawn' };
    case 'bossSpawn': return { id: 'bossSpawn' };
    case 'rareSpawn': return { id: 'rareSpawn' };
    case 'bossEnrage': return { id: 'enrage' };
    case 'phase': return { id: 'phase' };
    case 'explode':
    case 'strike': return { id: 'explode', jitter: 0.12 };
    case 'slam': return { id: 'slam' };
    case 'glare': return { id: ev.hit ? 'glareHit' : 'glare' };
    case 'brandBurst': return { id: 'brand' };
    case 'pillarCrack': return { id: 'crack' };
    case 'chest': return { id: 'chest' };
    case 'revive': return mine(ev.hero) ? { id: 'revive' } : { id: 'revive', vol: 0.5 };
    case 'potion': return { id: 'revive' };
    case 'ability': {
      const id = ABILITY[c.cls]?.[ev.slot];
      return id ? { id, jitter: 0.04 } : null;
    }
    case 'blink': return { id: c.cls === 'lumen' ? 'lumenStep' : 'emberBlink' };
    case 'dash':
      if (ev.dodge) return { id: 'duskStep' };
      return { id: c.cls === 'bulwark' ? 'bulwarkCharge' : 'duskDash' };
    case 'swing': return { id: 'swing', jitter: 0.15, vol: ev.spin ? 1.4 : 1 };
    case 'parry': return { id: 'parry' };
    case 'mote': return { id: 'mote', jitter: 0.2 };
    case 'castStart': return { id: 'castWarn' };
    case 'interrupt': return { id: 'interrupt' };
    case 'castDone': return { id: 'castDone' };
    case 'heal': return { id: 'heal', jitter: 0.05 };
    case 'ward': return { id: 'ward' };
    case 'fork': return { id: 'fork' };
    case 'gateChosen': return { id: 'gate' };
    case 'riftOpen': return { id: 'riftOpen' };
    case 'riftClosed': return { id: 'riftClosed' };
    case 'gather': return { id: 'gather' };
    case 'soak': return { id: ev.ok ? 'soakOk' : 'soakFail' };
    case 'drop':
      return { id: ev.rarity === 'mythic' ? 'dropMythic' : ev.rarity === 'epic' ? 'dropEpic' : ev.rarity === 'rare' ? 'dropRare' : 'drop', jitter: 0.03 };
    case 'loot': return mine(ev.hero) && ev.equipped ? { id: 'equip' } : null;
    case 'quest': return { id: 'quest' };
    case 'encounterStart': return null;
    case 'encounterClear': return null; // the run's end and the talent draft carry their own sounds
    case 'end': return { id: ev.victory ? 'victory' : 'defeat' };
  }
  return null;
}

/**
 * Minimum seconds between two plays of the same sound. Keeps a 40-enemy pile-up
 * from turning into a wall of noise (and keeps phones from running out of voices).
 */
export const THROTTLE: Partial<Record<SoundId, number>> = {
  hit: 0.045,
  crit: 0.06,
  kill: 0.05,
  swing: 0.07,
  mote: 0.09,
  heal: 0.5,
  explode: 0.09,
  castWarn: 0.9,
  castDone: 0.3,
  drop: 0.07,
  dropRare: 0.1,
  hurt: 0.12,
  ward: 0.3,
  zap: 0.1,
  click: 0.03,
};
