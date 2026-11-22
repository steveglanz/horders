/**
 * Which sound each simulation event makes. Pure so it can be tested without a
 * browser: GameScene hands every event to `cueFor`, and the audio engine plays
 * whatever comes back.
 */
import { IRONLOAD, LAYOUT, VARIETY, type SimEvent } from '../../sim/world';
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
  /** Stereo position, -1 (left) to 1 (right). Ordinary sounds only: warnings stay centred. */
  pan?: number;
  /** Play this many seconds of game time later (a telegraph landing), so a pause holds it too. */
  after?: number;
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
  /** The Wrackline: Hessa's Outsurge version is live (World.outsurge), so the Ebb runs outward and sounds different. */
  outsurge?: boolean;
  /** Co-op: each hero's party role ('tank', 'healer' or 'dps'), as on the party frames. */
  roles?: string[];
  /** Co-op pick-ups: each hero's seconds stood on so far, the seconds needed, and pick-ups left (World.revivesLeft). */
  revive?: { t: number[]; need: number; left: number };
  /** Where this screen listens from: the hero's x and half the view's width (world units), for panning. */
  listen?: { x: number; half: number };
  /** Verb-set states on this screen's hero, for the set-proc cues (setCues). Each is false when the hero lacks the pieces. */
  sets?: SetFlags;
  /** The Hoard: seconds left before this screen's hero is digested while swallowed (Player.swallowT), 0 when not inside. */
  swallowLeft?: number;
  /** The Flue: this screen's hero is Spent (Player.spentT > 0) and can't take a Decree back yet. */
  spent?: boolean;
  /** The Pressworks: this screen's hero is Pressed (Player.pressedT > 0) and must sit out the next Downstroke. */
  pressed?: boolean;
  /** Slagbinder: this screen's hero's stance ('anvil' tanks behind thick plate, 'bellows' deals damage). */
  stance?: string;
  /** The living world boss's name (World.worldBoss), so its shadow gets its own sting. */
  worldBoss?: string;
  /**
   * The Smeltery, phases 1-2: where the Cinder Colossus stands and the damage side this screen's hero hits him
   * from (World.colossusSide: 0.5 plated front, 1.5 open back, 1 the flanks). Unset once Meltdown cracks the plate.
   */
  colossus?: { x: number; y: number; side: number };
  /** Game time (World.time), so a delayed cue (Cue.after) lands with its telegraph. */
  t?: number;
  /** The dungeon (World.dungeonId), where a shared hazard sounds different (the Foundry's vents steam). */
  dungeon?: string;
  /** Today's Heat for this run (World.heat), '' or unset for none. */
  heat?: string;
  /** The Kiln's channel layout: this screen's hero stands in lava (inLavaNow), so it sizzles. */
  inLava?: boolean;
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
  /** Crawsplitter (3): Freed, +damage after the Craw breaks (on the breaker, and on the freed hero, who may wear none of it). */
  freed: boolean;
  /** Platewalker (2): behind the Cinder Colossus (World.behindColossus), where the set's bonuses apply. */
  behind: boolean;
  /** Handover (3): Spent after passing a Decree, which is when the set's +damage applies (Player.spentT). */
  handover: boolean;
}

/** Reads the set flags off a hero (World.player) and the pieces it wears (World.setCount). */
export function setFlagsOf(
  p: { hp: number; planted?: boolean; surge?: boolean; kbT?: number; warmth?: number; coverT?: number; bondT?: number; relayT?: number; freedT?: number; spentT?: number },
  count: (id: SetId) => number,
  /** The Smeltery: this hero stands in the Colossus's back arc (World.behindColossus). */
  behind = false,
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
    freed: up && (p.freedT ?? 0) > 0,
    behind: up && count('platewalker') >= 2 && behind,
    handover: up && count('handover') >= 3 && (p.spentT ?? 0) > 0,
  };
}

const SET_SOUND: Record<keyof SetFlags, SoundId> = { planted: 'planted', surge: 'surgeReady', sharp: 'sharpen', warmFull: 'warmthFull', covered: 'covered', bonded: 'bonded', relayed: 'relayed', freed: 'freed', behind: 'behindPlate', handover: 'handedOver' };

/**
 * The set procs have no events of their own (they are states on the hero), so this sounds each one
 * as it turns on. `was` is last tick's flags, updated in place; a dead hero's flags read as off.
 */
export function setCues(was: Partial<SetFlags>, now: SetFlags): Cue[] {
  const out: Cue[] = [];
  for (const k of Object.keys(SET_SOUND) as (keyof SetFlags)[]) {
    if (now[k] && !was[k]) out.push({ id: SET_SOUND[k], vol: k === 'planted' ? 0.8 : k === 'surge' || k === 'behind' ? 0.7 : 1 });
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
  // The Hoard (raid 2): Old Vorhulm. Gorge can be interrupted (the interrupt cue plays then); Last Meal is the enrage.
  coalGorge: { start: 'gorgeWarn', done: 'gorge' }, // Gorge
  lastMeal: { start: 'lastMealWarn', done: 'lastMeal' }, // Last Meal
  // The Hammerdeep: Ondrel of the Hammerdeep (docs/design/group-dungeons.md).
  anvilfall: { start: 'anvilWarn', done: 'anvilfall' }, // Anvilfall
  choir: { done: 'choir' }, // Choir of Iron
  // Ondrel's Ironload version: chains haul the weight up, then it is marked on a hero; it lands 5 s later as an r-110 slam.
  ironload: { start: 'ironloadWarn', done: 'ironloadMark' }, // Ironload
  hammerSweep: { done: 'sweep' }, // Hammer Sweep
  // Phase 11 variety foes: the Ember Spitter's lob and the Ashbuck's charge (each wind-up is the dodge warning).
  emberLob: { start: 'spitLob' }, // Ember Lob
  charge: { start: 'chargeWindup' }, // Charge
  // The Kiln Mother's Kiln Draw variant: a 2.2 s inhale that pulls heroes in, then the fire circle around her lands.
  kilnDraw: { start: 'kilnDraw', done: 'ringClose' }, // Kiln Draw
  // The Lensmother's Glintfall variant: light gathers, then shards fall on every standing pillar (one sound for all).
  glintfall: { start: 'glintWarn', done: 'glintfall' }, // Glintfall
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
  // The Smeltery (raid 3): the Cinder Colossus. Wheel's end is carried by the wheel event and the Sweep it starts.
  slagSweep: { start: 'sweepWarn', done: 'slagSweep' }, // Slag Sweep
  wheel: { start: 'wheelWarn' }, // Wheel
  pourOut: { start: 'pourOutWarn', done: 'pourOut' }, // Pour Out
  // The Flue (raid 4): the Furnace Regent. The Decrees sound from their own events (decree, decreePassed, decreeBurst).
  lastWord: { start: 'lastWordWarn', done: 'lastWord' }, // Last Word
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
  // The Hoard: [phase 2 Swallow, phase 3 Ember Feast].
  vorhulm: ['phaseSwallow', 'phaseFeast'],
  // The Smeltery: [phase 2 Wheel, phase 3 Meltdown].
  colossus: ['phaseWheel', 'phaseMeltdown'],
  // The Flue: [phase 2 Edict, phase 3 Abdication].
  regent: ['phaseEdict', 'phaseAbdication'],
};

/** The sting for a boss reaching `phase` (2 or 3). */
/**
 * Each world boss's shadow sting, keyed by the server's boss names (supabase/migrations/0007). 'Old Ashmaw' is
 * the name before migration 0007 renames it, so a live server that hasn't run it still gets Vorhulm's sting.
 * A name not listed falls back to PHASE_STING.worldShadow.
 */
export const SHADOW_STING: Record<string, SoundId> = {
  'Grandmother Slag': 'shadowSlag',
  'The Cinder Colossus': 'shadowColossus',
  'Old Vorhulm': 'shadowCoal',
  'Old Ashmaw': 'shadowCoal',
  'The Furnace Regent': 'shadowRegent',
};

/** Platewalker: whether this screen's hero stands behind the living Cinder Colossus now (any phase: Meltdown doesn't move his back). */
export function behindColossusNow<E extends { kind: string; alive: boolean }>(w: { bossIndex: number; enemies: readonly E[]; player: { x: number; y: number }; behindColossus(e: E, x: number, y: number): boolean }): boolean {
  const e = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
  return !!e && e.alive && e.kind === 'colossus' && w.behindColossus(e, w.player.x, w.player.y);
}

/** The bits of World that colossusCue reads. */
interface ColossusView<E extends { kind: string; x: number; y: number; alive: boolean }> {
  bossIndex: number;
  bossPhase: number;
  enemies: readonly E[];
  player: { x: number; y: number };
  colossusSide(e: E, x: number, y: number): number;
}

/** CueContext.colossus for this tick: set only while the Cinder Colossus lives and his plate still holds (phases 1-2). */
export function colossusCue<E extends { kind: string; x: number; y: number; alive: boolean }>(w: ColossusView<E>): CueContext['colossus'] {
  const e = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
  if (!e || !e.alive || e.kind !== 'colossus' || w.bossPhase >= 3) return undefined;
  return { x: e.x, y: e.y, side: w.colossusSide(e, w.player.x, w.player.y) };
}

export function phaseSting(boss: string | undefined, phase: number): SoundId {
  const s = boss ? PHASE_STING[boss] : undefined;
  if (!s) return 'phase';
  return Array.isArray(s) ? s[Math.max(0, Math.min(s.length - 1, phase - 2))] : s;
}

/** How far a sound at the edge of the view pans (0.5: clearly to one side, never one ear only). */
export const PAN_MAX = 0.5;

/** Stereo position for an event that has a place, relative to the listening hero (undefined: centred). */
export function panFor(ev: SimEvent, c: CueContext): number | undefined {
  const x = (ev as { x?: unknown }).x;
  if (!c.listen || typeof x !== 'number' || !(c.listen.half > 0)) return undefined;
  const p = Math.max(-1, Math.min(1, (x - c.listen.x) / c.listen.half)) * PAN_MAX;
  return Math.abs(p) < 0.02 ? undefined : p;
}

export function cueFor(ev: SimEvent, c: CueContext): Cue | null {
  const mine = (hero?: number) => hero === undefined || hero === c.acting;
  switch (ev.type) {
    case 'hit': {
      // The Smeltery: your own hits on the Colossus say which side you are on (the sim puts a hit at its target's spot).
      const col = c.colossus;
      if (col && col.side !== 1 && mine(ev.hero) && Math.abs(ev.x - col.x) < 1 && Math.abs(ev.y - col.y) < 1) {
        return col.side < 1 ? { id: 'plateHit', jitter: 0.08 } : { id: 'backHit', jitter: 0.1, vol: ev.crit ? 1.2 : 1 };
      }
      return ev.crit ? { id: 'crit', jitter: 0.08 } : { id: 'hit', jitter: 0.15 };
    }
    case 'kill': {
      // The Hoard: breaking the Craw frees the swallowed hero.
      if (ev.kind === 'craw') return { id: 'crawBreak' };
      const rank = ENEMIES[ev.kind]?.rank;
      if (rank === 'boss' || rank === 'rare') return { id: 'bigKill' };
      if (rank === 'elite') return { id: 'explode', vol: 0.8, jitter: 0.1 };
      return { id: 'kill', jitter: 0.2 };
    }
    case 'playerHurt':
      if (!mine(ev.hero)) return null;
      // An Anvil Slagbinder's hits land on plate (SLAG_KIT.anvilArmor), so they clank.
      if (c.cls === 'slagbinder' && c.stance === 'anvil') return ev.amount >= 20 ? { id: 'hurtBigAnvil' } : { id: 'hurtAnvil', jitter: 0.1 };
      return ev.amount >= 20 ? { id: 'hurtBig' } : { id: 'hurt', jitter: 0.1 };
    case 'levelUp': return mine(ev.hero) ? { id: 'levelUp' } : { id: 'levelUp', vol: 0.4 };
    case 'eliteSpawn': return { id: 'eliteSpawn' };
    case 'bossSpawn': return { id: 'bossSpawn' };
    case 'rareSpawn': return { id: 'rareSpawn' };
    case 'namedSpawn': return { id: 'namedSpawn' };
    case 'namedKill': return { id: 'namedKill' };
    case 'bossEnrage': return { id: 'enrage' };
    case 'phase': return { id: (c.boss === 'worldShadow' && c.worldBoss && SHADOW_STING[c.worldBoss]) || phaseSting(c.boss, ev.phase), vol: ev.phase >= 3 ? 1.15 : 1 };
    case 'explode':
    case 'strike': return { id: 'explode', jitter: 0.12 };
    // Ironload lands as a slam the size of IRONLOAD.radius in the Hammerdeep: its own crushing weight.
    case 'slam': return c.dungeon === 'hammerdeep' && ev.r === IRONLOAD.radius ? { id: 'ironload' } : { id: 'slam' };
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
    // Hessa's Outsurge keeps the Ebb's cast id, so its own wind-up keys on World.outsurge.
    case 'castStart':
      // Ysmeret's Wandering Vents reuse the twinVents cast; only its name says the circles will move.
      if (ev.id === 'twinVents' && ev.name === WANDERING_VENTS) return { id: 'wanderVentWarn' };
      return { id: ev.id === 'ebb' && c.outsurge ? 'outsurgeWarn' : CAST_SOUNDS[ev.id]?.start ?? 'castWarn' };
    case 'interrupt': return { id: 'interrupt' };
    // The Hoard: Swallow is the fight's main alarm for everyone (break the Craw); getting out or digesting is news for all.
    case 'swallowed': return { id: 'swallowed' };
    case 'spatOut': return mine(ev.hero) ? { id: 'spatOut' } : { id: 'spatOut', vol: 0.7 };
    case 'digested': return mine(ev.hero) ? { id: 'digested' } : { id: 'digested', vol: 0.8 };
    case 'emberTaken': return { id: 'emberTaken', jitter: 0.1 };
    // Each ember he eats feeds him more, so the crunch grows a little with the count.
    case 'emberEaten': return { id: 'emberEaten', vol: Math.min(1.2, 0.8 + 0.04 * ev.fed), jitter: 0.08 };
    case 'slagGrip': return { id: 'slag', vol: 0.55 + 0.1 * ev.stacks, jitter: 0.06 };
    case 'cleanse': return { id: 'cleanse' };
    case 'castDone':
      if (ev.id === 'wheel') return null;
      return { id: CAST_SOUNDS[ev.id]?.done ?? 'castDone' };
    // The Smeltery: Wheel turns him on one hero. That hero must move; the rest hear the Sweep's wind-up.
    case 'wheel': return mine(ev.hero) ? { id: 'wheelOnMe' } : null;
    // The Flue: a Decree on you is the alarm (pass it on in 8 s); on an ally, only its stamp.
    case 'decree': return mine(ev.hero) ? { id: 'decreeOnMe' } : { id: 'decreeLands', vol: 0.8 };
    case 'decreePassed':
      // Handed to you: the same alarm as a landing. Handed on by you, or faded on the pass: the handoff. Others: a quiet handoff.
      if (!ev.done && ev.hero === c.acting) return { id: 'decreeOnMe' };
      return ev.from === c.acting ? { id: 'decreePass' } : { id: 'decreePass', vol: 0.5 };
    case 'decreeBurst': return { id: 'decreeBurst' };
    case 'officePulse': return { id: 'officePulse', vol: Math.min(1.3, 0.7 + 0.03 * ev.n), jitter: 0.04 };
    case 'meltPulse': return { id: 'meltPulse', vol: Math.min(1.3, 0.7 + 0.03 * ev.n), jitter: 0.04 };
    case 'heal': return { id: 'heal', jitter: 0.05 };
    case 'ward': return { id: 'ward' };
    case 'fork': return { id: 'fork' };
    case 'gateChosen': return { id: 'gate' };
    case 'riftOpen': return { id: 'riftOpen' };
    case 'riftClosed': return { id: 'riftClosed' };
    case 'riftSpawn': return { id: 'riftSpit', jitter: 0.06 };
    // The cast start plays the lob's cough; the circle catches fire where it lands (landCueFor).
    case 'spitLob': return null;
    case 'charge': return { id: 'chargeDash', jitter: 0.04 };
    case 'tideTurn': return { id: 'tideTurn' };
    case 'emberDrift': return { id: 'emberDriftFall' };
    // Only this screen's hero hears their own coal brighten; an ally's pickup is a quiet clink.
    case 'emberPick': return mine(ev.hero) ? { id: 'emberPickUp' } : { id: 'emberTaken', vol: 0.5, jitter: 0.1 };
    case 'ventFlare': return { id: ventSounds(c.dungeon).warn };
    case 'layout': {
      const id = ev.id === 'vents' ? ventSounds(c.dungeon).sting : ev.id === 'pillars' && c.dungeon === 'coldmarrow' ? 'layoutIce' : LAYOUT_STING[ev.id];
      return id ? { id } : null;
    }
    case 'gather': return { id: 'gather' };
    case 'soak': return { id: ev.ok ? 'soakOk' : 'soakFail' };
    case 'drop':
      return { id: ev.rarity === 'mythic' ? 'dropMythic' : ev.rarity === 'epic' ? 'dropEpic' : ev.rarity === 'rare' ? 'dropRare' : 'drop', jitter: 0.03 };
    case 'loot': return mine(ev.hero) && ev.equipped ? { id: 'equip' } : null;
    case 'quest': return { id: 'quest' };
    case 'dodge': return { id: 'dodged' };
    case 'burnout': return { id: ev.warn ? 'burnoutWarn' : 'burnout' };
    // Today's Heat: a sting with the first fight's banner. The floor Heats already sound their layout sting then.
    case 'encounterStart': return ev.index === 0 && c.heat && !FLOOR_HEATS.has(c.heat) ? { id: 'heatSting' } : null;
    case 'encounterClear': return null; // the run's end and the talent draft carry their own sounds
    case 'end': return { id: ev.victory ? 'victory' : 'defeat' };
  }
  return null;
}

/** Heats that change the floor, so every fight's layout event already plays a sting. */
export const FLOOR_HEATS: ReadonlySet<string> = new Set(['stoneFloor', 'ventFloor']);

/** Each Kiln arena layout's sting as the fight starts. The plain 'open' room needs none. */
export const LAYOUT_STING: Partial<Record<Extract<SimEvent, { type: 'layout' }>['id'], SoundId>> = {
  pillars: 'layoutPillars', channel: 'layoutChannel', vents: 'layoutVents',
};

/** Each dungeon's vents sound like what visuals drew: fire in the Kiln, steam in the Foundry, glass lenses in the Glarewell. */
export const VENT_SOUNDS: Record<string, { warn: SoundId; land: SoundId; sting: SoundId }> = {
  kiln: { warn: 'kilnVentWarn', land: 'lavaFlare', sting: 'layoutVents' },
  foundry: { warn: 'steamVentWarn', land: 'steamBurst', sting: 'layoutSteam' },
  glarewell: { warn: 'lensVentWarn', land: 'lensFlare', sting: 'layoutLens' },
  // Phase 12 W2: the Hammerdeep's forge vents borrow the Kiln's fire until sound gives them their own.
  hammerdeep: { warn: 'forgeVentWarn', land: 'forgeFlare', sting: 'layoutForge' },
};
export const ventSounds = (dungeon?: string) => VENT_SOUNDS[dungeon ?? ''] ?? VENT_SOUNDS.kiln;

/** The second half of a telegraphed hit: the sound of it landing, played later in game time (Cue.after). */
export function landCueFor(ev: SimEvent, dungeon?: string): Cue | null {
  if (ev.type === 'spitLob') return { id: 'spitLand', after: VARIETY.lobLand, jitter: 0.04 };
  if (ev.type === 'ventFlare') return { id: ventSounds(dungeon).land, after: LAYOUT.ventCast, jitter: 0.04 };
  return null;
}

/** The Kiln's channel layout: is this hero standing in a lava strip (World.lava, as World.layoutClock burns it)? */
export function inLavaNow(w: { lava: readonly { x1: number; y1: number; x2: number; y2: number; w: number }[]; player: { x: number; y: number; hp: number } }): boolean {
  const p = w.player;
  if (p.hp <= 0) return false;
  return w.lava.some((c) => {
    const dx = c.x2 - c.x1, dy = c.y2 - c.y1;
    const len2 = dx * dx + dy * dy;
    const u = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - c.x1) * dx + (p.y - c.y1) * dy) / len2)) : 0;
    const ex = c.x1 + u * dx - p.x, ey = c.y1 + u * dy - p.y;
    return ex * ex + ey * ey <= (c.w / 2) ** 2;
  });
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

/**
 * The Pressworks "take turns" rule: a clamp when this screen's hero becomes Pressed, and a release when
 * it wears off, so a phone player hears when they may take the next Downstroke. `state.on` is updated in place.
 */
export function pressedCue(state: { on: boolean }, pressed: boolean): Cue | null {
  const was = state.on;
  state.on = pressed;
  return pressed && !was ? { id: 'pressed' } : !pressed && was ? { id: 'pressedClear' } : null;
}

/**
 * The Flue (raid 4): Spent ends. A hero who just passed a Decree can't take it back for a while (Player.spentT);
 * a small tick when this screen's hero may take one again. Silent going in: the pass itself already sounded.
 */
export function spentCue(state: { on: boolean }, spent: boolean): Cue | null {
  const was = state.on;
  state.on = spent;
  return !spent && was ? { id: 'spentEnd' } : null;
}

/** The Ebb's drag: once, as the pull starts. `state.on` is updated in place. */
export function ebbCue(state: { on: boolean }, pulling: boolean, outsurge = false): Cue | null {
  const fire = pulling && !state.on;
  state.on = pulling;
  return fire ? { id: outsurge ? 'outsurgePull' : 'ebbPull' } : null;
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
/** The cast name sim/world.ts gives Twin Vents in Ysmeret's `wander` version (tests/audio.test.ts checks it). */
export const WANDERING_VENTS = 'Wandering Vents';

export const PRIORITY: ReadonlySet<SoundId> = new Set<SoundId>([
  ...Object.values(CAST_SOUNDS).flatMap((s) => (s.start ? [s.start] : [])),
  'castWarn', 'wanderVentWarn', 'targeted', 'interrupt', 'bossSpawn', 'phase', 'enrage', 'burnoutWarn', 'burnout',
  'ebbPull', 'outsurgeWarn', 'outsurgePull', 'tideTurn', 'swallowed', 'pressed', 'pressedClear', 'wheelOnMe', 'decreeOnMe', 'selfDown', 'allyDown', 'roleDown', 'revivesSpent', 'reviveStart', 'namedSpawn',
  ...Object.values(PHASE_STING).flat(),
  ...Object.values(SHADOW_STING),
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
  // Several slams can land on one tick (Glintfall hits up to four pillars at once): one boom, not a stack.
  slam: 0.06,
  // The Hoard: six embers spill at once and a party can sweep them up together.
  emberTaken: 0.1,
  emberEaten: 0.15,
  // The Smeltery: four heroes beating on one boss; the side cue only needs to be heard now and then.
  plateHit: 0.12,
  backHit: 0.09,
  reviveTick: 0.3,
  // The Kiln: a Rift spits every 3 s and two can be open; lava sizzles while you stand in it.
  riftSpit: 1,
  lavaSizzle: 0.35,
  // Planted can blink off and on as a hero shuffles; one knock a second is plenty.
  planted: 1,
  // Kinbound: a healer keeps re-covering the party, so Covered and Bonded sound at most every 2 s each.
  covered: 2,
  bonded: 2,
  relayed: 2,
  // Platewalker: a Sweep or Wheel knocks a hero out of his back about every 7 s (bots, tools/busycheck.ts); one cue in 3 s is enough.
  behindPlate: 3,
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

/**
 * The belly's low-pass on the whole mix, in Hz: wide open, and shut while swallowed. 900 Hz still leaves
 * a phone speaker (which plays little under 350 Hz) something to hear.
 */
export const BELLY = { open: 20000, shut: 900 };

/** Sounds that skip the belly's muffle: the heartbeat is your own, inside with you. */
export const DRY: ReadonlySet<SoundId> = new Set<SoundId>(['heartbeat']);

/** What bellyCues remembers between ticks. */
export interface BellyState {
  on: boolean;
  /** Audio time of the next heartbeat. */
  next: number;
}

/** Heartbeat spacing inside the belly: 0.85 s with the full 8 s left, quickening to 0.45 s as digestion nears. */
export function beatGap(left: number): number {
  return 0.45 + 0.4 * Math.max(0, Math.min(1, left / 8));
}

/**
 * The Hoard: while this screen's hero is swallowed, a heartbeat that quickens as the time runs out
 * (the engine also muffles the rest of the mix). `now` is audio time in seconds; `state` is updated in place.
 */
export function bellyCues(state: BellyState, left: number, now: number): Cue[] {
  if (!(left > 0)) {
    state.on = false;
    return [];
  }
  if (!state.on) {
    state.on = true;
    state.next = now + 0.35; // let the gulp land first
    return [];
  }
  if (now < state.next) return [];
  state.next = now + beatGap(left);
  return [{ id: 'heartbeat', vol: 0.8 + 0.4 * (1 - Math.min(1, left / 8)) }];
}
