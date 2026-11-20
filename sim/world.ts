/**
 * The shared simulation. Pure TypeScript with no rendering or browser code, so
 * the same file can run in the player's browser (alpha) and on an
 * authoritative game server (co-op, beta).
 *
 * Determinism rules: fixed time step, every random number comes from `rng`,
 * no Date/Math.random/performance calls in here.
 */
import { Rng } from './rng';
import { ENEMIES, EnemyDef, EnemyKind } from './content/enemies';
import { ABILITIES, AbilityDef, Branch, CAPSTONE_RANKS, GCD, MAX_HEAT, TALENTS, TalentId, ClassId } from './content/emberwright';
import { CLASSES, ClassDef } from './content/classes';
import { Loadout, PassiveId, itemScore, loadoutFrom, rollDrop } from './hero';
import { Item, Rarity } from './content/items';
import { QUESTS, QuestId } from './content/quests';
import { ENCOUNTERS, EncounterId, GateKind, rollFork, rollRoute } from './content/dungeon';
import { OMEN_TUNING, OmenId, omensFor } from './content/omens';

export const TICK = 1 / 30;
export const MINI_BOSS_AT = 240; // seconds
export const BOSS_AT = 480; // seconds
export const SPAWN_RADIUS = 700;
export const RARE_AT = 150;
/** Radius of the dungeon arena; everything stays inside it. */
export const ARENA = 560;
/** Seconds between a cleared fight (after the draft) and the next one. */
export const INTRO_TIME = 2.5;
/** Seconds to pick a gate at a fork before the steady path is taken. */
export const CHOOSE_TIME = 10;
/** Gate size and spacing at a fork. */
export const GATE_RADIUS = 46;
export const RIFT_TIMES = [60, 200, 330];
const BOSS_ENRAGE_AFTER = 150;
/** Chance that a normal enemy drops an item. */
const TRASH_DROP = 1 / 800;
const PLAYER_RADIUS = 12;

const CAP = { enemies: 900, orbs: 256, gems: 900, zones: 128, telegraphs: 24, strikes: 64, lances: 16, drops: 24, veins: 6 };

export interface Input {
  /** Desired move direction; any length, normalised inside. */
  x: number;
  y: number;
  /** Ability button pressed this tick (0-3), if any. */
  cast?: number;
}

export interface Enemy {
  alive: boolean;
  kind: EnemyKind;
  def: EnemyDef;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  touchCd: number;
  orbitCd: number;
  burnDps: number;
  burnT: number;
  flash: number;
  abilityT: number;
  spawnedAt: number;
  /** Current cast ('' when not casting); shown on cast bars. */
  castId: string;
  castName: string;
  castT: number;
  castDur: number;
  interruptible: boolean;
  stunT: number;
  /** Spare per-enemy timers and counters for scripted abilities. */
  aux: number;
  aux2: number;
  /** Warded Omen: remaining shield, and whether it has been granted yet. */
  ward: number;
  warded: boolean;
}

export interface Orb {
  alive: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  target: number;
  dmg: number;
}

export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  value: number;
  pulled: boolean;
}

export interface Zone {
  alive: boolean;
  x: number;
  y: number;
  r: number;
  dps: number;
  life: number;
  maxLife: number;
  tickT: number;
}

export interface Telegraph {
  alive: boolean;
  shape: 'circle' | 'cone';
  x: number;
  y: number;
  r: number;
  angle: number;
  arc: number;
  t: number;
  dur: number;
  dmg: number;
  /** 'hit' damages whoever is inside; 'soak' punishes the raid if nobody stands in it. */
  kind: 'hit' | 'soak';
  /** Enemy whose cast created it; interrupting that enemy removes it. */
  owner: number;
}

export interface Drop {
  alive: boolean;
  x: number;
  y: number;
  item: Item | null;
}

export interface Vein {
  alive: boolean;
  x: number;
  y: number;
  progress: number;
}

export interface Quest {
  id: QuestId;
  progress: number;
  goal: number;
  done: boolean;
}

export interface Gate {
  kind: GateKind;
  encounter: EncounterId;
  x: number;
  y: number;
  r: number;
}

export interface Strike {
  alive: boolean;
  x: number;
  y: number;
  r: number;
  t: number;
  dmg: number;
}

export interface Lance {
  alive: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

export interface Player {
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  pendingLevels: number;
  volleyT: number;
  rainT: number;
  lanceT: number;
  orbitAngle: number;
  hurtFlash: number;
  facing: number;
  heat: number;
  /** Remaining cooldown per action-bar slot. */
  cds: number[];
  gcd: number;
  shieldT: number;
  /** Duskblade: swings so far, parry recharge, and a guaranteed crit. */
  swings: number;
  parryT: number;
  nextCrit: boolean;
}

export type SimEvent =
  | { type: 'hit'; x: number; y: number; amount: number; crit: boolean }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind }
  | { type: 'playerHurt'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'eliteSpawn' }
  | { type: 'bossSpawn' }
  | { type: 'bossEnrage' }
  | { type: 'explode'; x: number; y: number; r: number }
  | { type: 'strike'; x: number; y: number; r: number }
  | { type: 'slam'; x: number; y: number; r: number }
  | { type: 'chest'; x: number; y: number }
  | { type: 'revive' }
  | { type: 'ability'; slot: number; x: number; y: number; angle: number; r: number }
  | { type: 'blink'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'dash'; x1: number; y1: number; x2: number; y2: number; dodge: boolean }
  | { type: 'swing'; x: number; y: number; angle: number; r: number; arc: number; spin: boolean }
  | { type: 'parry'; x: number; y: number }
  | { type: 'castStart'; index: number; name: string }
  | { type: 'interrupt'; x: number; y: number; name: string }
  | { type: 'castDone'; x: number; y: number; name: string }
  | { type: 'heal'; x: number; y: number; amount: number }
  | { type: 'ward'; index: number; amount: number }
  | { type: 'fork'; gates: Gate[] }
  | { type: 'gateChosen'; kind: GateKind; id: EncounterId; timedOut: boolean }
  | { type: 'phase'; phase: number }
  | { type: 'rareSpawn' }
  | { type: 'riftOpen'; x: number; y: number }
  | { type: 'riftClosed'; x: number; y: number }
  | { type: 'gather'; x: number; y: number }
  | { type: 'soak'; ok: boolean; x: number; y: number }
  | { type: 'drop'; x: number; y: number; rarity: Rarity }
  | { type: 'loot'; item: Item; equipped: boolean; delta: number }
  | { type: 'quest'; index: number }
  | { type: 'encounterStart'; index: number; id: EncounterId }
  | { type: 'encounterClear'; index: number; id: EncounterId }
  | { type: 'end'; victory: boolean };

export type SimState = 'running' | 'draft' | 'ended';

export interface DraftOption {
  id: TalentId;
  nextRank: number;
}

export interface WorldOptions {
  seed: number;
  /** Stress test: hundreds of enemies from the start, player cannot die. */
  stress?: boolean;
  /** Developer option: the player takes no damage. */
  invulnerable?: boolean;
  /** Equipped gear brought into the run. */
  gear?: Item[];
  /** Permanent hero passives. */
  passives?: Partial<Record<PassiveId, number>>;
  /** Hero level, which sets the item level of drops. */
  heroLevel?: number;
  /** First free item id, so run drops never collide with the hero's bag. */
  nextItemId?: number;
  /** Which quests to offer (none by default in the dungeon). */
  quests?: QuestId[];
  /** Fixed encounter route; rolled from the seed when left out. */
  route?: EncounterId[];
  /** Difficulty tier, 1 and up. Higher tiers hit harder and drop better loot. */
  tier?: number;
  /** Which class the hero plays this run. */
  cls?: ClassId;
  /** Week number for the Omen rotation (the client passes it; the sim never reads the clock). */
  week?: number;
  /** Fixed Omens, overriding the weekly rotation (tests and tools). */
  omens?: OmenId[];
}

export interface RunSummary {
  victory: boolean;
  tier?: number;
  time: number;
  kills: number;
  level: number;
  damageDealt: number;
  talents: Partial<Record<TalentId, number>>;
  questsDone?: number;
  omens?: OmenId[];
  paths?: GateKind[];
}

function pool<T>(n: number, make: () => T): T[] {
  return Array.from({ length: n }, make);
}

const HASH_SIZE = 4096; // power of two
const CELL = 64;

export class World {
  readonly rng: Rng;
  readonly stress: boolean;
  readonly invulnerable: boolean;
  loadout: Loadout;
  readonly tier: number;
  readonly cls: ClassId;
  readonly classDef: ClassDef;
  readonly passives: Partial<Record<PassiveId, number>>;
  /** Gear currently worn (upgrades picked up mid-run replace pieces). */
  gear: Item[];
  /** Items picked up this run and the ids auto-equipped as upgrades. */
  runDrops: Item[] = [];
  runEquipped: string[] = [];
  nextItemId: number;
  readonly itemLevel: number;
  readonly luck: number;
  /** Tier modifiers active in every fight of this run. */
  readonly omens: OmenId[];
  private volatileT = 0;
  quests: Quest[] = [];
  rareSpawned = false;
  rareIndex = -1;
  riftsOpened = 0;
  bossPhase = 1;
  private brandT = 4;
  private nextVeinAt = 20;
  /** The dungeon: the route of fights, which one is next, and where we are in it. */
  route: EncounterId[] = [];
  encounter = 0;
  phase: 'intro' | 'fight' | 'cleared' | 'choose' = 'intro';
  /** Gates on offer while `phase` is 'choose'. */
  gates: Gate[] = [];
  /** Paths taken at each fork, for the summary. */
  paths: GateKind[] = [];
  /** The current fight was a named path: its loot bag is one rarity better. */
  private namedFight = false;
  phaseT = INTRO_TIME;
  eliteKilled = false;
  revived = false;
  state: SimState = 'running';
  time = 0;
  tick = 0;
  kills = 0;
  damageDealt = 0;
  victory = false;
  bossIndex = -1;
  eliteSpawned = false;
  bossSpawned = false;
  bossEnraged = false;
  nextSwarmAt = 90;

  player: Player;
  talents: Partial<Record<TalentId, number>> = {};
  choices: DraftOption[] = [];

  enemies: Enemy[];
  orbs: Orb[];
  gems: Gem[];
  zones: Zone[];
  telegraphs: Telegraph[];
  strikes: Strike[];
  lances: Lance[];
  drops: Drop[];
  veins: Vein[];
  events: SimEvent[] = [];
  aliveEnemies = 0;

  // Spatial hash over enemies, rebuilt every tick.
  private head = new Int32Array(HASH_SIZE);
  private next = new Int32Array(CAP.enemies);

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed);
    this.stress = !!opts.stress;
    this.invulnerable = !!opts.invulnerable || this.stress;
    this.tier = Math.max(1, Math.floor(opts.tier ?? 1));
    this.cls = opts.cls && CLASSES[opts.cls] ? opts.cls : 'emberwright';
    this.classDef = CLASSES[this.cls];
    this.passives = { ...(opts.passives ?? {}) };
    this.gear = [...(opts.gear ?? [])];
    this.loadout = loadoutFrom(this.passives, this.gear);
    this.nextItemId = opts.nextItemId ?? 1;
    this.itemLevel = Math.max(1, (opts.heroLevel ?? 1) + (this.tier - 1));
    this.omens = opts.omens ?? (this.stress ? [] : omensFor(this.tier, opts.week ?? 0));
    this.luck = (1 + 0.12 * (this.tier - 1)) * (1 + OMEN_TUNING.luckPerOmen * this.omens.length);
    const hp = this.classDef.baseHp + this.loadout.maxHpBonus;
    this.player = {
      x: 0, y: 0, px: 0, py: 0,
      hp, maxHp: hp,
      level: 1, xp: 0, xpToNext: xpFor(1), pendingLevels: 0,
      volleyT: 0.5, rainT: 4, lanceT: 2.5, orbitAngle: 0, hurtFlash: 0, facing: 0,
      heat: 0, cds: [0, 0, 0, 0], gcd: 0, shieldT: 0, swings: 0, parryT: 0, nextCrit: false,
    };
    this.enemies = pool(CAP.enemies, () => ({
      alive: false, kind: 'ashling' as EnemyKind, def: ENEMIES.ashling,
      x: 0, y: 0, px: 0, py: 0, hp: 0, maxHp: 0, touchCd: 0, orbitCd: 0,
      burnDps: 0, burnT: 0, flash: 0, abilityT: 0, spawnedAt: 0,
      castId: '', castName: '', castT: 0, castDur: 0, interruptible: false, stunT: 0, aux: 0, aux2: 0, ward: 0, warded: false,
    }));
    this.orbs = pool(CAP.orbs, () => ({ alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, target: -1, dmg: 0 }));
    this.gems = pool(CAP.gems, () => ({ alive: false, x: 0, y: 0, px: 0, py: 0, value: 0, pulled: false }));
    this.zones = pool(CAP.zones, () => ({ alive: false, x: 0, y: 0, r: 0, dps: 0, life: 0, maxLife: 0, tickT: 0 }));
    this.telegraphs = pool(CAP.telegraphs, () => ({
      alive: false, shape: 'circle' as const, x: 0, y: 0, r: 0, angle: 0, arc: 0, t: 0, dur: 0, dmg: 0, kind: 'hit' as const, owner: -1,
    }));
    this.drops = pool(CAP.drops, () => ({ alive: false, x: 0, y: 0, item: null }));
    this.veins = pool(CAP.veins, () => ({ alive: false, x: 0, y: 0, progress: 0 }));
    const ids = opts.quests ?? [];
    this.quests = ids.map((id) => ({ id, progress: 0, goal: QUESTS[id].goal, done: false }));
    this.route = opts.route ?? rollRoute((n) => this.rng.int(n));
    this.strikes = pool(CAP.strikes, () => ({ alive: false, x: 0, y: 0, r: 0, t: 0, dmg: 0 }));
    this.lances = pool(CAP.lances, () => ({ alive: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0 }));
  }

  // ---------------------------------------------------------------- talents

  rank(id: TalentId): number {
    return this.talents[id] ?? 0;
  }

  branchRanks(branch: Branch): number {
    let n = 0;
    for (const id of Object.keys(this.talents) as TalentId[]) {
      const def = TALENTS[id];
      if (def.branch === branch && !def.capstone) n += this.talents[id]!;
    }
    return n;
  }

  get dmgMult(): number {
    // Small growth per level keeps damage in step with the horde's health.
    return (1 + 0.1 * this.rank('stoke')) * (1 + 0.03 * (this.player.level - 1)) * this.loadout.dmgMult;
  }
  get volleyCooldown(): number {
    return (0.9 * Math.pow(0.86, this.rank('quickcast'))) / this.loadout.hasteMult;
  }
  get orbCount(): number {
    return 1 + this.rank('extraOrb');
  }
  get critChance(): number {
    return 0.05 + 0.12 * (this.rank('searingFocus') + this.rank('precision')) + this.loadout.critBonus;
  }
  get pickupRadius(): number {
    return 80 * (1 + 0.4 * (this.rank('magnetism') + this.rank('nimble'))) * this.loadout.pickupMult;
  }
  get moveSpeed(): number {
    return this.classDef.speed * (1 + 0.06 * this.rank('magnetism') + 0.07 * this.rank('nimble')) * this.loadout.speedMult;
  }
  get regen(): number {
    return 0.8 * this.rank('mend') + 1 * this.rank('secondWind');
  }
  get abilities(): AbilityDef[] {
    return this.classDef.abilities;
  }

  /** Resource cost of an action-bar slot after talents. */
  abilityCost(slot: number): number {
    if (this.cls === 'emberwright' && slot === 0) return ABILITIES[0].cost - 6 * this.rank('rollingInferno');
    return this.abilities[slot]?.cost ?? 0;
  }

  abilityCooldown(slot: number): number {
    const base = this.abilities[slot]?.cooldown ?? 0;
    if (this.cls === 'duskblade') {
      if (slot === 0) return base - 1 * this.rank('deepCuts');
      if (slot === 1) return base - 1.5 * this.rank('evasion');
      if (slot === 2) return base - 3 * this.rank('momentumFlow');
      return base;
    }
    if (slot === 1) return base - 1.5 * this.rank('flicker');
    if (slot === 2) return base - 3 * this.rank('heatSink');
    return base;
  }

  /** Whether the slot can be used right now (ignores whether a target exists). */
  canCast(slot: number): boolean {
    const p = this.player;
    const def = this.abilities[slot];
    if (!def || p.cds[slot] > 0) return false;
    if (!def.offGcd && p.gcd > 0) return false;
    return p.heat >= this.abilityCost(slot);
  }

  // ---------------------------------------------------------------- main step

  step(input: Input): void {
    this.events.length = 0;
    if (this.state !== 'running') return;
    const dt = TICK;
    this.tick++;
    this.time += dt;

    if (this.stress) this.director();
    else this.dungeon(dt);
    this.updatePlayer(input, dt);
    this.rebuildHash();
    this.updateAbilities(input, dt);
    this.updateWeapons(dt);
    this.updateOrbs(dt);
    this.updateEnemies(dt);
    this.updateZones(dt);
    this.updateStrikes(dt);
    this.updateLances(dt);
    this.updateTelegraphs(dt);
    this.updateDrops();
    this.updateVeins(dt);
    this.updateGems(dt);
    this.checkEnd();
  }

  /** Apply a draft choice while the sim is paused for a level-up. */
  choose(index: number): void {
    if (this.state !== 'draft') return;
    const opt = this.choices[index];
    if (!opt) return;
    this.applyTalent(opt.id);
    this.player.pendingLevels--;
    this.choices = [];
    if (this.player.pendingLevels > 0) this.openDraft();
    else this.state = 'running';
  }

  summary(): RunSummary {
    return {
      victory: this.victory,
      tier: this.tier,
      omens: [...this.omens],
      paths: [...this.paths],
      time: this.time,
      kills: this.kills,
      level: this.player.level,
      damageDealt: Math.round(this.damageDealt),
      talents: { ...this.talents },
      questsDone: this.quests.filter((q) => q.done).length,
    };
  }

  /** Cheap state fingerprint for determinism tests and future server checks. */
  hash(): number {
    let h = 2166136261 >>> 0;
    const mix = (v: number) => {
      h ^= Math.round(v * 100) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    };
    mix(this.tick);
    mix(this.player.x);
    mix(this.player.y);
    mix(this.player.hp);
    mix(this.kills);
    mix(this.rng.state);
    for (const e of this.enemies) if (e.alive) { mix(e.x); mix(e.y); mix(e.hp); }
    return h;
  }

  // ---------------------------------------------------------------- spawning

  // ---------------------------------------------------------------- dungeon

  get encounterDef() {
    return ENCOUNTERS[this.route[Math.min(this.encounter, this.route.length - 1)]];
  }

  private dungeon(dt: number): void {
    if (this.phase === 'intro') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startEncounter();
      return;
    }
    if (this.phase === 'choose') {
      this.phaseT -= dt;
      const p = this.player;
      const g = this.gates.find((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 <= (q.r + PLAYER_RADIUS) ** 2);
      if (g) this.takeGate(g, false);
      else if (this.phaseT <= 0) this.takeGate(this.gates[0], true);
      return;
    }
    if (this.phase === 'fight') this.runOmens(dt);
    if (this.phase === 'fight' && this.aliveEnemies === 0 && !this.victory) this.clearEncounter();
  }

  private startEncounter(): void {
    const def = this.encounterDef;
    this.phase = 'fight';
    const p = this.player;
    // Enter from the far side of the arena.
    const base = Math.atan2(-p.y, -p.x) + this.rng.range(-0.6, 0.6);
    const n = def.spawns.reduce((a, s) => a + s.n, 0);
    let k = 0;
    let lead = -1;
    for (const sp of def.spawns) {
      for (let j = 0; j < sp.n; j++, k++) {
        const a = base + (k - (n - 1) / 2) * 0.35;
        const r = ARENA - 60;
        const i = this.spawn(sp.kind, Math.cos(a) * r, Math.sin(a) * r);
        if (i < 0) continue;
        const e = this.enemies[i];
        if (sp.kind === 'acolyte') {
          e.aux = a;
          e.aux2 = lead;
        } else if (lead < 0) lead = i;
        if (sp.kind === 'kilnMother') {
          this.bossSpawned = true;
          this.bossIndex = i;
          e.aux = 12; // first Molten Cataclysm
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'cinderBrute') this.eliteSpawned = true;
        if (sp.kind === 'ashmaw') { this.rareSpawned = true; this.rareIndex = i; }
      }
    }
    this.events.push({ type: 'encounterStart', index: this.encounter, id: def.id });
  }

  private clearEncounter(): void {
    const def = this.encounterDef;
    const p = this.player;
    this.events.push({ type: 'encounterClear', index: this.encounter, id: def.id });
    // Every clear is a level: a talent draft, some healing, and a loot bag.
    p.level++;
    p.pendingLevels++;
    this.events.push({ type: 'levelUp', level: p.level });
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
    if (def.id === 'shrine') {
      p.hp = p.maxHp;
    } else {
      const order: Rarity[] = ['common', 'fine', 'rare', 'epic'];
      let min = this.encounter >= 3 ? 2 : this.encounter >= 2 ? 1 : 0;
      if (this.namedFight) min++;
      this.dropLoot(p.x + 40, p.y, order[Math.min(order.length - 1, min)]);
    }
    this.namedFight = false;
    this.encounter++;
    this.openFork();
  }

  /** After a clear: offer a fork if this point in the route has one, else count down to the next fight. */
  private openFork(): void {
    const offer = this.stress ? null : rollFork(this.route, this.encounter, (n) => this.rng.int(n), (q) => this.rng.chance(q));
    if (!offer) {
      this.phase = 'intro';
      this.phaseT = INTRO_TIME;
      return;
    }
    // Two gates side by side, a short walk from the player towards the arena's
    // centre, so both are on a phone screen at once.
    const p = this.player;
    const toward = Math.hypot(p.x, p.y) > 60 ? Math.atan2(-p.y, -p.x) : -Math.PI / 2;
    const cx = p.x + Math.cos(toward) * 140;
    const cy = p.y + Math.sin(toward) * 140;
    const px = -Math.sin(toward) * 85;
    const py = Math.cos(toward) * 85;
    this.gates = offer.map((o, k) => ({ kind: o.kind, encounter: o.encounter, x: cx + (k ? px : -px), y: cy + (k ? py : -py), r: GATE_RADIUS }));
    this.phase = 'choose';
    this.phaseT = CHOOSE_TIME;
    this.events.push({ type: 'fork', gates: this.gates.map((g) => ({ ...g })) });
  }

  private takeGate(g: Gate, timedOut: boolean): void {
    this.route[this.encounter] = g.encounter;
    this.namedFight = g.kind === 'named';
    this.paths.push(g.kind);
    this.gates = [];
    this.events.push({ type: 'gateChosen', kind: g.kind, id: g.encounter, timedOut });
    this.phase = 'intro';
    this.phaseT = INTRO_TIME * 0.6;
  }

  private clampArena(o: { x: number; y: number }, r: number): void {
    if (this.stress) return;
    const d = Math.hypot(o.x, o.y);
    const max = ARENA - r;
    if (d > max) {
      o.x *= max / d;
      o.y *= max / d;
    }
  }

  private director(): void {
    const t = this.time;
    if (!this.eliteSpawned && t >= MINI_BOSS_AT && !this.stress) {
      this.eliteSpawned = true;
      this.spawnAtRing('cinderBrute', 520);
      this.events.push({ type: 'eliteSpawn' });
    }
    if (!this.bossSpawned && t >= BOSS_AT && !this.stress) {
      this.bossSpawned = true;
      this.bossIndex = this.spawnAtRing('kilnMother', 480);
      if (this.bossIndex >= 0) this.enemies[this.bossIndex].aux = 12; // first Molten Cataclysm
      // Lesser named foes flee when the Kiln Mother rises, so the fight stays readable.
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.alive && (e.kind === 'ashmaw' || e.kind === 'cinderBrute' || e.kind === 'rift')) this.despawn(i);
      }
      this.events.push({ type: 'bossSpawn' });
    }
    if (!this.rareSpawned && t >= RARE_AT && !this.stress) {
      this.rareSpawned = true;
      this.rareIndex = this.spawnAtRing('ashmaw', 520);
      this.events.push({ type: 'rareSpawn' });
    }
    if (!this.stress && !this.bossSpawned && this.riftsOpened < RIFT_TIMES.length && t >= RIFT_TIMES[this.riftsOpened]) {
      this.riftsOpened++;
      const i = this.spawnAtRing('rift', 330);
      if (i >= 0) this.events.push({ type: 'riftOpen', x: this.enemies[i].x, y: this.enemies[i].y });
    }
    if (!this.stress && !this.bossSpawned && t >= this.nextVeinAt) {
      this.nextVeinAt += 30;
      this.spawnVein();
    }

    let target = Math.min(28 + t * 0.6, 380);
    if (this.bossSpawned) target = 70;
    if (this.stress) target = 600;

    if (!this.bossSpawned && !this.stress && t >= this.nextSwarmAt) {
      this.nextSwarmAt += 75;
      const n = 36;
      const off = this.rng.next() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        this.spawn('ashling', this.player.x + Math.cos(a) * 560, this.player.y + Math.sin(a) * 560);
      }
    }

    let budget = this.stress ? 40 : 6;
    while (this.aliveEnemies < target && budget-- > 0) {
      this.spawnAtRing(this.pickKind(t), SPAWN_RADIUS);
    }
  }

  private pickKind(t: number): EnemyKind {
    const wHound = t > 45 ? 0.6 : 0;
    const wHusk = t > 120 ? 0.35 + Math.min(0.4, (t - 120) / 600) : 0;
    const roll = this.rng.next() * (1 + wHound + wHusk);
    if (roll < 1) return 'ashling';
    if (roll < 1 + wHound) return 'cinderhound';
    return 'husk';
  }

  private spawnAtRing(kind: EnemyKind, radius: number): number {
    const a = this.rng.next() * Math.PI * 2;
    return this.spawn(kind, this.player.x + Math.cos(a) * radius, this.player.y + Math.sin(a) * radius);
  }

  private spawn(kind: EnemyKind, x: number, y: number): number {
    const idx = this.enemies.findIndex((e) => !e.alive);
    if (idx < 0) return -1;
    const def = ENEMIES[kind];
    const e = this.enemies[idx];
    const tierHp = Math.pow(1.22, this.tier - 1);
    const depth = this.stress ? 1 : def.rank === 'boss' ? 1 : 1 + 0.12 * this.encounter;
    const scale = (this.stress && def.rank === 'normal' ? 1 + this.time / 220 : depth) * tierHp;
    e.alive = true;
    e.kind = kind;
    e.def = def;
    e.x = e.px = x;
    e.y = e.py = y;
    e.maxHp = e.hp = def.hp * scale;
    e.touchCd = 0;
    e.orbitCd = 0;
    e.burnDps = 0;
    e.burnT = 0;
    e.flash = 0;
    e.abilityT = def.rank === 'boss' ? 2 : def.stationary ? 1 : 4;
    e.spawnedAt = this.time;
    e.castId = '';
    e.castName = '';
    e.castT = 0;
    e.castDur = 0;
    e.interruptible = false;
    e.stunT = 0;
    e.aux = 0;
    e.aux2 = 0;
    e.ward = 0;
    e.warded = false;
    this.aliveEnemies++;
    return idx;
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(input: Input, dt: number): void {
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    const len = Math.hypot(input.x, input.y);
    if (len > 0.01) {
      const k = Math.min(1, len) / len;
      p.x += input.x * k * this.moveSpeed * dt;
      p.y += input.y * k * this.moveSpeed * dt;
      p.facing = Math.atan2(input.y, input.x);
    }
    this.clampArena(p, PLAYER_RADIUS);
    p.hp = Math.min(p.maxHp, p.hp + this.regen * dt);
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    if (this.stress) p.hp = p.maxHp;
  }

  get tierDamage(): number {
    return Math.pow(1.12, this.tier - 1);
  }

  private hurtPlayer(amount: number): void {
    if (this.invulnerable || this.player.shieldT > 0) return;
    const p = this.player;
    if (this.rank('riposte') > 0 && p.parryT <= 0 && amount >= 5) {
      // Parry: the hit is turned aside and answered.
      p.parryT = 6;
      const t = this.nearestEnemies(p.x, p.y, 1, 170)[0];
      if (t !== undefined) this.damageEnemy(t, 140 * this.dmgMult, true);
      this.events.push({ type: 'parry', x: p.x, y: p.y });
      return;
    }
    p.hp -= amount;
    p.hurtFlash = 0.15;
    this.events.push({ type: 'playerHurt', amount });
  }

  // ---------------------------------------------------------------- action bar

  private addHeat(v: number): void {
    this.player.heat = Math.min(MAX_HEAT, this.player.heat + v);
  }

  private updateAbilities(input: Input, dt: number): void {
    const p = this.player;
    for (let k = 0; k < p.cds.length; k++) if (p.cds[k] > 0) p.cds[k] = Math.max(0, p.cds[k] - dt);
    if (p.gcd > 0) p.gcd -= dt;
    if (p.shieldT > 0) p.shieldT -= dt;
    if (p.parryT > 0) p.parryT -= dt;
    this.addHeat((this.cls === 'duskblade' ? 3 : 2) * dt);
    const slot = input.cast;
    if (slot === undefined || slot < 0 || slot >= this.abilities.length || !this.canCast(slot)) return;
    p.heat -= this.abilityCost(slot);
    p.cds[slot] = this.abilityCooldown(slot);
    if (!this.abilities[slot].offGcd) p.gcd = GCD;
    if (this.cls === 'duskblade') {
      if (slot === 0) this.rendingDash();
      else if (slot === 1) this.sidestep(input);
      else if (slot === 2) this.execution();
      else this.quench();
      return;
    }
    if (slot === 0) this.flameWave();
    else if (slot === 1) this.blink(input);
    else if (slot === 2) this.combustion();
    else this.quench();
  }

  private flameWave(): void {
    const p = this.player;
    const t = this.nearestEnemies(p.x, p.y, 1, 400)[0];
    const ang = t !== undefined ? Math.atan2(this.enemies[t].y - p.y, this.enemies[t].x - p.x) : p.facing;
    const r = 230;
    const half = (110 * Math.PI) / 360;
    const dmg = 50 * this.dmgMult;
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + e.def.radius / d) return;
      if (e.def.rank === 'normal' && !e.def.stationary) {
        e.x += (dx / d) * 60;
        e.y += (dy / d) * 60;
      }
      this.damageEnemy(i, dmg, true);
    });
    const inferno = this.rank('rollingInferno');
    if (inferno > 0) {
      for (const k of [70, 140, 210]) {
        this.addZone(p.x + Math.cos(ang) * k, p.y + Math.sin(ang) * k, 34, 10 * inferno * this.dmgMult, 3);
      }
    }
    this.events.push({ type: 'ability', slot: 0, x: p.x, y: p.y, angle: ang, r });
  }

  private blink(input: Input): void {
    const p = this.player;
    const moving = Math.hypot(input.x, input.y) > 0.01;
    const ang = moving ? Math.atan2(input.y, input.x) : p.facing;
    const x1 = p.x;
    const y1 = p.y;
    p.x += Math.cos(ang) * 170;
    p.y += Math.sin(ang) * 170;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.shieldT = 0.3 + 0.6 * this.rank('flicker');
    this.addZone(x1, y1, 44, 14 * this.dmgMult, 3);
    this.events.push({ type: 'blink', x1, y1, x2: p.x, y2: p.y });
  }

  /** Combustion goes for the target that matters most: healers, then named foes. */
  private combustionTarget(): number {
    const p = this.player;
    const order = ['acolyte', 'ashmaw', 'cinderBrute', 'kilnMother', 'rift'];
    let best = -1;
    let bestRank = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive || dist2(p.x, p.y, e.x, e.y) > 450 * 450) continue;
      const r = order.indexOf(e.kind);
      if (r >= 0 && r < bestRank) { bestRank = r; best = i; }
    }
    return best >= 0 ? best : (this.nearestEnemies(p.x, p.y, 1, 450)[0] ?? -1);
  }

  private combustion(): void {
    const p = this.player;
    const t = this.combustionTarget();
    const x = t >= 0 ? this.enemies[t].x : p.x;
    const y = t >= 0 ? this.enemies[t].y : p.y;
    const r = 150;
    const dmg = 240 * this.dmgMult;
    this.forEachNear(x, y, r + 50, (i) => {
      const e = this.enemies[i];
      if (dist2(x, y, e.x, e.y) > (r + e.def.radius) ** 2) return;
      this.damageEnemy(i, dmg, true);
      if (e.alive) {
        e.burnDps = Math.max(e.burnDps, 20 * this.dmgMult);
        e.burnT = 4;
      }
    });
    this.events.push({ type: 'ability', slot: 2, x, y, angle: 0, r });
  }

  /** The enemy Quench would interrupt right now, or -1. */
  interruptTarget(): number {
    const p = this.player;
    // The most dangerous caster first: boss, then rare, then elite.
    const weight = { boss: 0, rare: 1, elite: 2, normal: 3 };
    let best = -1;
    let bestW = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive || !e.castId || !e.interruptible) continue;
      const d = dist2(p.x, p.y, e.x, e.y);
      const reach = this.classDef.interruptRange + e.def.radius;
      if (d > reach * reach) continue;
      const w = weight[e.def.rank] * 1e7 + d;
      if (w < bestW) { bestW = w; best = i; }
    }
    return best;
  }

  private quench(): void {
    const p = this.player;
    const t = this.interruptTarget();
    if (t >= 0) {
      const e = this.enemies[t];
      this.events.push({ type: 'interrupt', x: e.x, y: e.y, name: e.castName });
      this.cancelCast(t);
      e.stunT = 2;
      this.events.push({ type: 'ability', slot: 3, x: e.x, y: e.y, angle: 0, r: 40 });
      return;
    }
    // Nothing to interrupt: half the cooldown back (and a small bolt for casters).
    p.cds[3] = this.abilityCooldown(3) / 2;
    if (this.cls === 'duskblade') return;
    const n = this.nearestEnemies(p.x, p.y, 1, 480)[0];
    if (n !== undefined) {
      const e = this.enemies[n];
      this.damageEnemy(n, 30 * this.dmgMult, true);
      this.events.push({ type: 'ability', slot: 3, x: e.x, y: e.y, angle: 0, r: 30 });
    }
  }

  // ---------------------------------------------------------------- weapons

  private updateWeapons(dt: number): void {
    const p = this.player;
    if (this.cls === 'duskblade') {
      this.updateBlades(dt);
      return;
    }

    p.volleyT -= dt;
    if (p.volleyT <= 0) {
      p.volleyT += this.volleyCooldown;
      this.fireVolley();
    }

    const rain = this.rank('emberRain');
    if (rain > 0) {
      p.rainT -= dt;
      if (p.rainT <= 0) {
        p.rainT += 4;
        for (let i = 0; i < rain * 2; i++) {
          const target = this.randomEnemyNear(p.x, p.y, 380);
          if (target < 0) break;
          const e = this.enemies[target];
          this.addStrike(e.x, e.y, 55, 28 * this.dmgMult);
        }
      }
    }

    if (this.rank('phoenixLance') > 0) {
      p.lanceT -= dt;
      if (p.lanceT <= 0) {
        p.lanceT += 2.5;
        this.fireLance();
      }
    }

    if (this.rank('ringOfAsh') > 0) {
      p.orbitAngle += 3.2 * dt;
      for (let k = 0; k < 3; k++) {
        const a = p.orbitAngle + (k * Math.PI * 2) / 3;
        const ox = p.x + Math.cos(a) * 78;
        const oy = p.y + Math.sin(a) * 78;
        this.forEachNear(ox, oy, 60, (i) => {
          const e = this.enemies[i];
          if (e.orbitCd > 0) return;
          if (dist2(ox, oy, e.x, e.y) <= (14 + e.def.radius) ** 2) {
            e.orbitCd = 0.4;
            this.damageEnemy(i, 16 * this.dmgMult, true);
          }
        });
      }
    }
  }

  // ---------------------------------------------------------------- duskblade

  get swingCooldown(): number {
    return (0.6 * Math.pow(0.88, this.rank('quickBlades'))) / this.loadout.hasteMult;
  }
  get swingReach(): number {
    return 92 * (1 + 0.15 * this.rank('longReach'));
  }

  /** The foe the Duskblade is fighting: bosses and named foes first, then the nearest. */
  bladeTarget(maxDist: number): number {
    const p = this.player;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y)) - e.def.radius;
      if (d > maxDist) continue;
      // Big foes count as a little closer, so the blades stay on them.
      const score = d - (e.def.rank === 'normal' ? 0 : 40);
      if (score < bestD) { bestD = score; best = i; }
    }
    return best;
  }

  private updateBlades(dt: number): void {
    const p = this.player;
    p.volleyT -= dt;
    if (p.volleyT > 0) return;
    const t = this.bladeTarget(this.swingReach + 30);
    if (t < 0) {
      p.volleyT = 0; // ready the moment something is in reach
      return;
    }
    p.volleyT += this.swingCooldown;
    if (p.volleyT < 0) p.volleyT = 0;
    this.swing(t);
  }

  private swing(t: number): void {
    const p = this.player;
    const e0 = this.enemies[t];
    const ang = Math.atan2(e0.y - p.y, e0.x - p.x);
    p.facing = ang;
    p.swings++;
    const spin = this.rank('bladeStorm') > 0 && p.swings % 4 === 0;
    const r = this.swingReach;
    const half = spin ? Math.PI : ((130 * Math.PI) / 360) * (1 + 0.15 * this.rank('longReach'));
    const dmg = 24 * this.dmgMult * (spin ? 2 : 1);
    const forceCrit = p.nextCrit;
    p.nextCrit = false;
    let hits = 0;
    const bleed = this.rank('serratedEdge');
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (!spin && Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + e.def.radius / d) return;
      hits++;
      this.damageEnemy(i, forceCrit ? dmg * 2 : dmg, !forceCrit);
      if (bleed > 0 && e.alive) {
        e.burnDps = Math.max(e.burnDps, 5 * bleed * this.dmgMult);
        e.burnT = Math.max(e.burnT, 3);
      }
    });
    this.addHeat(Math.min(15, 5 * hits) * (1 + 0.3 * this.rank('momentumFlow')));
    this.events.push({ type: 'swing', x: p.x, y: p.y, angle: ang, r, arc: half * 2, spin });
  }

  private rendingDash(): void {
    const p = this.player;
    let t = this.bladeTarget(340);
    const x1 = p.x;
    const y1 = p.y;
    let ang = p.facing;
    let len = 200;
    if (t >= 0) {
      const e = this.enemies[t];
      ang = Math.atan2(e.y - p.y, e.x - p.x);
      len = Math.max(0, Math.min(300, Math.hypot(e.x - p.x, e.y - p.y) - e.def.radius - 20));
    } else t = -1;
    p.x += Math.cos(ang) * len;
    p.y += Math.sin(ang) * len;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.facing = ang;
    p.shieldT = Math.max(p.shieldT, 0.2);
    const dmg = 55 * this.dmgMult;
    const bleed = 12 * (1 + 0.5 * this.rank('deepCuts')) * this.dmgMult;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      if (segDist2(e.x, e.y, x1, y1, p.x, p.y) > (40 + e.def.radius) ** 2) continue;
      this.damageEnemy(i, dmg, true);
      if (e.alive) {
        e.burnDps = Math.max(e.burnDps, bleed);
        e.burnT = Math.max(e.burnT, 4);
      }
    }
    // Land swinging.
    p.volleyT = Math.min(p.volleyT, 0.05);
    this.events.push({ type: 'dash', x1, y1, x2: p.x, y2: p.y, dodge: false });
  }

  private sidestep(input: Input): void {
    const p = this.player;
    let ang: number;
    if (Math.hypot(input.x, input.y) > 0.01) ang = Math.atan2(input.y, input.x);
    else {
      const n = this.nearestEnemies(p.x, p.y, 1, 300)[0];
      ang = n !== undefined ? Math.atan2(p.y - this.enemies[n].y, p.x - this.enemies[n].x) : p.facing + Math.PI;
    }
    const x1 = p.x;
    const y1 = p.y;
    p.x += Math.cos(ang) * 130;
    p.y += Math.sin(ang) * 130;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.shieldT = 0.7;
    if (this.rank('evasion') > 0) p.nextCrit = true;
    this.events.push({ type: 'dash', x1, y1, x2: p.x, y2: p.y, dodge: true });
  }

  private execution(): void {
    const p = this.player;
    let t = this.bladeTarget(this.swingReach + 70);
    if (t < 0) t = this.nearestEnemies(p.x, p.y, 1, 220)[0] ?? -1;
    if (t < 0) {
      // Nothing in reach: refund most of it.
      p.heat = Math.min(MAX_HEAT, p.heat + this.abilityCost(2) * 0.8);
      p.cds[2] = 1;
      return;
    }
    const e = this.enemies[t];
    const low = e.hp < e.maxHp * 0.35;
    this.damageEnemy(t, 230 * this.dmgMult * (low ? 2 : 1), true);
    const cx = e.x;
    const cy = e.y;
    this.forEachNear(cx, cy, 120, (i) => {
      if (i === t) return;
      const o = this.enemies[i];
      if (dist2(cx, cy, o.x, o.y) <= (90 + o.def.radius) ** 2) this.damageEnemy(i, 60 * this.dmgMult, true);
    });
    this.events.push({ type: 'ability', slot: 2, x: cx, y: cy, angle: 0, r: 90 });
  }

  /** Orbiter positions for rendering. */
  orbiters(): { x: number; y: number }[] {
    if (this.rank('ringOfAsh') === 0) return [];
    const p = this.player;
    return [0, 1, 2].map((k) => {
      const a = p.orbitAngle + (k * Math.PI * 2) / 3;
      return { x: p.x + Math.cos(a) * 78, y: p.y + Math.sin(a) * 78 };
    });
  }

  private fireVolley(): void {
    const p = this.player;
    const n = this.orbCount;
    const targets = this.nearestEnemies(p.x, p.y, n, 650);
    // Bosses pull focus: the first orb always goes to a boss in range.
    if (this.bossIndex >= 0) {
      const b = this.enemies[this.bossIndex];
      if (b.alive && b.def.rank === 'boss' && dist2(p.x, p.y, b.x, b.y) < 480 * 480) targets.unshift(this.bossIndex);
    }
    for (let k = 0; k < n; k++) {
      const orb = this.orbs.find((o) => !o.alive);
      if (!orb) return;
      const t = targets.length ? targets[k % targets.length] : -1;
      let ang: number;
      if (t >= 0) {
        const e = this.enemies[t];
        ang = Math.atan2(e.y - p.y, e.x - p.x);
      } else {
        ang = p.facing + (k - (n - 1) / 2) * 0.3;
      }
      ang += (k - (n - 1) / 2) * 0.12;
      orb.alive = true;
      orb.x = orb.px = p.x;
      orb.y = orb.py = p.y;
      orb.vx = Math.cos(ang) * 330;
      orb.vy = Math.sin(ang) * 330;
      orb.life = 1.6;
      orb.target = t;
      orb.dmg = 12 * this.dmgMult;
    }
  }

  private fireLance(): void {
    const p = this.player;
    const t = this.nearestEnemies(p.x, p.y, 1, 600)[0];
    const ang = t !== undefined ? Math.atan2(this.enemies[t].y - p.y, this.enemies[t].x - p.x) : p.facing;
    const len = 520;
    const x2 = p.x + Math.cos(ang) * len;
    const y2 = p.y + Math.sin(ang) * len;
    const lance = this.lances.find((l) => !l.alive);
    if (lance) Object.assign(lance, { alive: true, x1: p.x, y1: p.y, x2, y2, life: 0.25 });
    const dmg = 75 * this.dmgMult;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      if (segDist2(e.x, e.y, p.x, p.y, x2, y2) <= (12 + e.def.radius) ** 2) this.damageEnemy(i, dmg, true);
    }
  }

  private updateOrbs(dt: number): void {
    const burn = this.rank('searingBurn');
    const ground = this.rank('kindledGround');
    const boom = this.rank('conflagration') > 0;
    for (const o of this.orbs) {
      if (!o.alive) continue;
      o.px = o.x;
      o.py = o.y;
      // Gentle homing toward the chosen target while it lives.
      if (o.target >= 0) {
        const e = this.enemies[o.target];
        if (e.alive) {
          const want = Math.atan2(e.y - o.y, e.x - o.x);
          const cur = Math.atan2(o.vy, o.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const turn = Math.max(-6 * dt, Math.min(6 * dt, d));
          const sp = Math.hypot(o.vx, o.vy);
          o.vx = Math.cos(cur + turn) * sp;
          o.vy = Math.sin(cur + turn) * sp;
        } else o.target = -1;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0) {
        o.alive = false;
        continue;
      }
      let hit = -1;
      this.forEachNear(o.x, o.y, 50, (i) => {
        if (hit >= 0) return;
        const e = this.enemies[i];
        if (dist2(o.x, o.y, e.x, e.y) <= (6 + e.def.radius) ** 2) hit = i;
      });
      if (hit < 0) continue;
      o.alive = false;
      const e = this.enemies[hit];
      const hx = e.x;
      const hy = e.y;
      this.damageEnemy(hit, o.dmg, true);
      this.addHeat(4 * (1 + 0.35 * this.rank('heatSink')));
      if (burn > 0 && e.alive) {
        e.burnDps = Math.max(e.burnDps, 4 * burn * this.dmgMult);
        e.burnT = 3;
      }
      if (ground > 0) this.addZone(hx, hy, 26 + 8 * ground, 5 * ground * this.dmgMult, 2);
      if (boom) {
        this.events.push({ type: 'explode', x: hx, y: hy, r: 48 });
        this.forEachNear(hx, hy, 100, (i) => {
          if (i === hit) return;
          const n = this.enemies[i];
          if (dist2(hx, hy, n.x, n.y) <= (48 + n.def.radius) ** 2) this.damageEnemy(i, o.dmg * 0.6, false);
        });
      }
    }
  }

  // ---------------------------------------------------------------- enemies

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      e.px = e.x;
      e.py = e.y;
      if (e.touchCd > 0) e.touchCd -= dt;
      if (e.orbitCd > 0) e.orbitCd -= dt;
      if (e.flash > 0) e.flash -= dt;

      if (e.burnT > 0) {
        e.burnT -= dt;
        this.damageEnemy(i, e.burnDps * dt, false, true);
        if (!e.alive) continue;
      }

      if (e.def.stationary) {
        this.runStationary(i, dt);
        continue;
      }
      if (e.stunT > 0) {
        e.stunT -= dt;
        continue;
      }

      let speed = e.castId ? 0 : e.def.speed;
      if (e.def.rank === 'boss' && this.bossEnraged) speed *= 1.6;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let mx = (dx / d) * speed;
      let my = (dy / d) * speed;

      // Separation so a group reads as separate foes, not a single blob.
      if (e.def.rank !== 'boss') {
        let sx = 0;
        let sy = 0;
        let count = 0;
        this.forEachNear(e.x, e.y, 30, (j) => {
          if (j === i || count > 6) return;
          const o = this.enemies[j];
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const dd = ox * ox + oy * oy;
          const min = e.def.radius + o.def.radius;
          if (dd > 0.0001 && dd < min * min) {
            const inv = 1 / Math.sqrt(dd);
            sx += ox * inv;
            sy += oy * inv;
            count++;
          }
        });
        mx += sx * speed * 0.9;
        my += sy * speed * 0.9;
      }

      // Despawn stragglers that fall far behind; they respawn ahead.
      if (e.def.rank === 'normal' && d > SPAWN_RADIUS * 1.5) {
        this.relocate(e);
        continue;
      }

      e.x += mx * dt;
      e.y += my * dt;
      this.clampArena(e, e.def.radius);

      if (e.def.rank !== 'normal') this.runAbilities(i, dt);

      if (d < e.def.radius + PLAYER_RADIUS && e.touchCd <= 0) {
        e.touchCd = 0.6;
        const mult = e.def.rank === 'boss' && this.bossEnraged ? 2.5 : 1;
        this.hurtPlayer(e.def.damage * mult * this.tierDamage);
      }
    }
  }

  /** Removes an enemy without a kill (no loot, no credit). */
  private despawn(i: number): void {
    const e = this.enemies[i];
    if (e.castId) this.cancelCast(i);
    e.alive = false;
    this.aliveEnemies--;
  }

  private relocate(e: Enemy): void {
    const a = this.rng.next() * Math.PI * 2;
    e.x = e.px = this.player.x + Math.cos(a) * SPAWN_RADIUS;
    e.y = e.py = this.player.y + Math.sin(a) * SPAWN_RADIUS;
  }

  /** Rifts spawn ashlings; acolytes channel heals into the boss. */
  private runStationary(i: number, dt: number): void {
    const e = this.enemies[i];
    if (e.kind === 'rift') {
      e.abilityT -= dt;
      if (e.abilityT <= 0) {
        e.abilityT = 3;
        for (let k = 0; k < 3; k++) {
          const a = this.rng.next() * Math.PI * 2;
          this.spawn('ashling', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
        }
      }
      return;
    }
    const ward = e.kind === 'acolyte' ? e.aux2 : -1;
    if (ward >= 0) {
      const b = this.enemies[ward];
      if (b.alive && b.def.rank !== 'normal') {
        // Acolytes circle the Kiln Mother and channel heat into her.
        e.aux += 0.35 * dt;
        e.x = b.x + Math.cos(e.aux) * ACOLYTE_RING;
        e.y = b.y + Math.sin(e.aux) * ACOLYTE_RING;
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * ACOLYTE_HEAL * dt);
      }
    }
    const p = this.player;
    if (dist2(p.x, p.y, e.x, e.y) < (e.def.radius + PLAYER_RADIUS) ** 2 && e.touchCd <= 0) {
      e.touchCd = 0.6;
      this.hurtPlayer(e.def.damage * this.tierDamage);
    }
  }

  private startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void {
    const e = this.enemies[i];
    e.castId = id;
    e.castName = name;
    e.castT = 0;
    e.castDur = this.hasOmen('quickened') ? dur * OMEN_TUNING.quickenedCast : dur;
    e.interruptible = interruptible;
    this.events.push({ type: 'castStart', index: i, name });
  }

  private cancelCast(i: number): void {
    const e = this.enemies[i];
    e.castId = '';
    e.castName = '';
    e.castT = 0;
    for (const t of this.telegraphs) if (t.alive && t.owner === i) t.alive = false;
  }

  private finishCast(i: number): void {
    const e = this.enemies[i];
    const id = e.castId;
    const name = e.castName;
    e.castId = '';
    e.castName = '';
    for (const t of this.telegraphs) if (t.alive && t.owner === i) t.owner = -1; // let it land
    if (id === 'cataclysm') {
      const p = this.player;
      this.hurtPlayer(45 * (this.bossEnraged ? 1.5 : 1) * this.tierDamage);
      this.events.push({ type: 'slam', x: p.x, y: p.y, r: 160 });
    } else if (id === 'gorge') {
      const amount = e.maxHp * 0.1;
      e.hp = Math.min(e.maxHp, e.hp + amount);
      this.events.push({ type: 'heal', x: e.x, y: e.y, amount });
    }
    this.events.push({ type: 'castDone', x: e.x, y: e.y, name });
  }

  private runAbilities(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    if (e.castId) {
      e.castT += dt;
      if (e.castT >= e.castDur) this.finishCast(i);
      return;
    }
    e.abilityT -= dt;
    if (e.kind === 'cinderBrute') {
      if (e.abilityT <= 0) {
        e.abilityT = 5;
        this.startCast(i, 'groundPound', 'Ground Pound', 1.4, true);
        this.addTelegraph('circle', p.x, p.y, 95, 0, 0, 1.4, 30, 'hit', i);
      }
      return;
    }
    if (e.kind === 'cinderhound') {
      if (e.abilityT <= 0 && dist2(p.x, p.y, e.x, e.y) < 160 * 160) {
        e.abilityT = 3.5 + this.rng.next();
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        this.startCast(i, 'snap', 'Snap', 0.6, false);
        this.addTelegraph('cone', e.x, e.y, 95, ang, (70 * Math.PI) / 180, 0.6, 12, 'hit', i);
      }
      return;
    }
    if (e.kind === 'husk') {
      if (e.abilityT <= 0 && dist2(p.x, p.y, e.x, e.y) < 220 * 220) {
        e.abilityT = 4.5;
        this.startCast(i, 'slam', 'Warden Slam', 1.2, false);
        this.addTelegraph('circle', e.x, e.y, 115, 0, 0, 1.2, 24, 'hit', i);
      }
      return;
    }
    if (e.kind === 'ashmaw') {
      if (e.abilityT <= 0) {
        e.abilityT = 5;
        e.aux++;
        if (e.aux % 2 === 0) {
          this.startCast(i, 'gorge', 'Gorge', 2.2, true);
        } else {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          this.startCast(i, 'spit', 'Ash Spit', 1.0, false);
          this.addTelegraph('cone', e.x, e.y, 260, ang, (60 * Math.PI) / 180, 1.0, 22, 'hit', i);
        }
      }
      return;
    }
    if (e.def.rank !== 'boss') return;
    this.runBoss(i, dt);
  }

  /** Smolderhusk, the Kiln Mother: three phases, interrupts, healers and soaks. */
  private runBoss(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    if (!this.bossEnraged && this.time - e.spawnedAt > BOSS_ENRAGE_AFTER) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    const frac = e.hp / e.maxHp;
    const phase = frac > 0.6 ? 1 : frac > 0.3 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
      if (phase === 2) {
        for (const side of [-1, 1]) {
          const a = Math.atan2(p.y - e.y, p.x - e.x) + side * Math.PI / 2;
          const k = this.spawn('acolyte', e.x + Math.cos(a) * ACOLYTE_RING, e.y + Math.sin(a) * ACOLYTE_RING);
          if (k >= 0) {
            this.enemies[k].aux = a;
            this.enemies[k].aux2 = i;
          }
        }
        this.brandT = 3;
      }
    }
    const mult = this.bossEnraged ? 2 : 1;

    // Molten Cataclysm: interrupt it or take a big hit wherever you stand.
    e.aux -= dt;
    if (e.aux <= 0) {
      e.aux = phase === 3 ? 12 : 18;
      this.startCast(i, 'cataclysm', 'Molten Cataclysm', 3, true);
      return;
    }
    // Kiln Brand: someone has to stand in the gold circle.
    if (phase >= 2) {
      this.brandT -= dt;
      if (this.brandT <= 0) {
        this.brandT = 14;
        const a = this.rng.next() * Math.PI * 2;
        this.addTelegraph('circle', p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150, 70, 0, 0, 4, 40, 'soak', -1);
      }
    }
    if (e.abilityT > 0) return;
    e.abilityT = this.bossEnraged ? 1.6 : phase === 3 ? 2.4 : 3.2;
    const roll = this.rng.int(3);
    if (roll === 0) {
      this.addTelegraph('circle', p.x, p.y, 120, 0, 0, 1.3, 35 * mult);
      if (phase === 3) {
        const a = this.rng.next() * Math.PI * 2;
        this.addTelegraph('circle', p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 120, 0, 0, 1.6, 35 * mult);
      }
    } else if (roll === 1) {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      this.addTelegraph('cone', e.x, e.y, 320, ang, (70 * Math.PI) / 180, 1.1, 30 * mult);
    } else {
      const n = phase === 3 ? 10 : 7;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        this.spawn('ashling', e.x + Math.cos(a) * 260, e.y + Math.sin(a) * 260);
      }
    }
  }

  private damageEnemy(i: number, amount: number, canCrit: boolean, silent = false): void {
    const e = this.enemies[i];
    if (!e.alive) return;
    let dmg = amount;
    let crit = false;
    if (e.def.rank !== 'normal' && this.hasMythic('giantsBane')) dmg *= 1.3;
    if (e.burnT > 0) dmg *= 1 + 0.1 * this.rank('hemorrhage');
    if (canCrit && this.rng.chance(this.critChance)) {
      dmg *= 2;
      crit = true;
    }
    if (e.ward > 0) {
      const soak = Math.min(e.ward, dmg);
      e.ward -= soak;
      dmg -= soak;
    }
    e.hp -= dmg;
    if (!e.warded && e.hp > 0 && e.hp < e.maxHp * 0.5 && this.hasOmen('warded') && !this.stress) {
      e.warded = true;
      e.ward = e.maxHp * OMEN_TUNING.wardShare;
      this.events.push({ type: 'ward', index: i, amount: e.ward });
    }
    this.damageDealt += dmg;
    const thirst = this.rank('thirst');
    if (thirst > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + dmg * 0.02 * thirst);
    if (!silent) {
      e.flash = 0.08;
      this.events.push({ type: 'hit', x: e.x, y: e.y, amount: dmg, crit });
    }
    if (canCrit && this.hasMythic('splittingCinders')) {
      let other = -1;
      this.forEachNear(e.x, e.y, 70, (j) => {
        if (other < 0 && j !== i) other = j;
      });
      if (other >= 0) this.damageEnemy(other, dmg * 0.15, false, true);
    }
    if (e.hp <= 0) this.killEnemy(i);
  }

  hasMythic(id: Loadout['mythics'][number]): boolean {
    return this.loadout.mythics.includes(id);
  }

  private killEnemy(i: number): void {
    const e = this.enemies[i];
    if (e.castId) this.cancelCast(i);
    e.alive = false;
    this.aliveEnemies--;
    this.kills++;
    this.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind });
    this.omensOnKill(e);
    if (e.burnT > 0 && this.rank('crimsonTide') > 0) {
      // Crimson Tide: the bleed bursts onto everything close by.
      const bleed = Math.max(e.burnDps, 14 * this.dmgMult);
      this.forEachNear(e.x, e.y, 120, (j) => {
        const o = this.enemies[j];
        if (dist2(e.x, e.y, o.x, o.y) > 120 * 120) return;
        o.burnDps = Math.max(o.burnDps, bleed);
        o.burnT = Math.max(o.burnT, 4);
      });
      this.events.push({ type: 'explode', x: e.x, y: e.y, r: 120 });
    }
    if (e.def.rank === 'boss') {
      this.victory = true;
      // The run ends on this tick, so boss loot goes straight to the bags.
      this.pickUp(this.makeItem('epic'));
      return;
    }
    if (e.kind === 'cinderhound') this.progressQuest('hounds');
    if (e.kind === 'rift') {
      this.progressQuest('rifts');
      this.addHeat(20);
      this.events.push({ type: 'riftClosed', x: e.x, y: e.y });
    }
    if (e.kind === 'ashmaw') {
      this.progressQuest('ashmaw');
      this.dropLoot(e.x, e.y, 'rare');
    }
    if (e.kind === 'cinderBrute') this.dropLoot(e.x, e.y, 'fine');
    if (this.stress && e.def.rank === 'normal' && this.rng.chance(TRASH_DROP)) this.dropLoot(e.x, e.y, 'common');
    if (e.kind === 'cinderBrute') {
      this.eliteKilled = true;
      // Elite chest: a free bonus draft.
      this.events.push({ type: 'chest', x: e.x, y: e.y });
      this.player.pendingLevels++;
    }
    if (e.def.xp > 0 && this.stress) this.dropGem(e.x, e.y, e.def.xp);
  }

  // ---------------------------------------------------------------- effects

  private addZone(x: number, y: number, r: number, dps: number, life: number): void {
    const z = this.zones.find((q) => !q.alive);
    if (!z) return;
    Object.assign(z, { alive: true, x, y, r, dps, life, maxLife: life, tickT: 0 });
  }

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      if (!z.alive) continue;
      z.life -= dt;
      if (z.life <= 0) {
        z.alive = false;
        continue;
      }
      z.tickT -= dt;
      if (z.tickT > 0) continue;
      z.tickT = 0.5;
      this.forEachNear(z.x, z.y, z.r + 50, (i) => {
        const e = this.enemies[i];
        if (dist2(z.x, z.y, e.x, e.y) <= (z.r + e.def.radius) ** 2) this.damageEnemy(i, z.dps * 0.5, false, true);
      });
    }
  }

  private addStrike(x: number, y: number, r: number, dmg: number): void {
    const s = this.strikes.find((q) => !q.alive);
    if (!s) return;
    Object.assign(s, { alive: true, x, y, r, t: 0.35, dmg });
  }

  private updateStrikes(dt: number): void {
    for (const s of this.strikes) {
      if (!s.alive) continue;
      s.t -= dt;
      if (s.t > 0) continue;
      s.alive = false;
      this.events.push({ type: 'strike', x: s.x, y: s.y, r: s.r });
      this.forEachNear(s.x, s.y, s.r + 50, (i) => {
        const e = this.enemies[i];
        if (dist2(s.x, s.y, e.x, e.y) <= (s.r + e.def.radius) ** 2) this.damageEnemy(i, s.dmg, true);
      });
    }
  }

  private updateLances(dt: number): void {
    for (const l of this.lances) if (l.alive && (l.life -= dt) <= 0) l.alive = false;
  }

  private addTelegraph(
    shape: 'circle' | 'cone', x: number, y: number, r: number, angle: number, arc: number, dur: number, dmg: number,
    kind: 'hit' | 'soak' = 'hit', owner = -1,
  ): void {
    const t = this.telegraphs.find((q) => !q.alive);
    if (!t) return;
    Object.assign(t, { alive: true, shape, x, y, r, angle, arc, t: 0, dur, dmg, kind, owner });
  }

  // ---------------------------------------------------------------- omens

  hasOmen(id: OmenId): boolean {
    return this.omens.includes(id);
  }

  /** Per-tick Omens during a fight. */
  private runOmens(dt: number): void {
    if (!this.hasOmen('volatileGround') || this.victory) return;
    this.volatileT += dt;
    // Never erupt while a soak circle is up: standing still in gold must stay safe.
    if (this.volatileT >= OMEN_TUNING.volatileEvery && !this.telegraphs.some((t) => t.alive && t.kind === 'soak')) {
      this.volatileT = 0;
      const p = this.player;
      this.addTelegraph('circle', p.x, p.y, OMEN_TUNING.volatileRadius, 0, 0, OMEN_TUNING.volatileDelay, OMEN_TUNING.volatileDamage);
    }
  }

  private omensOnKill(e: Enemy): void {
    if (e.def.rank === 'boss' || this.stress) return;
    if (this.hasOmen('kindledDead') && e.def.rank !== 'normal') {
      this.addTelegraph('circle', e.x, e.y, OMEN_TUNING.kindledRadius, 0, 0, OMEN_TUNING.kindledDelay, OMEN_TUNING.kindledDamage);
    }
    if (this.hasOmen('sharedPain') && e.def.rank !== 'normal') {
      for (const o of this.enemies) {
        if (!o.alive || o === e || o.def.rank === 'normal') continue;
        const amount = Math.min(o.maxHp - o.hp, o.maxHp * OMEN_TUNING.sharedPainHeal);
        if (amount <= 0) continue;
        o.hp += amount;
        this.events.push({ type: 'heal', x: o.x, y: o.y, amount });
      }
    }
  }

  private updateTelegraphs(dt: number): void {
    const p = this.player;
    for (const t of this.telegraphs) {
      if (!t.alive) continue;
      t.t += dt;
      if (t.t < t.dur) continue;
      t.alive = false;
      if (t.kind === 'soak') {
        const ok = dist2(p.x, p.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2;
        this.events.push({ type: 'soak', ok, x: t.x, y: t.y });
        if (!ok) {
          this.hurtPlayer(t.dmg * this.tierDamage);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            this.spawn('ashling', t.x + Math.cos(a) * 60, t.y + Math.sin(a) * 60);
          }
        }
        continue;
      }
      this.events.push({ type: 'slam', x: t.x, y: t.y, r: t.r });
      let inside = false;
      const dd = dist2(p.x, p.y, t.x, t.y);
      if (t.shape === 'circle') inside = dd <= (t.r + PLAYER_RADIUS * 0.5) ** 2;
      else if (dd <= t.r * t.r) {
        let d = Math.atan2(p.y - t.y, p.x - t.x) - t.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        inside = Math.abs(d) <= t.arc / 2;
      }
      if (inside) this.hurtPlayer(t.dmg * this.tierDamage);
    }
  }

  // ---------------------------------------------------------------- loot

  private makeItem(min: Rarity): Item {
    return rollDrop(this.rng, `i${this.nextItemId++}`, this.itemLevel, this.luck, min);
  }

  private dropLoot(x: number, y: number, min: Rarity): void {
    const item = this.makeItem(min);
    const d = this.drops.find((q) => !q.alive);
    if (!d) {
      this.pickUp(item);
      return;
    }
    Object.assign(d, { alive: true, x, y, item });
    this.events.push({ type: 'drop', x, y, rarity: item.rarity });
  }

  /** Adds an item to this run's haul and wears it right away if it is an upgrade. */
  private pickUp(item: Item): void {
    this.runDrops.push(item);
    const cur = this.gear.find((g) => g.slot === item.slot);
    const delta = Math.round(itemScore(item) - (cur ? itemScore(cur) : 0));
    const equipped = delta > 0;
    if (equipped) {
      this.gear = this.gear.filter((g) => g.slot !== item.slot);
      this.gear.push(item);
      this.runEquipped.push(item.id);
      const before = this.loadout.maxHpBonus;
      this.loadout = loadoutFrom(this.passives, this.gear);
      const gain = this.loadout.maxHpBonus - before;
      this.player.maxHp += gain;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, gain));
    }
    this.events.push({ type: 'loot', item, equipped, delta });
  }

  private updateDrops(): void {
    const p = this.player;
    for (const d of this.drops) {
      if (!d.alive || !d.item) continue;
      if (dist2(p.x, p.y, d.x, d.y) <= 46 * 46) {
        d.alive = false;
        this.pickUp(d.item);
        d.item = null;
      }
    }
  }

  private spawnVein(): void {
    if (this.veins.filter((v) => v.alive).length >= 3) return;
    const v = this.veins.find((q) => !q.alive);
    if (!v) return;
    const a = this.rng.next() * Math.PI * 2;
    Object.assign(v, { alive: true, x: this.player.x + Math.cos(a) * 260, y: this.player.y + Math.sin(a) * 260, progress: 0 });
  }

  /** Gathering: stand on an Ember Vein for a moment. */
  private updateVeins(dt: number): void {
    const p = this.player;
    for (const v of this.veins) {
      if (!v.alive) continue;
      if (dist2(p.x, p.y, v.x, v.y) <= 40 * 40) v.progress += dt;
      else v.progress = Math.max(0, v.progress - dt);
      if (v.progress < VEIN_TIME) continue;
      v.alive = false;
      this.addHeat(30);
      p.hp = Math.min(p.maxHp, p.hp + 10);
      this.gainXp(3);
      this.progressQuest('veins');
      this.events.push({ type: 'gather', x: v.x, y: v.y });
    }
  }

  // ---------------------------------------------------------------- quests

  pickQuests(): QuestId[] {
    const all = Object.keys(QUESTS) as QuestId[];
    all.splice(this.rng.int(all.length), 1);
    return all;
  }

  private progressQuest(id: QuestId): void {
    const k = this.quests.findIndex((q) => q.id === id && !q.done);
    if (k < 0) return;
    const q = this.quests[k];
    q.progress++;
    if (q.progress < q.goal) return;
    q.done = true;
    this.gainXp(this.player.xpToNext * 0.6);
    this.pickUp(this.makeItem('fine'));
    this.events.push({ type: 'quest', index: k });
  }

  // ---------------------------------------------------------------- xp

  private dropGem(x: number, y: number, value: number): void {
    const g = this.gems.find((q) => !q.alive);
    if (g) {
      Object.assign(g, { alive: true, x, y, px: x, py: y, value, pulled: false });
      return;
    }
    // Pool full: fold the value into an existing gem so no XP is lost.
    this.gems[this.rng.int(this.gems.length)].value += value;
  }

  private updateGems(dt: number): void {
    const p = this.player;
    const pr2 = this.pickupRadius ** 2;
    for (const g of this.gems) {
      if (!g.alive) continue;
      g.px = g.x;
      g.py = g.y;
      const dd = dist2(g.x, g.y, p.x, p.y);
      if (!g.pulled && dd <= pr2) g.pulled = true;
      if (g.pulled) {
        const d = Math.sqrt(dd) || 1;
        const sp = Math.max(260, this.moveSpeed * 2.2);
        g.x += ((p.x - g.x) / d) * sp * dt;
        g.y += ((p.y - g.y) / d) * sp * dt;
        if (d < 14) {
          g.alive = false;
          this.gainXp(g.value);
        }
      }
    }
    if (this.player.pendingLevels > 0 && this.state === 'running' && this.phase !== 'fight') this.openDraft();
  }

  private gainXp(v: number): void {
    const p = this.player;
    p.xp += v * this.loadout.xpMult;
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level++;
      p.xpToNext = xpFor(p.level);
      p.pendingLevels++;
      this.events.push({ type: 'levelUp', level: p.level });
    }
  }

  private openDraft(): void {
    this.choices = this.rollDraft();
    this.state = 'draft';
  }

  /** Offer 3 talents. An unlocked capstone is always offered. */
  rollDraft(): DraftOption[] {
    const out: DraftOption[] = [];
    const pool: TalentId[] = [];
    for (const def of Object.values(TALENTS)) {
      if (def.branch === 'general' || def.cls !== this.cls) continue;
      const r = this.rank(def.id);
      if (r >= def.maxRank) continue;
      if (def.capstone) {
        if (this.branchRanks(def.branch) >= CAPSTONE_RANKS) out.push({ id: def.id, nextRank: 1 });
        continue;
      }
      pool.push(def.id);
    }
    while (out.length < 3 && pool.length) {
      const id = pool.splice(this.rng.int(pool.length), 1)[0];
      out.push({ id, nextRank: this.rank(id) + 1 });
    }
    const fallbacks: TalentId[] = ['stoke', 'smallHeal'];
    for (const id of fallbacks) if (out.length < 3) out.push({ id, nextRank: this.rank(id) + 1 });
    return out.slice(0, 3);
  }

  private applyTalent(id: TalentId): void {
    const p = this.player;
    if (id === 'smallHeal') {
      p.hp = Math.min(p.maxHp, p.hp + 40);
      return;
    }
    this.talents[id] = this.rank(id) + 1;
    if (id === 'cinderSkin') {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    }
    if (id === 'thickHide') {
      p.maxHp += 30;
      p.hp = Math.min(p.maxHp, p.hp + 30);
    }
  }

  // ---------------------------------------------------------------- end

  private checkEnd(): void {
    if (this.state === 'ended') return;
    if (this.player.hp <= 0 && !this.revived && this.hasMythic('phoenixFeather')) {
      this.revived = true;
      this.player.hp = this.player.maxHp / 2;
      this.events.push({ type: 'revive' });
      return;
    }
    if (this.victory || this.player.hp <= 0) {
      if (this.player.hp <= 0) this.player.hp = 0;
      this.state = 'ended';
      this.events.push({ type: 'end', victory: this.victory });
    }
  }

  // ---------------------------------------------------------------- spatial hash

  private rebuildHash(): void {
    this.head.fill(-1);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const k = cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      this.next[i] = this.head[k];
      this.head[k] = i;
    }
  }

  /** Calls fn for enemies in cells overlapping the square around (x, y). */
  forEachNear(x: number, y: number, r: number, fn: (i: number) => void): void {
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL);
    const y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (let i = this.head[cellKey(cx, cy)]; i !== -1; i = this.next[i]) {
          if (this.enemies[i].alive) fn(i);
        }
      }
    }
  }

  private nearestEnemies(x: number, y: number, n: number, maxDist: number): number[] {
    const best: { i: number; d: number }[] = [];
    const m2 = maxDist * maxDist;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d > m2) continue;
      if (best.length < n) best.push({ i, d });
      else {
        let worst = 0;
        for (let k = 1; k < best.length; k++) if (best[k].d > best[worst].d) worst = k;
        if (d < best[worst].d) best[worst] = { i, d };
      }
    }
    return best.sort((a, b) => a.d - b.d).map((b) => b.i);
  }

  private randomEnemyNear(x: number, y: number, maxDist: number): number {
    const cands: number[] = [];
    const m2 = maxDist * maxDist;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive && dist2(x, y, e.x, e.y) <= m2) cands.push(i);
    }
    return cands.length ? cands[this.rng.int(cands.length)] : -1;
  }
}

export function xpFor(level: number): number {
  return Math.round(4 + level * 2 + Math.pow(level, 1.35));
}

export const VEIN_TIME = 1.2;
export const QUENCH_RANGE = 520;
const ACOLYTE_RING = 190;
/** Share of the boss's health each acolyte restores per second. */
const ACOLYTE_HEAL = 0.008;

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function cellKey(cx: number, cy: number): number {
  return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & (HASH_SIZE - 1);
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function segDist2(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return dist2(px, py, x1 + vx * t, y1 + vy * t);
}
