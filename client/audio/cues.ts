/**
 * Which sound each simulation event makes. Pure so it can be tested without a
 * browser: GameScene hands every event to `cueFor`, and the audio engine plays
 * whatever comes back.
 */
import type { SimEvent } from '../../sim/world';
import type { ClassId } from '../../sim/content/emberwright';
import { ENEMIES, EnemyKind } from '../../sim/content/enemies';
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
  /** Co-op: every hero's health, so the engine can hear heroes go down and get up. */
  hp?: readonly number[];
  /** The current boss, so each boss gets its own phase-change sting. */
  boss?: EnemyKind;
  /** The Hammerdeep: Anvilfall is winding up on this screen's hero (World.anvilOnMe). */
  anvilOnMe?: boolean;
}

const ABILITY: Record<ClassId, (SoundId | null)[]> = {
  emberwright: ['emberWave', null, 'emberNova', 'zap'],
  lumen: ['lumenBurst', null, 'lumenSanctuary', 'zap'],
  bulwark: ['bulwarkSlam', null, 'bulwarkBastion', 'zap'],
  duskblade: [null, null, 'duskExecute', 'zap'],
};

/**
 * Casts with their own sounds, by the cast's name (start = wind-up, done = it lands).
 * Matching on names lets a new boss get its sounds without a new event type.
 */
export const CAST_SOUNDS: Record<string, { start?: SoundId; done?: SoundId }> = {
  // The Hammerdeep: Ondrel, the Anvilward (docs/design/group-dungeons.md).
  Anvilfall: { start: 'anvilWarn', done: 'anvilfall' },
  'Choir of Iron': { done: 'choir' },
  'Hammer Sweep': { done: 'sweep' },
  // The Ashvents: Ysmeret, the Twofold Flame (PR #66).
  'Twin Vents': { start: 'ventWarn' },
  'Scatter Embers': { start: 'scatterWarn', done: 'scatter' },
  'Bellow Slam': { start: 'bellowWarn', done: 'bellow' },
  // The Coldmarrow: Nhevra, the Cold Hearth (design brief C1). Names as in the brief.
  'Long Night': { start: 'longNightWarn', done: 'longNight' },
  Snuff: { start: 'snuff' },
  'Snuffer Tide': { start: 'snufferTide' },
  // The raid: Grandmother Slag (design brief C3).
  'Ladle Pour': { start: 'ladleWarn', done: 'ladle' },
  'Called Out': { done: 'calledOut' },
  'Cinder Marks': { start: 'scatterWarn', done: 'scatter' },
};

/** Each boss's own phase-change sting. */
/** Keyed by EnemyKind (as a string, so bosses still in open PRs can be listed before they land). */
export const PHASE_STING: Record<string, SoundId | SoundId[]> = {
  kilnMother: 'phaseKiln',
  maelra: 'phaseMaelra',
  lensmother: 'phaseLens',
  ondrel: 'phaseOndrel',
  worldShadow: 'phaseShadow',
  // Bosses in open PRs or still being built: these keys must match their EnemyKind when they land.
  ysmeret: 'phaseYsmeret',
  nhevra: 'phaseIce',
  // The raid has its own sting per phase: [phase 2 The Pour, phase 3 Last Ember].
  grandmotherSlag: ['phaseRaid2', 'phaseRaid3'],
};

/** The sting for a boss reaching `phase` (2 or 3). */
export function phaseSting(boss: string | undefined, phase: number): SoundId {
  const s = boss ? PHASE_STING[boss] : undefined;
  if (!s) return 'phase';
  return Array.isArray(s) ? s[Math.max(0, Math.min(s.length - 1, phase - 2))] : s;
}

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
    case 'phase': return { id: phaseSting(c.boss, ev.phase), vol: ev.phase >= 3 ? 1.15 : 1 };
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
    case 'castStart': return { id: CAST_SOUNDS[ev.name]?.start ?? 'castWarn' };
    case 'interrupt': return { id: 'interrupt' };
    case 'slagGrip': return { id: 'slag', vol: 0.55 + 0.1 * ev.stacks, jitter: 0.06 };
    case 'cleanse': return { id: 'cleanse' };
    case 'castDone': return { id: CAST_SOUNDS[ev.name]?.done ?? 'castDone' };
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
    case 'burnout': return { id: ev.warn ? 'burnoutWarn' : 'burnout' };
    case 'encounterStart': return null;
    case 'encounterClear': return null; // the run's end and the talent draft carry their own sounds
    case 'end': return { id: ev.victory ? 'victory' : 'defeat' };
  }
  return null;
}

/**
 * Co-op: sounds for heroes going down and getting back up. The simulation has
 * no event for either, so this compares each hero's health with last tick's.
 * `wasDown` is updated in place.
 */
export function partyCues(wasDown: boolean[], hp: readonly number[], acting: number): Cue[] {
  const out: Cue[] = [];
  if (wasDown.length !== hp.length) {
    wasDown.length = 0;
    hp.forEach((h) => wasDown.push(h <= 0));
    return out;
  }
  hp.forEach((h, i) => {
    const down = h <= 0;
    if (down && !wasDown[i]) out.push({ id: i === acting ? 'selfDown' : 'allyDown' });
    else if (!down && wasDown[i]) out.push({ id: 'allyUp', vol: i === acting ? 1 : 0.7 });
    wasDown[i] = down;
  });
  return out;
}

/** The "you're targeted" sting: once, when Anvilfall starts winding up on you. `state.on` is updated in place. */
export function targetCue(state: { on: boolean }, onMe: boolean): Cue | null {
  const fire = onMe && !state.on;
  state.on = onMe;
  return fire ? { id: 'targeted' } : null;
}

/**
 * Minimum seconds between two plays of the same sound. Keeps a 40-enemy pile-up
 * from turning into a wall of noise (and keeps phones from running out of voices).
 */
export const THROTTLE: Partial<Record<SoundId, number>> = {
  hit: 0.045,
  slag: 0.2,
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
  select: 0.03,
  back: 0.05,
  open: 0.05,
  confirm: 0.1,
};
