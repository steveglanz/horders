/**
 * Which sound each simulation event makes. Pure so it can be tested without a
 * browser: GameScene hands every event to `cueFor`, and the audio engine plays
 * whatever comes back.
 */
import type { SimEvent } from '../../sim/world';
import { TALENTS, type ClassId, type TalentId } from '../../sim/content/emberwright';
import { ENEMIES, EnemyKind } from '../../sim/content/enemies';
import type { SoundId } from './sounds';
import { SET_TUNING, type SetId } from '../../sim/content/sets';

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
  /** The Wrackline: the Ebb is pulling right now (World.ebbT > 0). Its start sounds the drag. */
  ebbPull?: boolean;
  /** Co-op: each hero's party role ('tank', 'healer' or 'dps'), as on the party frames. */
  roles?: string[];
  /** Co-op pick-ups: each hero's seconds stood on so far, the seconds needed, and pick-ups left (World.revivesLeft). */
  revive?: { t: number[]; need: number; left: number };
  /** Verb-set states on this screen's hero, for the set-proc cues (setCues). Each is false when the hero lacks the pieces. */
  sets?: SetFlags;
}

/** The verb-set states the client reads off World.player (sim/content/sets.ts), each already gated on the pieces worn. */
export interface SetFlags {
  /** Wrackrider (2): Planted. */
  planted: boolean;
  /** Tidewalker (3): the next hit's surge is ready. */
  surge: boolean;
  /** Kilnbreaker (2): sharpened by an interrupt (kbT > 0). */
  sharp: boolean;
  /** Hearthkeeper (3): at full Warmth. */
  warmFull: boolean;
  /** Kinbound (2): Covered, an ally's heal cuts your damage taken (the sim only sets coverT on a wearer). */
  covered: boolean;
  /** Kinbound (3): Bonded, after the hero covered an ally or was covered by a wearer (an ally can be Bonded without the set). */
  bonded: boolean;
  /** Relayer: Relayed, +damage after a gold circle (on the soaker, and with 3 pieces the nearest ally too). */
  relayed: boolean;
}

/** Reads the set flags off a hero (World.player) and the pieces it wears (World.setCount). */
export function setFlagsOf(
  p: { hp: number; planted?: boolean; surge?: boolean; kbT?: number; warmth?: number; coverT?: number; bondT?: number; relayT?: number },
  count: (id: SetId) => number,
): SetFlags {
  const up = p.hp > 0;
  return {
    planted: up && count('wrackrider') >= 2 && !!p.planted,
    surge: up && count('tidewalker') >= 3 && !!p.surge,
    sharp: up && count('kilnbreaker') >= 2 && (p.kbT ?? 0) > 0,
    warmFull: up && count('hearthkeeper') >= 3 && (p.warmth ?? 0) >= SET_TUNING.hkMax,
    covered: up && (p.coverT ?? 0) > 0,
    bonded: up && (p.bondT ?? 0) > 0,
    relayed: up && (p.relayT ?? 0) > 0,
  };
}

const SET_SOUND: Record<keyof SetFlags, SoundId> = { planted: 'planted', surge: 'surgeReady', sharp: 'sharpen', warmFull: 'warmthFull', covered: 'covered', bonded: 'bonded', relayed: 'relayed' };

/**
 * The set procs have no events of their own (they are states on the hero), so this sounds each one
 * as it turns on. `was` is last tick's flags, updated in place; a dead hero's flags read as off.
 */
export function setCues(was: Partial<SetFlags>, now: SetFlags): Cue[] {
  const out: Cue[] = [];
  for (const k of Object.keys(SET_SOUND) as (keyof SetFlags)[]) {
    if (now[k] && !was[k]) out.push({ id: SET_SOUND[k], vol: k === 'planted' ? 0.8 : k === 'surge' ? 0.7 : 1 });
    was[k] = now[k];
  }
  return out;
}

/** Each class's ability option (sim ALT_ABILITIES), whichever slot it replaces. */
const ALT_ABILITY: Partial<Record<ClassId, SoundId>> = {
  emberwright: 'emberWard',
  duskblade: 'hamstring',
  bulwark: 'rallyingCry',
  lumen: 'lightwell',
  slagbinder: 'slagPit',
};

const ABILITY: Record<ClassId, (SoundId | null)[]> = {
  emberwright: ['emberWave', null, 'emberNova', 'zap'],
  lumen: ['lumenBurst', null, 'lumenSanctuary', 'zap'],
  bulwark: ['bulwarkSlam', null, 'bulwarkBastion', 'zap'],
  duskblade: [null, null, 'duskExecute', 'zap'],
  // Slagbinder: Molten Plating sounds on its 'plate' event and Interpose on 'dash', so slots 0 and 1 are silent here.
  slagbinder: [null, null, 'coolingShell', 'clinker'],
};

/**
 * Boss casts with their own sounds (start = wind-up, done = it lands), keyed by the sim's cast id,
 * not its display name, so renaming a cast never silences it. A new boss needs no new event type.
 */
export const CAST_SOUNDS: Record<string, { start?: SoundId; done?: SoundId }> = {
  // The Hammerdeep: Ondrel of the Hammerdeep (docs/design/group-dungeons.md).
  anvilfall: { start: 'anvilWarn', done: 'anvilfall' }, // Anvilfall
  choir: { done: 'choir' }, // Choir of Iron
  hammerSweep: { done: 'sweep' }, // Hammer Sweep
  // The Ashvents: Ysmeret, the Twofold Flame.
  twinVents: { start: 'ventWarn' }, // Twin Vents
  scatter: { start: 'scatterWarn', done: 'scatter' }, // Scatter Embers, and the raid's Cinder Marks
  bellowSlam: { start: 'bellowWarn', done: 'bellow' }, // Bellow Slam
  // The Coldmarrow: Nhevra, the Cold Hearth.
  longNight: { start: 'longNightWarn', done: 'longNight' }, // Long Night
  snuff: { start: 'snuff' }, // Snuff
  snufferTide: { start: 'snufferTide' }, // Snuffer Tide
  frostLace: { start: 'frostLace' }, // Frost Lace
  // The raid: Grandmother Slag.
  ladlePour: { start: 'ladleWarn', done: 'ladle' }, // Ladle Pour
  pour: { start: 'pourWarn', done: 'ladle' }, // The Pour
  crucibleVents: { start: 'soakCall' }, // Crucible Vents
  lastEmber: { start: 'lastEmberWarn', done: 'lastEmber' }, // Last Ember
  // The Wrackline: Hessa of the Ebb.
  ebb: { start: 'ebbWarn' }, // The Ebb (the pull itself sounds from CueContext.ebbPull)
  sink: { start: 'sinkWarn', done: 'sink' }, // Sink
  haul: { start: 'haulWarn', done: 'haul' }, // Haul (the Barge Hauler)
  shoalCall: { start: 'shoalCall' }, // Call the Shoal
  // The Pressworks (Oskel). The Downstroke lands as a soak (soakOk / soakFail); the Rivets land as strikes.
  downstroke: { start: 'downstrokeWarn' }, rivets: { start: 'rivetsWarn' }, stamp: { start: 'stampWarn', done: 'stamp' },
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
  hessa: 'phaseHessa',
  oskel: 'phaseOskel',
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
    case 'namedSpawn': return { id: 'namedSpawn' };
    case 'namedKill': return { id: 'namedKill' };
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
      if (ev.alt) return { id: ALT_ABILITY[c.cls] ?? 'zap', jitter: 0.04 };
      const id = ABILITY[c.cls]?.[ev.slot];
      return id ? { id, jitter: 0.04 } : null;
    }
    case 'blink': return { id: c.cls === 'lumen' ? 'lumenStep' : 'emberBlink' };
    case 'dash':
      if (c.cls === 'slagbinder') return { id: 'slagLeap' };
      if (ev.dodge) return { id: 'duskStep' };
      return { id: c.cls === 'bulwark' ? 'bulwarkCharge' : 'duskDash' };
    case 'swing': return { id: 'swing', jitter: 0.15, vol: ev.spin ? 1.4 : 1 };
    case 'parry': return { id: 'parry' };
    case 'mote': return { id: 'mote', jitter: 0.2 };
    case 'lob': return { id: 'slagLob', jitter: 0.15 };
    case 'plate': return { id: 'slagPlate', vol: mine(ev.hero) ? 1 : 0.8 };
    case 'brittle': return { id: 'brittle', jitter: 0.1 };
    case 'castStart': return { id: CAST_SOUNDS[ev.id]?.start ?? 'castWarn' };
    case 'interrupt': return { id: 'interrupt' };
    case 'slagGrip': return { id: 'slag', vol: 0.55 + 0.1 * ev.stacks, jitter: 0.06 };
    case 'cleanse': return { id: 'cleanse' };
    case 'castDone': return { id: CAST_SOUNDS[ev.id]?.done ?? 'castDone' };
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
    case 'dodge': return { id: 'dodged' };
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
export function partyCues(wasDown: boolean[], hp: readonly number[], acting: number, roles?: readonly string[]): Cue[] {
  const out: Cue[] = [];
  if (wasDown.length !== hp.length) {
    wasDown.length = 0;
    hp.forEach((h) => wasDown.push(h <= 0));
    return out;
  }
  hp.forEach((h, i) => {
    const down = h <= 0;
    // G4: losing the tank or the healer gets its own, more urgent call (the party frames show who they are).
    if (down && !wasDown[i]) out.push({ id: i === acting ? 'selfDown' : roles?.[i] === 'tank' || roles?.[i] === 'healer' ? 'roleDown' : 'allyDown' });
    else if (!down && wasDown[i]) out.push({ id: 'allyUp', vol: i === acting ? 1 : 0.7 });
    wasDown[i] = down;
  });
  return out;
}

/**
 * A talent pick. Taking a capstone gets its own sting: it crowns the branch and opens
 * that branch's deep cards (C5 round 2) for the rest of the run. Other picks only
 * make the card tap's own sound.
 */
export function pickCue(id: TalentId | undefined): Cue | null {
  if (!id) return null;
  if (TALENTS[id]?.capstone) return { id: 'capstone' };
  // Party cards (Season 2, #241): a card for the party gets its own call-and-answer chime.
  if (TALENTS[id]?.party) return { id: 'partyCard' };
  return null;
}

/** What reviveCues remembers between ticks. */
export interface ReviveState {
  t: number[];
  left: number;
}

/**
 * G6 pick-ups (PR #173): a soft start when an ally begins standing on a downed hero,
 * a pulse each second (louder towards the end; 9 s while a boss is up), a fizzle if
 * the ally steps off early, and a low toll when the boss fight's one pick-up is spent.
 * The pick-up itself already sounds on the sim's 'revive' event. `state` is updated in place.
 */
export function reviveCues(state: ReviveState, reviveT: readonly number[], need: number, revivesLeft: number): Cue[] {
  const out: Cue[] = [];
  if (state.left > 0 && revivesLeft === 0) out.push({ id: 'revivesSpent' });
  state.left = revivesLeft;
  if (state.t.length !== reviveT.length) {
    state.t = [...reviveT];
    return out;
  }
  reviveT.forEach((now, i) => {
    const prev = state.t[i];
    if (now > 0 && prev === 0) out.push({ id: 'reviveStart' });
    else if (now > 0 && Math.floor(now) > Math.floor(prev)) out.push({ id: 'reviveTick', vol: 0.6 + 0.6 * Math.min(1, now / need) });
    // Back to zero short of the goal is a broken pick-up; at the goal it's the pick-up itself.
    else if (now === 0 && prev > 0 && prev < need - 0.1) out.push({ id: 'reviveLost' });
    state.t[i] = now;
  });
  return out;
}

/** The Ebb's drag: once, as the pull starts. `state.on` is updated in place. */
export function ebbCue(state: { on: boolean }, pulling: boolean): Cue | null {
  const fire = pulling && !state.on;
  state.on = pulling;
  return fire ? { id: 'ebbPull' } : null;
}

/** The "you're targeted" sting: once, when Anvilfall starts winding up on you. `state.on` is updated in place. */
export function targetCue(state: { on: boolean }, onMe: boolean): Cue | null {
  const fire = onMe && !state.on;
  state.on = onMe;
  return fire ? { id: 'targeted' } : null;
}

/**
 * Sounds that must never be lost to a full mix: boss warnings, the moments that need a reaction,
 * and party news. When every voice is busy, one of these takes the voice of the oldest ordinary sound.
 */
export const PRIORITY: ReadonlySet<SoundId> = new Set<SoundId>([
  ...Object.values(CAST_SOUNDS).flatMap((s) => (s.start ? [s.start] : [])),
  'castWarn', 'targeted', 'interrupt', 'bossSpawn', 'phase', 'enrage', 'burnoutWarn', 'burnout',
  'ebbPull', 'selfDown', 'allyDown', 'roleDown', 'revivesSpent', 'reviveStart', 'namedSpawn',
  ...Object.values(PHASE_STING).flat(),
]);

/**
 * While a PRIORITY sound plays, every ordinary sound drops to `gain` (about -6 dB) and the music to `music`
 * (about -3 dB), for at most `max` seconds. tools/busycheck.ts measures what this buys on a phone.
 */
export const DUCK = { gain: 0.5, music: 0.7, max: 2.5, attack: 0.03, release: 0.25 };

/**
 * Minimum seconds between two plays of the same sound. Keeps a 40-enemy pile-up
 * from turning into a wall of noise (and keeps phones from running out of voices).
 */
export const THROTTLE: Partial<Record<SoundId, number>> = {
  hit: 0.045,
  reviveTick: 0.3,
  // Planted can blink off and on as a hero shuffles; one knock a second is plenty.
  planted: 1,
  // Kinbound: a healer keeps re-covering the party, so Covered and Bonded sound at most every 2 s each.
  covered: 2,
  bonded: 2,
  relayed: 2,
  slag: 0.2,
  crit: 0.06,
  kill: 0.05,
  swing: 0.07,
  mote: 0.09,
  slagLob: 0.09,
  brittle: 0.12,
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
