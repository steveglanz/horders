/**
 * Which sound each simulation event makes. Pure so it can be tested without a
 * browser: GameScene hands every event to `cueFor`, and the audio engine plays
 * whatever comes back.
 */
import { ARENA, BRIM, CREEPING_RIME, IRONLOAD, isPunchR, KILN_TURN, LAYOUT, MILL, VARIETY, type SimEvent } from '../../sim/world';
import { TALENTS, type ClassId, type TalentId } from '../../sim/content/emberwright';
import { ENEMIES, EnemyKind } from '../../sim/content/enemies';
import type { SoundId } from './sounds';
import { SET_TUNING, type SetId } from '../../sim/content/sets';
import { ENCOUNTERS, type EncounterId } from '../../sim/content/dungeon';
import { DOOR_ROOM, roomAt, type HallsMap } from '../../sim/halls';
import type { RoomBedKind } from './music';

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
  /** The Brimming's cooling islands (empty outside it), and the one under this screen's hero (-1 for none). */
  islands?: readonly { t: number }[];
  myIsland?: number;
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
  /** The Wrackline: Hessa's Whirl version is live (World.whirl), so the Ebb swirls round the drain and sounds different. */
  whirl?: boolean;
  /** Co-op: each hero's party role ('tank', 'healer' or 'dps'), as on the party frames. */
  roles?: string[];
  /** Co-op pick-ups: each hero's seconds stood on so far, the seconds needed, and pick-ups left (World.revivesLeft). */
  revive?: { t: number[]; need: number; left: number };
  /**
   * Where this screen listens from: the hero's x and half the view's width (world units), for panning.
   * In the 3D view (perspective, framed differently from 2D) `screen` projects a floor point to screen px and
   * `screenHalf` is half the view's width in px: a sound then pans by where it shows on screen, not by world x.
   */
  /** Halls: each pack's encounter and state (World.halls.packs), so a wake can tell a shrine and "you pulled two". */
  hallsPacks?: readonly { enc: string; state: string }[];
  /** Halls: the party is catching its breath on the map (World.hallsResting). */
  hallsResting?: boolean;
  /** Halls: the bed of the room the hero stands in (roomBedFor), null in a corridor, the door alcove or off the map. */
  hallsBed?: RoomBedKind | null;
  /** The Glarewell's Lampeyes: each one's gaze (Enemy.aux, s toward LAMPEYE.full) and whether it can see this screen's hero. */
  gaze?: readonly { aux: number; sees: boolean }[];
  /** The 3D view's room life and foe lunges since the last tick (Hd2dView.sounds), for roomCues. Absent in 2D. */
  roomSounds?: readonly RoomSound[];
  /** The arena's radius (World.arenaR), so the 3D room's props can be placed for the edge sounds. */
  arenaR?: number;
  listen?: { x: number; half: number; y?: number; screen?: (x: number, y: number) => { x: number; y: number } | null; screenHalf?: number };
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
  colossus?: { x: number; y: number; side: number; /** Millstone: grinding now, and the floor point his front (the pour) faces. */ mill?: { x: number; y: number } };
  /** Game time (World.time), so a delayed cue (Cue.after) lands with its telegraph. */
  t?: number;
  /** The dungeon (World.dungeonId), where a shared hazard sounds different (the Foundry's vents steam). */
  dungeon?: string;
  /** Phase 14 X2: this run's named foe's affix (World.namedPlan), so its death can sound like it. */
  namedAffix?: string;
  /** Today's Heat for this run (World.heat), '' or unset for none. */
  heat?: string;
  /** The Kiln's channel layout: this screen's hero stands in lava (inLavaNow), so it sizzles. */
  inLava?: boolean;
  /** Y3 Creeping Rime: this screen's hero stands in the rime (inRimeNow), so frost crackles underfoot. */
  inRime?: boolean;
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
  // Oskel's Die Cut version: half the floor is stamped after a 2.4 s fuse; it lands as a slam of r DIECUT_R.
  dieCut: { start: 'dieCutWarn' }, // Die Cut
  punchLine: { start: 'punchLineWarn' }, // Punch Line (Y3): three rows of punches march out from Oskel; each lands as a slam of r PUNCH.r + PUNCH.grow * n
  // Grandmother Slag's Brimming version: phase 2's pit fills and cooling islands rise in place of the Pour.
  brimming: { start: 'brimWarn' }, // The Brimming
  // Old Vorhulm's Banked Coals version (phase 3, in place of Ember Spill): three coals to smother before he eats them.
  bankedCoals: { start: 'bankWarn' }, // Banked Coals
  hammerSweep: { done: 'sweep' }, // Hammer Sweep
  // Phase 11 variety foes: the Ember Spitter's lob and the Ashbuck's charge (each wind-up is the dodge warning).
  emberLob: { start: 'spitLob' }, // Ember Lob
  charge: { start: 'chargeWindup' }, // Charge
  shieldBash: { start: 'bashWarn' }, // Phase 16 U2: the Ashwall's Shield Bash (each wind-up is the dodge warning)
  // Phase 16 U2: the Ballast (the Foundry). Anchor Slam's wind-up is the step-out warning; dropping and weighing anchor
  // are its two castDone moments (BALLAST.plantDelay / unplant), heard as a chain running out and a chain hauled in.
  anchorSlam: { start: 'anchorWarn' }, // Anchor Slam
  // Phase 16 U2: the Lampeye (the Glarewell). Its gaze climbs in steps (gazeCues); full, Searing Look's cast start is the last warning.
  searingLook: { start: 'searingWarn' }, // Searing Look
  // Phase 16 U2: the Dimhorn (the Coldmarrow). Dark Call's cast start is the warning; a call that lands is heard as the
  // pack arriving (waveShape reinforce land), and one silenced in a coal's light ends on castDone 'darkCallLost'.
  darkCall: { start: 'dimhornCall' }, // Dark Call
  darkCallLost: { done: 'dimhornSilenced' }, // Silenced
  // Phase 16 U2: the Conchblower (the Wrackline). Conch Call's cast start is the interrupt warning; a blast that lands
  // fires castDone 'conchBlown' (the Ebb comes sooner), so the cast's own castDone is silent.
  conchCall: { start: 'conchWarn' }, // Conch Call
  conchBlown: { done: 'conchSwell' }, // The Ebb Comes Sooner
  anchor: { done: 'anchorDrop' }, // Drops Anchor
  unanchor: { done: 'anchorWeigh' }, // Weighs Anchor
  // The Kiln Mother's Kiln Draw variant: a 2.2 s inhale that pulls heroes in, then the fire circle around her lands.
  kilnDraw: { start: 'kilnDraw', done: 'ringClose' }, // Kiln Draw
  inhale: { start: 'inhaleWarn' }, // Old Vorhulm's Inhale (Y3): the castStart is the warning, so the inhale event's warn stage is silent
  turningFire: { start: 'turnFireWarn' }, // Turning Fire (Y3): each cone's landing is a slam the size of KILN_TURN.reach
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
  tithe: { start: 'titheWarn' }, // The Regent's Tithe (Y3): the gold circle appears (TITHE.fuse 4 s); its landing is the tithe event
  millstone: { start: 'millWarn' }, // Millstone (Y3): its end is the millstone event's start, so no castDone
  // The Colossus's Plate Shift version: his plate slides round to face a hero (the same 'wheel' event marks them).
  plateShift: { start: 'plateShiftWarn', done: 'plateLock' }, // Plate Shift
  // The Furnace Regent's court version: come before the throne in 2.5 s, or be struck (it lands with a slam r SUMMONS.radius).
  summons: { start: 'summonsWarn', done: 'summonsFall' }, // Summons
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
  millT?: number;
  colFacing?: number;
}

/** CueContext.colossus for this tick: set only while the Cinder Colossus lives and his plate still holds (phases 1-2). */
export function colossusCue<E extends { kind: string; x: number; y: number; alive: boolean }>(w: ColossusView<E>): CueContext['colossus'] {
  const e = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
  if (!e || !e.alive || e.kind !== 'colossus' || w.bossPhase >= 3) return undefined;
  const side = w.colossusSide(e, w.player.x, w.player.y);
  if (!((w.millT ?? 0) > 0)) return { x: e.x, y: e.y, side };
  // Halfway out along the slag's reach in front of him.
  const f = w.colFacing ?? 0, d = MILL.range / 2;
  return { x: e.x, y: e.y, side, mill: { x: e.x + Math.cos(f) * d, y: e.y + Math.sin(f) * d } };
}

/** Millstone's grind while he turns, panned to where his front faces (CueContext.colossus.mill). Throttled to MILL.tick. */
export function millCue(c: Pick<CueContext, 'colossus' | 'listen'>): Cue | null {
  const m = c.colossus?.mill;
  if (!m) return null;
  const o = offsetAt(c.listen, m.x, m.y);
  return { id: 'millGrind', jitter: 0.05, pan: o === null ? undefined : o * PAN_MAX };
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
  // A pincer or ring comes from all round you, so its call stays centred (only the reinforcements' flank pans).
  if (ev.type === 'waveShape' && ev.stage === 'start') return undefined;
  const x = (ev as { x?: unknown }).x;
  if (typeof x !== 'number') return undefined;
  const o = offsetAt(c.listen, x, (ev as { y?: unknown }).y);
  if (o === null) return undefined;
  const p = o * PAN_MAX;
  return Math.abs(p) < 0.02 ? undefined : p;
}

/** How far across the view a floor point is from the hero, -1 (left edge) to 1 (right edge); null with no listener. */
function offsetAt(l: CueContext['listen'], x: number, y: unknown): number | null {
  if (!l || !(l.half > 0)) return null;
  return Math.max(-1, Math.min(1, screenOffset(l, x, y) ?? (x - l.x) / l.half));
}

/** 3D view: how far across the screen a floor point shows from the hero, in half-widths; null when it can't be placed (then world x is used). */
function screenOffset(l: NonNullable<CueContext['listen']>, x: number, y: unknown): number | null {
  if (!l.screen || !(l.screenHalf && l.screenHalf > 0) || typeof y !== 'number' || typeof l.y !== 'number') return null;
  const at = l.screen(x, y), me = l.screen(l.x, l.y);
  return at && me ? (at.x - me.x) / l.screenHalf : null;
}

/**
 * What the 3D view's room did that can be heard (client/hd2d/renderer.ts): a drip landing on a wet room's floor, a
 * forge chain at the end of its sway, or a foe's lunge starting (`melee` when its touch hit, not a shot or boss move).
 * World units.
 */
export interface RoomSound { kind: 'drip' | 'chain' | 'lunge'; x: number; y: number; melee?: boolean; rank?: string }

/**
 * Room life: the 3D rooms' drips and chains move all the time (Steve: "something", not busy), so only one now and
 * then is heard, quiet, from where it shows on screen: a drip every `drip` s at most and a chain every `chain` s
 * (each picked between the two numbers), never in a boss fight. Lunges are the foe attack animations: a melee one
 * that landed gets a soft rush-and-thud from that foe, louder for bigger foes (shots and boss moves keep their own cues).
 */
export const ROOM_LIFE = { drip: [1.6, 4] as const, chain: [6, 13] as const, vol: 0.5, pan: 0.7, lunge: { normal: 0.45, elite: 0.7, rare: 0.8, boss: 0.9 } as Record<string, number> };

export function roomCues(state: { drip: number; chain: number }, list: readonly RoomSound[] | undefined, c: Pick<CueContext, 't' | 'boss' | 'listen'>, rnd: () => number): Cue[] {
  const out: Cue[] = [];
  const t = c.t;
  if (!list || !list.length || t === undefined) return out;
  // A new run restarts the clock.
  if (state.drip - t > 10) state.drip = 0;
  if (state.chain - t > 20) state.chain = 0;
  const pan = (x: number, y: number) => (offsetAt(c.listen, x, y) ?? 0) * ROOM_LIFE.pan;
  for (const r of list) {
    if (r.kind === 'lunge') {
      if (r.melee) out.push({ id: 'lungeHit', vol: ROOM_LIFE.lunge[r.rank ?? 'normal'] ?? ROOM_LIFE.lunge.normal, jitter: 0.12, pan: pan(r.x, r.y) });
      continue;
    }
    if (c.boss) continue;
    const [lo, hi] = ROOM_LIFE[r.kind];
    const key = r.kind;
    if (t < state[key]) continue;
    state[key] = t + lo + rnd() * (hi - lo);
    out.push({ id: r.kind === 'drip' ? 'roomDrip' : 'roomChain', vol: ROOM_LIFE.vol, jitter: 0.15, pan: pan(r.x, r.y) });
  }
  return out;
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
      // Phase 16 U2: a hit the Ashwall's shield cut (its front, or a foe sheltered behind it) glances off instead.
      if (ev.glance) return { id: 'glance', jitter: 0.1 };
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
    case 'namedSpawn': return { id: AFFIX_SPAWN[ev.affix] ?? 'namedSpawn' };
    case 'namedKill': return { id: c.namedAffix === 'Brood' ? 'namedKillBrood' : 'namedKill' };
    case 'bossEnrage': return { id: 'enrage' };
    case 'phase': return { id: (c.boss === 'worldShadow' && c.worldBoss && SHADOW_STING[c.worldBoss]) || phaseSting(c.boss, ev.phase), vol: ev.phase >= 3 ? 1.15 : 1 };
    case 'explode':
    case 'strike': return { id: 'explode', jitter: 0.12 };
    // Ironload lands as a slam the size of IRONLOAD.radius in the Hammerdeep: its own crushing weight.
    case 'slam':
      if (c.dungeon === 'hammerdeep' && ev.r === IRONLOAD.radius) return { id: 'ironload' };
      // Die Cut's half-floor cone is the only slam the size of the whole arena twice over.
      if (c.dungeon === 'pressworks' && ev.r === DIECUT_R) return { id: 'dieCut' };
      // Punch Line's nth punch out has radius PUNCH.r + PUNCH.grow * n (55 to 85); Rivets and the Downstroke are 60.
      if (c.dungeon === 'pressworks' && isPunchR(ev.r)) return { id: 'punchHit', jitter: 0.04 };
      // Turning Fire's cones are the only Kiln telegraphs as long as KILN_TURN.reach (Kiln Draw's ring is KILN_DRAW.radius).
      if (c.dungeon === 'kiln' && ev.r === KILN_TURN.reach) return { id: 'turnCone' };
      return { id: 'slam' };
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
      if (ev.id === 'twinVents' && ev.name === ROLLING_VENTS) return { id: 'rollVentWarn' };
      // The Brimming's Churn hurts no one: a quiet stir of the pit, not a warning (so not in CAST_SOUNDS, which are all priority).
      if (ev.id === 'churn') return { id: 'churn', jitter: 0.06 };
      return { id: ev.id === 'ebb' && c.outsurge ? 'outsurgeWarn' : ev.id === 'ebb' && c.whirl ? 'whirlWarn' : CAST_SOUNDS[ev.id]?.start ?? 'castWarn' };
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
      if (ev.id === 'wheel' || ev.id === 'millstone') return null;
      if (ev.id === 'churn') return null;
      // A Dark Call that lands is heard as the pack arriving (reinforceLand), a Conch Call as its swell (conchBlown), not a cast click.
      if (ev.id === 'darkCall' || ev.id === 'conchCall') return null;
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
    case 'arenaEvent': {
      // Phase 14 X3/X7: a warning as it starts, then a landing that sounds like this dungeon.
      const set = ARENA_EVENT_SOUNDS[ev.id];
      if (!set) return null;
      if (ev.stage === 'warn') return { id: set.warn };
      const land = ARENA_LAND[`${ev.id}.${c.dungeon ?? ''}`] ?? set.land;
      return land ? { id: land } : null;
    }
    // Phase 15 Y1: placeholder until sound's Y7 cues.
    case 'waveShape': {
      // Phase 15 Y1: a pincer or ring calls as the fight starts; reinforcements warn from their flank (pan follows x), then land.
      const id = ev.stage === 'start' ? WAVE_SOUNDS[ev.id]?.start : ev.stage === 'warn' ? WAVE_SOUNDS[ev.id]?.warn : WAVE_SOUNDS[ev.id]?.land;
      return id ? { id } : null;
    }
    // Phase 15 Y10: placeholder until sound's cue.
    // Phase 15 Y10: one groan for any stirred fight; its reaction (event, wave, named, elite) sounds by its own cue.
    case 'stir': return { id: 'dungeonStir' };
    case 'charge': return { id: 'chargeDash', jitter: 0.04 };
    case 'tideTurn': return { id: 'tideTurn' };
    // Y3 Sealed Vents: a building hiss as the steam is about to move, a burst as it opens at the new vent.
    case 'ventShift': return { id: ev.stage === 'warn' ? 'steamMoveWarn' : 'steamMoveOpen' };
    // Y3 Carried Light: the shadows swing as she carries the light; it pans toward her (panFor reads ev.x).
    case 'lightMove': return { id: 'lightSwing' };
    // Y3 the Homeward Hammer: the throw spins toward its target (panned); the landing rings and the hammer starts home (priority: the return line is the one to dodge).
    // Y3 Rolling Vents: each next vent steps the count up; the last one rings to say the roll ends.
    case 'ventRoll': return { id: ev.left > 0 ? 'ventRollNext' : 'ventRollLast' };
    // Phase 16 U1: the echo marks a borrowed move; the move's own cast cue (the same tick) still says what to do.
    case 'echo': return { id: 'echoSting' };
    case 'tithe': return { id: ev.ok ? 'titheShared' : 'titheMissed' };
    case 'millstone': return { id: ev.stage === 'start' ? 'millStart' : 'millEnd' };
    case 'inhale': return ev.stage === 'warn' ? null : { id: ev.stage === 'draw' ? 'inhaleDraw' : 'inhaleEnd' };
    // Y3 the Overflow: warn (gather on her), rise (it burns anyone far out), ebb (spread again).
    case 'overflow': return { id: ev.stage === 'warn' ? 'overflowWarn' : ev.stage === 'rise' ? 'overflowRise' : 'overflowEbb' };
    case 'homeward': return { id: ev.stage === 'out' ? 'homeOut' : 'homeBack' };
    // Y3 Creeping Rime: silent until sound adds its cue.
    // Y3 Creeping Rime: the frost rises under Nhevra (once, as phase 2 starts); it pans toward her via ev.x.
    case 'rimeRise': return { id: 'rimeRise' };
    case 'emberDrift': return { id: 'emberDriftFall' };
    // Only this screen's hero hears their own coal brighten; an ally's pickup is a quiet clink.
    case 'emberPick': return mine(ev.hero) ? { id: 'emberPickUp' } : { id: 'emberTaken', vol: 0.5, jitter: 0.1 };
    case 'ventFlare': return { id: ventSounds(c.dungeon).warn };
    case 'layout': {
      const id = ev.id === 'vents' ? ventSounds(c.dungeon).sting : ev.id === 'pillars' ? PILLAR_STING[c.dungeon ?? ''] ?? 'layoutPillars' : LAYOUT_STING[ev.id];
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
    case 'encounterStart': return ev.index === 0 && c.heat && !FLOOR_HEATS.has(c.heat) ? { id: HEAT_STING[c.dungeon ?? ''] ?? 'heatSting' } : null;
    case 'encounterClear': return null; // the run's end and the talent draft carry their own sounds
    // Halls: a pack wakes (a shrine has no foes, and its clear carries the sound); a second pack awake at once is "you pulled two".
    case 'hallsWake': {
      const pk = c.hallsPacks?.[ev.pack];
      if (!pk || !ENCOUNTERS[pk.enc as EncounterId]?.spawns.length) return null;
      return { id: c.hallsPacks!.filter((q) => q.state === 'awake').length >= 2 ? 'packWakeExtra' : 'packWake' };
    }
    // Halls: through the boss door, which closes behind the party (the boss's own sting follows when it steps in).
    case 'hallsDoor': return { id: 'doorSeal' };
    // Halls H2b room lock: the doorway grates glow (warn, with the wake), drop 1.0 s later, and sink once the room clears.
    case 'hallsGrateWarn': return { id: 'grateWarn' };
    case 'hallsGrateDrop': return { id: 'grateDrop' };
    case 'hallsGrateLift': return null; // landCueFor: just after the clear's level-up, which would cover it
    // Everyone walked out before the drop: the pack goes back to sleep with no sound, like sneaking past one.
    case 'hallsLeash': return null;
    case 'end': return { id: ev.victory ? 'victory' : 'defeat' };
  }
  return null;
}

/** Today's Heat sting in each solo dungeon (Phase 14 X1): the Kiln's figure over that dungeon's own texture. */
export const HEAT_STING: Record<string, SoundId> = {
  kiln: 'heatSting', foundry: 'heatFoundry', glarewell: 'heatGlarewell', coldmarrow: 'heatColdmarrow', wrackline: 'heatWrackline',
};

/** Phase 14 X3: each arena event's warning (as it starts; must-hear) and landing, by ARENA_EVENT_POOLS. High Water's
 *  warn and land come together, and the Ebb's own call (ebbPull) is its real warning, so it plays one ordinary swell. */
export const ARENA_EVENT_SOUNDS: Record<string, { warn: SoundId; land: SoundId | null }> = {
  caveIn: { warn: 'caveInWarn', land: 'caveInLand' },
  ventSurge: { warn: 'ventSurgeWarn', land: 'ventSurgeLand' },
  coldSnap: { warn: 'coldSnapWarn', land: 'coldSnapLand' },
  highWater: { warn: 'highWaterWarn', land: null },
};
/** A landing that sounds like the dungeon it lands in: the Kiln keeps the base set (fire and rock). */
export const ARENA_LAND: Record<string, SoundId> = {
  'caveIn.foundry': 'caveInWet', 'caveIn.coldmarrow': 'caveInIce',
  'ventSurge.foundry': 'surgeSteam', 'ventSurge.glarewell': 'surgeLens',
  // X3 part 2, group-dungeon trash: dead-forge iron, ash and pumice, sheet steel.
  'caveIn.hammerdeep': 'caveInDeep', 'caveIn.ashvents': 'caveInAsh', 'caveIn.pressworks': 'caveInPress',
  'ventSurge.hammerdeep': 'surgeDeep', 'ventSurge.ashvents': 'surgeAsh', 'ventSurge.pressworks': 'surgePress',
  // Phase 15 Y2, raid trash: slag, coal and bone, copper ingots, old brick (as their stones and vents look, #464).
  'caveIn.crucible': 'caveInSlag', 'caveIn.hoard': 'caveInBone', 'caveIn.smeltery': 'caveInIngot', 'caveIn.flue': 'caveInBrick',
  'ventSurge.crucible': 'surgeSlag', 'ventSurge.hoard': 'surgeHoard', 'ventSurge.smeltery': 'surgeTuyere', 'ventSurge.flue': 'surgeFlue',
};
/** Arena-event warnings that must be heard: the ones you dodge or answer (not High Water's swell). */
export const ARENA_WARN_PRIORITY: readonly SoundId[] = ['caveInWarn', 'ventSurgeWarn', 'coldSnapWarn'];
/** Phase 15 Y1: wave shapes. A reinforce wave's 'start' is silent: its warning comes 2 s before they arrive. */
export const WAVE_SOUNDS: Record<string, { start?: SoundId; warn?: SoundId; land?: SoundId }> = {
  pincer: { start: 'wavePincer' },
  ring: { start: 'waveRing' },
  reinforce: { warn: 'reinforceWarn', land: 'reinforceLand' },
};
/** Phase 14 X2: a marked named foe's arrival call, by affix (a foe with none keeps namedSpawn). */
export const AFFIX_SPAWN: Record<string, SoundId> = { Brood: 'namedBrood', Smoldering: 'namedSmolder' };

/** Heats that change the floor, so every fight's layout event already plays a sting. */
export const FLOOR_HEATS: ReadonlySet<string> = new Set(['stoneFloor', 'ventFloor']);

/** Each Kiln arena layout's sting as the fight starts. The plain 'open' room needs none. */
export const LAYOUT_STING: Partial<Record<Extract<SimEvent, { type: 'layout' }>['id'], SoundId>> = {
  pillars: 'layoutPillars', channel: 'layoutChannel', vents: 'layoutVents',
};

/** A stones layout's sting, where the dungeon has its own stones (client/GameScene.ts); others keep layoutPillars. */
export const PILLAR_STING: Record<string, SoundId> = {
  coldmarrow: 'layoutIce',
  // Phase 13 E2/E3, matched to GameScene's RAID_STONE: slag, coal and bone, copper ingots, old brick, pumice.
  crucible: 'stoneSlag', hoard: 'stoneBone', smeltery: 'stoneIngot', flue: 'stoneBrick', ashvents: 'stonePumice',
};

/** Each dungeon's vents sound like what visuals drew: fire in the Kiln, steam in the Foundry, glass lenses in the Glarewell. */
export const VENT_SOUNDS: Record<string, { warn: SoundId; land: SoundId; sting: SoundId }> = {
  kiln: { warn: 'kilnVentWarn', land: 'lavaFlare', sting: 'layoutVents' },
  foundry: { warn: 'steamVentWarn', land: 'steamBurst', sting: 'layoutSteam' },
  glarewell: { warn: 'lensVentWarn', land: 'lensFlare', sting: 'layoutLens' },
  // Phase 12 W2: the Hammerdeep's forge vents.
  hammerdeep: { warn: 'forgeVentWarn', land: 'forgeFlare', sting: 'layoutForge' },
  // Phase 12 W2: the Pressworks' steam-press vents.
  pressworks: { warn: 'pressVentWarn', land: 'pressBurst', sting: 'layoutPress' },
  // Phase 13 E2: Ysmeret's ash-and-ember vents in the Ashvents' trash fights.
  ashvents: { warn: 'ashVentWarn', land: 'ashBurst', sting: 'layoutAsh' },
  // Phase 13 E4: the raids' trash-fight vents: slag, ember breath, a tuyere's blast and the flue's draught.
  crucible: { warn: 'slagVentWarn', land: 'slagBurst', sting: 'layoutSlag' },
  hoard: { warn: 'hoardVentWarn', land: 'hoardBurst', sting: 'layoutHoard' },
  smeltery: { warn: 'smeltVentWarn', land: 'smeltBurst', sting: 'layoutSmelt' },
  flue: { warn: 'flueVentWarn', land: 'flueBurst', sting: 'layoutFlue' },
};
export const ventSounds = (dungeon?: string) => VENT_SOUNDS[dungeon ?? ''] ?? VENT_SOUNDS.kiln;

/** The second half of a telegraphed hit: the sound of it landing, played later in game time (Cue.after). */
/** Engineering's room theme ids (HallsRoom.theme, H2d) and the bed each plays: Ash store, Bellows hall, Slag channel,
 *  Cooling yard, Kiln shrine. */
export const ROOM_THEME_BED: Record<string, RoomBedKind> = {
  ash: 'ashStore', bellows: 'bellowsHall', slag: 'slagChannel', cooling: 'coolingYard', shrine: 'kilnShrine',
  // The Drowned Foundry (H3a; its shrine side room is 'shrine' too).
  boiler: 'boilerRoom', cistern: 'cistern', pump: 'pumpHall', anchor: 'anchorStore',
  // The Glarewell (H3b).
  lens: 'lensGallery', orrery: 'starVault', colonnade: 'shadeColonnade', mirror: 'mirrorHall',
  // The Coldmarrow (H3c).
  hearthless: 'deadHearth', rime: 'rimeHall', drift: 'snowdriftCave', crypt: 'coldCrypt',
};
const THEME_BY_INDEX = ['ash', 'bellows', 'slag', 'cooling', 'shrine'];

/**
 * Halls: the quiet bed of the room at (x, y), from its theme (HallsRoom.theme). Until H2d rolls themes in the sim, a room
 * takes one from its index, as visuals does. A corridor and the boss door alcove are quiet (null), so walking a corridor
 * sounds like leaving one place for another.
 */
export function roomBedFor(m: HallsMap | null | undefined, x: number, y: number): RoomBedKind | null {
  if (!m) return null;
  const i = roomAt(m, x, y);
  if (i < 0 || i === DOOR_ROOM) return null;
  const theme = (m.rooms[i] as { theme?: string }).theme ?? THEME_BY_INDEX[i % THEME_BY_INDEX.length];
  return ROOM_THEME_BED[theme] ?? null;
}

/** Halls: seconds after hallsGrateLift that its sound plays (the clear's levelUp is 1.24 s long and covered it at 0 s). */
export const GRATE_LIFT_AFTER = 0.9;

export function landCueFor(ev: SimEvent, dungeon?: string): Cue | null {
  if (ev.type === 'spitLob') return { id: 'spitLand', after: VARIETY.lobLand, jitter: 0.04 };
  if (ev.type === 'ventFlare') return { id: ventSounds(dungeon).land, after: LAYOUT.ventCast, jitter: 0.04 };
  // Halls: the grates sink as the room clears, heard once the clear's level-up chord (1.2 s) has mostly rung out.
  if (ev.type === 'hallsGrateLift') return { id: 'grateLift', after: GRATE_LIFT_AFTER };
  return null;
}

/** The Kiln's channel layout: is this hero standing in a lava strip (World.lava, as World.layoutClock burns it)? */
/** Y3 Creeping Rime: is this screen's (living) hero inside the rime? The same test the sim uses to chill. */
export function inRimeNow(w: { rimeOn: boolean; rimeX: number; rimeY: number; player: { x: number; y: number; hp: number } }): boolean {
  const p = w.player;
  if (!w.rimeOn || p.hp <= 0) return false;
  const dx = p.x - w.rimeX, dy = p.y - w.rimeY;
  return dx * dx + dy * dy <= CREEPING_RIME.r ** 2;
}

export function inLavaNow(w: { lava: readonly { x1: number; y1: number; x2: number; y2: number; w: number; heat?: number }[]; player: { x: number; y: number; hp: number } }): boolean {
  const p = w.player;
  if (p.hp <= 0) return false;
  return w.lava.some((c) => {
    if ((c.heat ?? 1) < 1) return false; // Halls: cooled crust doesn't burn
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
 * Old Vorhulm's Banked Coals (the Hoard, `bank` version): each coal lands as a `soak` event, and in the same tick the sim
 * says what happened to it with an emberTaken (smothered) or emberEaten (he ate it) at the same spot. A missed coal
 * blasts no one, so the generic soakFail would lie; the ember cue already says it. This drops those soak events.
 */
export function withoutBankedSoaks<E extends SimEvent>(evs: readonly E[]): E[] {
  // The soak event names its telegraph's owner now (#432): -4 is a Banked Coal. The same-spot match stays for older events.
  // -5 is the Furnace Regent's Tithe (Y3): its own tithe event, in the same tick, says shared or missed.
  evs = evs.filter((ev) => ev.type !== 'soak' || (ev.owner !== -4 && ev.owner !== -5));
  const at = new Set<string>();
  for (const ev of evs) if (ev.type === 'emberTaken' || ev.type === 'emberEaten') at.add(`${ev.x},${ev.y}`);
  if (!at.size) return evs as E[];
  return evs.filter((ev) => ev.type !== 'soak' || !at.has(`${ev.x},${ev.y}`));
}

/**
 * Arena-edge ambience: the props round each rim (GameScene's EDGE_SETS) give off a quiet sound now and then, from the
 * side, between boss fights. Two per dungeon, matched to its big and small prop.
 */
export const EDGE_SOUNDS: Record<string, readonly [SoundId, SoundId]> = {
  kiln: ['edgeFurnace', 'edgeBrazier'],
  foundry: ['edgeBoiler', 'edgeValve'],
  hammerdeep: ['edgeAnvil', 'edgeLantern'],
  ashvents: ['edgeFumarole', 'edgeCairn'],
  wrackline: ['edgeHull', 'edgePost'],
  pressworks: ['edgePress', 'edgePlate'],
  hoard: ['edgeCoins', 'edgeBones'],
  smeltery: ['edgeCart', 'edgeIngot'],
  flue: ['edgeFlue', 'edgeBanner'],
  glarewell: ['edgeLens', 'edgeShards'],
  coldmarrow: ['edgeRib', 'edgeFrost'],
  crucible: ['edgeLadle', 'edgeSlagPot'],
};
/** How often an edge prop sounds (s of game time, picked between min and max), how loud, and how far to the side. */
export const EDGE = { min: 7, max: 15, vol: 0.45, pan: 0.7 };

/** client/hd2d/renderer.ts ROOM_R: the 3D room is built at this radius, then scaled so it fits World.arenaR. */
export const HD2D_ROOM_R = 7.45;
/**
 * The 3D rooms (client/hd2d/renderer.ts buildRoom): where each edge sound's prop stands, so in the 3D view the sound
 * comes from the prop you can see. Each spot is [angle round the room (0 the front, PI the back wall), radius in room
 * units]. Only the dungeons with their own room (renderer.ts OWN_ROOMS); the rest share the Flue's room, whose chimneys aren't their props,
 * and a sound with no spots (or the 2D view) keeps the random side.
 */
export const EDGE_SPOTS: Partial<Record<string, readonly [readonly (readonly [number, number])[], readonly (readonly [number, number])[]]>> = {
  // Three beehive kilns (radius 9.2 + r * 0.25 for r 2.3 and 1.65), and four braziers.
  kiln: [[[Math.PI, 9.775], [Math.PI - 0.8, 9.6125], [Math.PI + 0.8, 9.6125]], [[Math.PI - 0.5, 8.62], [Math.PI + 0.5, 8.62], [Math.PI - 1.1, 8.62], [Math.PI + 1.1, 8.62]]],
  // Three brass boilers; the valve's pipe run spans the back wall, so it keeps the random side.
  foundry: [[[Math.PI, 9.4], [Math.PI - 0.8, 9.4], [Math.PI + 0.8, 9.4]], []],
  // Three great anvils; the lanterns are the sconces all round, so they keep the random side.
  hammerdeep: [[[Math.PI, 9.5], [Math.PI - 0.8, 9.5], [Math.PI + 0.8, 9.5]], []],
  // Three chimneys; the banners hang between sconces, so they keep the random side.
  flue: [[[Math.PI, 9.7], [Math.PI - 0.78, 9.7], [Math.PI + 0.78, 9.7]], []],
  // The great lens, high at the back wall centre (its floor point: it's straight ahead either way). The shard clusters
  // stand at seeded random spots round the open wall, so they keep the random side.
  glarewell: [[[Math.PI, 9.6]], []],
  // Three fumaroles; the cairns are at the same seeded random spots as the Glarewell's shards, so they keep the random side.
  ashvents: [[[Math.PI, 9.5], [Math.PI - 0.8, 9.5], [Math.PI + 0.8, 9.5]], []],
  // The giant ladle at the back wall centre (z -9.3), and the two slag pots either side.
  crucible: [[[Math.PI, 9.3]], [[Math.PI - 0.8, 9.5], [Math.PI + 0.8, 9.5]]],
  // The three gold mounds (radius 9.4 + r * 0.25 for r 3.4 and 2.0); the bone heaps are at seeded random spots.
  hoard: [[[Math.PI, 10.25], [Math.PI - 0.85, 9.9], [Math.PI + 0.85, 9.9]], []],
  // The three frosted arches; the frost (ice shards) is at seeded random spots.
  coldmarrow: [[[Math.PI, 9.6], [Math.PI - 0.8, 9.6], [Math.PI + 0.8, 9.6]], []],
  // The three press frames; the plate stacks are at seeded random spots.
  pressworks: [[[Math.PI, 9.5], [Math.PI - 0.8, 9.5], [Math.PI + 0.8, 9.5]], []],
  // The four ore carts on the rail; the ingots are at seeded random spots.
  smeltery: [[[Math.PI - 0.55, 9.9], [Math.PI - 0.95, 9.9], [Math.PI + 0.6, 9.9], [Math.PI + 1.0, 9.9]], []],
  // The wrecked hull at the back wall centre (z -9.6), and the six mooring posts.
  wrackline: [[[Math.PI, 9.6]], [0.7, 1.0, 1.3].flatMap((d) => [[Math.PI - d, 8.9], [Math.PI + d, 8.9]] as const)],
};
/** Where a 3D room spot is on the floor, in world units (the room is centred on the arena and scaled to arenaR). */
export const edgeSpotAt = ([a, r]: readonly [number, number], arenaR: number) => ({ x: Math.sin(a) * r * arenaR / HD2D_ROOM_R, y: Math.cos(a) * r * arenaR / HD2D_ROOM_R });

/**
 * The next edge-prop sound, if one is due. `t` is game time; a boss on the field (or no dungeon) keeps it quiet and
 * pushes the next one back. `rnd` returns [0, 1) (Math.random in the engine; a seeded one in tests).
 */
export function edgeCue(state: { next: number }, dungeon: string | undefined, t: number | undefined, boss: boolean, rnd: () => number, room?: { listen: CueContext['listen']; arenaR: number }): Cue | null {
  const set = dungeon ? EDGE_SOUNDS[dungeon] : undefined;
  if (!set || t === undefined) return null;
  const gap = () => EDGE.min + rnd() * (EDGE.max - EDGE.min);
  // A new run restarts the clock.
  if (!(state.next > 0) || state.next - t > EDGE.max) state.next = t + gap();
  if (t < state.next) return null;
  state.next = t + gap();
  if (boss) return null;
  const side = rnd() < 0.5 ? -1 : 1;
  const which = rnd() < 0.5 ? 0 : 1;
  const cue: Cue = { id: set[which], vol: EDGE.vol, jitter: 0.08, pan: side * EDGE.pan * (0.6 + 0.4 * rnd()) };
  // The 3D view: from one of that prop's spots, panned by where it shows on screen.
  const spots = room?.listen?.screen && room.arenaR > 0 && dungeon ? EDGE_SPOTS[dungeon]?.[which] : undefined;
  if (spots && spots.length > 0) {
    const at = edgeSpotAt(spots[Math.min(spots.length - 1, Math.floor(rnd() * spots.length))], room!.arenaR);
    const o = offsetAt(room!.listen, at.x, at.y);
    if (o !== null) cue.pan = o * EDGE.pan;
  }
  return cue;
}

/**
 * The Brimming (the Crucible, Grandmother Slag's `brim` version): each cooling island hisses as it starts to sink
 * (its last BRIM.warn s), loudest for the one this screen's hero stands on, and knocks softly when a new one rises
 * in its place (the sim replaces a sunk island in its slot, so its time jumps back up). `mine` is the index of the
 * island under this screen's hero, or -1.
 */
export function islandCues(state: { t: number[] }, islands: readonly { t: number }[], mine: number): Cue[] {
  const out: Cue[] = [];
  if (!islands.length) {
    state.t = [];
    return out;
  }
  islands.forEach((s, k) => {
    const was = state.t[k];
    if (was !== undefined) {
      if (s.t > was + 1) out.push({ id: 'islandRise', vol: 0.6 });
      else if (was > BRIM.warn && s.t <= BRIM.warn) out.push({ id: 'islandSink', vol: k === mine ? 1.1 : 0.55 });
    }
  });
  state.t = islands.map((s) => s.t);
  return out;
}

/** World.onIsland's slack past BRIM.radius: PLAYER_RADIUS (12, not exported) * 0.5. tests/audio.test.ts checks the sim. */
export const ISLAND_SLACK = 6;
/** Which of the Brimming's islands this screen's hero stands on (-1 for none), by the sim's own World.onIsland rule. */
export function myIsland(w: { islands: readonly { x: number; y: number; t: number }[]; player: { x: number; y: number } }): number {
  return w.islands.findIndex((s) => s.t > 0 && (w.player.x - s.x) ** 2 + (w.player.y - s.y) ** 2 <= (BRIM.radius + ISLAND_SLACK) ** 2);
}

/**
 * The Flue (raid 4): Spent ends. A hero who just passed a Decree can't take it back for a while (Player.spentT);
 * a small tick when this screen's hero may take one again. Silent going in: the pass itself already sounded.
 */
/** The gaze steps that sound (1..5); at LAMPEYE.full (6) Searing Look starts and its cast warning takes over. */
export const GAZE_STEPS = ['gaze1', 'gaze2', 'gaze3', 'gaze4', 'gaze5'] as const;
/** How far (s) a gaze must fall below a step before that step can sound again, so a hero edging in and out of a pillar's cover doesn't retrigger it each tick. */
export const GAZE_DROP = 0.5;
/**
 * The Lampeye (Phase 16 U2): while one can see this screen's hero, each whole second its gaze gains plays the next step
 * of a rising hum, so the climb is the tell to step behind a pillar. Only the highest new step plays when several eyes
 * climb at once; one that can't see you climbs in silence (it can't sear you). A gaze that falls back (a pillar in the
 * way, or the look done) steps down silently, GAZE_DROP past a step, so climbing again is heard again.
 */
export function gazeCues(state: { lv: number[] }, eyes: readonly { aux: number; sees: boolean }[] | undefined): Cue | null {
  if (!eyes || !eyes.length) {
    state.lv = [];
    return null;
  }
  let best = 0;
  eyes.forEach((e, k) => {
    const lv = Math.min(GAZE_STEPS.length, Math.floor(e.aux + 1e-6)), was = state.lv[k] ?? 0;
    if (lv > was) {
      if (e.sees) best = Math.max(best, lv);
      state.lv[k] = lv;
    } else if (e.aux < was - GAZE_DROP) state.lv[k] = Math.min(GAZE_STEPS.length, Math.floor(e.aux + GAZE_DROP + 1e-6));
  });
  state.lv.length = eyes.length;
  return best > 0 ? { id: GAZE_STEPS[best - 1] } : null;
}

/**
 * Halls: a soft cue as Catch breath starts (World.hallsResting turns on); silent when it ends (a pack woke, which has its
 * own cue). Design (25 Nov): only once the first pack is cleared, so a fresh delve's quiet walk in doesn't open with it.
 */
export function restCue(state: { on: boolean }, resting: boolean, packs?: readonly { state: string }[]): Cue | null {
  const was = state.on;
  state.on = resting && !!packs?.some((pk) => pk.state === 'cleared');
  resting = state.on;
  return resting && !was ? { id: 'catchBreath' } : null;
}

export function spentCue(state: { on: boolean }, spent: boolean): Cue | null {
  const was = state.on;
  state.on = spent;
  return !spent && was ? { id: 'spentEnd' } : null;
}

/** The Ebb's drag: once, as the pull starts. `state.on` is updated in place. */
export function ebbCue(state: { on: boolean }, pulling: boolean, outsurge = false, whirl = false): Cue | null {
  const fire = pulling && !state.on;
  state.on = pulling;
  return fire ? { id: outsurge ? 'outsurgePull' : whirl ? 'whirlPull' : 'ebbPull' } : null;
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
/** Die Cut's cone radius in sim/world.ts (ARENA * 2): its landing slam carries it. */
export const DIECUT_R = ARENA * 2;
/** The cast name sim/world.ts gives Twin Vents in Ysmeret's `wander` version (tests/audio.test.ts checks it). */
export const WANDERING_VENTS = 'Wandering Vents';
/** Ysmeret's Rolling Vents (Phase 15 Y3) reuse the twinVents cast too; its name is the only tell. */
export const ROLLING_VENTS = 'Rolling Vents';

export const PRIORITY: ReadonlySet<SoundId> = new Set<SoundId>([
  ...Object.values(CAST_SOUNDS).flatMap((s) => (s.start ? [s.start] : [])),
  'castWarn', 'wanderVentWarn', 'rollVentWarn', 'ventRollNext', 'ventRollLast', ...ARENA_WARN_PRIORITY, 'reinforceWarn', ...Object.values(AFFIX_SPAWN), 'targeted', 'interrupt', 'bossSpawn', 'phase', 'enrage', 'burnoutWarn', 'burnout',
  'ebbPull', 'outsurgeWarn', 'outsurgePull', 'whirlWarn', 'whirlPull', 'homeBack', 'inhaleDraw', 'titheMissed', 'gaze1', 'gaze2', 'gaze3', 'gaze4', 'gaze5', 'packWake', 'packWakeExtra', 'overflowWarn', 'overflowRise', 'tideTurn', 'steamMoveWarn', 'swallowed', 'pressed', 'pressedClear', 'wheelOnMe', 'decreeOnMe', 'selfDown', 'allyDown', 'roleDown', 'revivesSpent', 'reviveStart', 'namedSpawn',
  ...Object.values(PHASE_STING).flat(),
  ...Object.values(SHADOW_STING),
]);

/**
 * While a PRIORITY sound plays, every ordinary sound drops to `gain` (about -6 dB) and the music to `music`
 * (about -3 dB), for at most `max` seconds. tools/busycheck.ts measures what this buys on a phone.
 */
export const DUCK = { gain: 0.5, music: 0.7, max: 2.5, attack: 0.03, release: 0.25 };
/**
 * A few warnings duck the ordinary sounds deeper than DUCK.gain. "You're down" lands on the same tick as the boss hit
 * that downed you (busycheck WHO=selfDown: that landing is 50-70% of what is under it), so lifting it alone stopped
 * paying (+2 dB bought about +1.3). A deeper duck clears the hit instead.
 */
export const DEEP_DUCK: Partial<Record<SoundId, number>> = { selfDown: 0.25 };

/**
 * Minimum seconds between two plays of the same sound. Keeps a 40-enemy pile-up
 * from turning into a wall of noise (and keeps phones from running out of voices).
 */
export const THROTTLE: Partial<Record<SoundId, number>> = {
  hit: 0.045,
  // Foe lunges (3D): a pack hitting at once is one rush, not a stack.
  lungeHit: 0.18,
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
  // Punch Line: each step of the march lands on all three rows in one tick; one thunk per step (0.25 s apart).
  punchHit: 0.1,
  rimeCrackle: 0.35,
  glance: 0.12, // a blade flurry on the shield: a few thunks a second, not every hit
  millGrind: 0.45, // one per MILL.tick (0.5 s); a frame's slack under it so none is skipped
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
