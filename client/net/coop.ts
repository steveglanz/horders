/**
 * Co-op session: the glue between a Party (WebRTC links) and a running delve.
 *
 * Host: runs the only stepping World with every hero in it, takes each guest's
 * movement (fast channel) and ability presses and draft picks (reliable
 * channel), and sends snapshots (fast channel, about 15 a second).
 * Guest: sends input, draws the newest snapshot in a mirror World built from
 * the same options (sim/netsync.ts).
 */
import { Party, Member, partyCode } from './party';
import { Signal, localSignal, supabaseSignal } from './signal';
import { Input, SimEvent, World, WorldOptions, HeroOptions, TICK } from '../../sim/world';
import { Snapshot, snapshot } from '../../sim/netsync';

/** What a guest tells the host about their hero, once linked. */
export interface HeroCard {
  name: string;
  cls: NonNullable<HeroOptions['cls']>;
  level: number;
  gear: NonNullable<HeroOptions['gear']>;
  passives: NonNullable<HeroOptions['passives']>;
  /** Slagbinder stance; older clients send none (Bellows). */
  stance?: HeroOptions['stance'];
}

type Msg =
  | { t: 'hero'; hero: HeroCard }
  | { t: 'roster'; members: { id: string; hero: HeroCard }[] }
  | { t: 'start'; opts: WorldOptions; order: string[] }
  | { t: 'in'; x: number; y: number }
  | { t: 'cast'; slot: number }
  | { t: 'pick'; i: number }
  | { t: 'snap'; s: Snapshot }
  | { t: 'menu' };

/** Snapshots go out every this many host ticks (30 ticks a second). */
const SNAP_TICKS = 2;
/** A guest's ability press waits this many ticks (0.35s) for the global cooldown, as solo presses do. */
const QUEUE_TICKS = 11;

export interface CoopEvents {
  /** The party's heroes changed (joins, leaves, hero cards). */
  onRoster?: () => void;
  /** Guest: the host started a delve. `me` is your hero's index in it. */
  onStart?: (opts: WorldOptions, me: number) => void;
  /** Guest: the host went back to the menu or left. */
  onEnded?: (reason: 'menu' | 'hostLeft' | 'refused') => void;
}

export function makeSignal(code: string, url: string, key: string): Signal {
  // ?localparty=1: same-browser tabs (and automated checks) without the network.
  return new URLSearchParams(location.search).has('localparty') ? localSignal(code) : supabaseSignal(url, key, code);
}

export class CoopSession {
  readonly party: Party;
  /** Hero cards by member id (host: everyone; guest: from the host's roster). */
  readonly heroes = new Map<string, HeroCard>();
  /** Host: member ids in hero order for the running delve (hero i+1 is order[i]). */
  order: string[] = [];
  /** Guest: your hero index in the running delve. */
  me = 0;
  /** Host: a delve is under way (guests can only join between delves). */
  running = false;
  private inputs = new Map<string, Input>();
  /** Pending ability presses: held up to QUEUE_TICKS until they fire, like the solo spell queue. */
  private casts = new Map<string, { slot: number; ticks: number; cd: number }>();
  private picks: { id: string; i: number }[] = [];
  private gone = new Set<string>();
  private events: SimEvent[] = [];
  private lastSnapTick = -1;
  private lastSnapAt = 0;
  private latest: Snapshot | null = null;
  private fresh = false;

  constructor(
    readonly code: string,
    readonly role: 'host' | 'guest',
    readonly mine: HeroCard,
    signal: Signal,
    readonly events_: CoopEvents = {},
  ) {
    this.party = new Party(signal, role, { name: mine.name, cls: mine.cls }, {
      onJoin: (m) => this.onJoin(m),
      onLeave: (id) => this.onLeave(id),
      onMessage: (from, _ch, data) => this.onMessage(from, data as Msg),
      onRefused: () => this.events_.onEnded?.('refused'),
    });
  }

  static host(mine: HeroCard, url: string, key: string, ev: CoopEvents): CoopSession {
    const code = partyCode();
    const s = new CoopSession(code, 'host', mine, makeSignal(code, url, key), ev);
    void s.party.start();
    return s;
  }

  static join(code: string, mine: HeroCard, url: string, key: string, ev: CoopEvents): CoopSession {
    const c = code.trim().toUpperCase();
    const s = new CoopSession(c, 'guest', mine, makeSignal(c, url, key), ev);
    void s.party.start();
    return s;
  }

  /** Everyone in the party with a hero card, you first. */
  get roster(): { id: string; hero: HeroCard; you: boolean }[] {
    const out = [{ id: this.party.id, hero: this.mine, you: true }];
    for (const [id, hero] of this.heroes) if (id !== this.party.id) out.push({ id, hero, you: false });
    return out;
  }

  close(): void {
    this.party.close();
  }

  // ------------------------------------------------------------- host side

  /** Host: the party option for World, and tells guests to start. */
  startRun(opts: WorldOptions): WorldOptions {
    this.order = this.party.members.map((m) => m.id).filter((id) => this.heroes.has(id));
    const party: HeroOptions[] = this.order.map((id) => {
      const h = this.heroes.get(id)!;
      return { cls: h.cls, stance: h.stance, gear: h.gear, passives: h.passives, name: h.name };
    });
    const full: WorldOptions = { ...opts, heroName: this.mine.name, party, partySize: 1 + party.length };
    this.inputs.clear();
    this.casts.clear();
    this.picks = [];
    this.gone.clear();
    this.events = [];
    this.lastSnapTick = -1;
    this.running = true;
    this.party.broadcast('rel', { t: 'start', opts: full, order: this.order } satisfies Msg);
    return full;
  }

  /** Host: inputs for heroes 1..n this tick (a press is used once). */
  remoteInputs(w: World): Input[] {
    return this.order.map((id, k) => {
      const i = this.inputs.get(id) ?? { x: 0, y: 0 };
      const c = this.casts.get(id);
      if (!c) return { x: i.x, y: i.y };
      c.cd = w.heroData(k + 1).player.cds[c.slot] ?? 0;
      return { x: i.x, y: i.y, cast: c.slot };
    });
  }

  /** Host: after each step, keep the tick's events for the next snapshot. */
  afterStep(w: World): void {
    for (const e of w.events) this.events.push(e);
    // A press is done once its ability went on cooldown, or after the queue window.
    this.order.forEach((id, k) => {
      const c = this.casts.get(id);
      if (!c) return;
      if ((w.heroData(k + 1).player.cds[c.slot] ?? 0) > c.cd || --c.ticks <= 0) this.casts.delete(id);
    });
  }

  /** Host, every frame: apply guest picks, cover for departed guests, send a snapshot when due. */
  frame(w: World, now: number): void {
    for (const p of this.picks.splice(0)) {
      const h = this.order.indexOf(p.id) + 1;
      if (h > 0 && w.state === 'draft') w.choose(p.i, h);
    }
    // A guest who left can't pick: take their first card so the party isn't stuck.
    if (w.state === 'draft') {
      this.order.forEach((id, k) => {
        if (this.gone.has(id) && w.choicesOf(k + 1).length) w.choose(0, k + 1);
      });
    }
    const due = w.tick - this.lastSnapTick >= SNAP_TICKS || now - this.lastSnapAt > 200;
    if (!due || !this.party.members.length) return;
    this.lastSnapTick = w.tick;
    this.lastSnapAt = now;
    const s = snapshot(w, this.events);
    this.events = [];
    this.party.broadcast('fast', { t: 'snap', s } satisfies Msg);
  }

  /** Host: back to the menu; guests follow. */
  endRun(): void {
    this.running = false;
    this.party.broadcast('rel', { t: 'menu' } satisfies Msg);
  }

  // ------------------------------------------------------------ guest side

  sendInput(x: number, y: number): void {
    this.party.broadcast('fast', { t: 'in', x, y } satisfies Msg);
  }

  sendCast(slot: number): void {
    this.party.broadcast('rel', { t: 'cast', slot } satisfies Msg);
  }

  sendPick(i: number): void {
    this.party.broadcast('rel', { t: 'pick', i } satisfies Msg);
  }

  /** Guest: the newest snapshot not yet drawn, if any. */
  take(): Snapshot | null {
    if (!this.fresh) return null;
    this.fresh = false;
    return this.latest;
  }

  // -------------------------------------------------------------- plumbing

  private onJoin(m: Member): void {
    // Each side introduces its hero; the host then shares the whole roster.
    this.party.send(m.id, 'rel', { t: 'hero', hero: this.mine } satisfies Msg);
    this.events_.onRoster?.();
  }

  private onLeave(id: string): void {
    if (this.role === 'guest') {
      this.events_.onEnded?.('hostLeft');
      return;
    }
    this.heroes.delete(id);
    this.gone.add(id);
    this.inputs.delete(id);
    this.shareRoster();
    this.events_.onRoster?.();
  }

  private shareRoster(): void {
    if (this.role !== 'host') return;
    const members = this.roster.map((r) => ({ id: r.id, hero: r.hero }));
    this.party.broadcast('rel', { t: 'roster', members } satisfies Msg);
  }

  private onMessage(from: string, m: Msg): void {
    switch (m.t) {
      case 'hero':
        this.heroes.set(from, m.hero);
        this.shareRoster();
        this.events_.onRoster?.();
        break;
      case 'roster':
        if (this.role !== 'guest') break;
        this.heroes.clear();
        for (const r of m.members) if (r.id !== this.party.id) this.heroes.set(r.id, r.hero);
        this.events_.onRoster?.();
        break;
      case 'start':
        if (this.role !== 'guest') break;
        this.me = m.order.indexOf(this.party.id) + 1;
        this.latest = null;
        this.fresh = false;
        if (this.me > 0) this.events_.onStart?.(m.opts, this.me);
        break;
      case 'in':
        if (Number.isFinite(m.x) && Number.isFinite(m.y)) this.inputs.set(from, { x: Math.max(-1, Math.min(1, m.x)), y: Math.max(-1, Math.min(1, m.y)) });
        break;
      case 'cast':
        if (Number.isInteger(m.slot) && m.slot >= 0 && m.slot < 4) this.casts.set(from, { slot: m.slot, ticks: QUEUE_TICKS, cd: 0 });
        break;
      case 'pick':
        if (Number.isInteger(m.i) && m.i >= 0 && m.i < 3) this.picks.push({ id: from, i: m.i });
        break;
      case 'snap':
        if (this.role === 'guest' && (!this.latest || m.s.tick >= this.latest.tick)) {
          this.latest = m.s;
          this.fresh = true;
        }
        break;
      case 'menu':
        if (this.role === 'guest') this.events_.onEnded?.('menu');
        break;
    }
  }
}

/** Seconds between snapshots at the host's tick rate (for guest smoothing). */
export const SNAP_SECONDS = SNAP_TICKS * TICK;
