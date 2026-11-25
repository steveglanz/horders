import { describe, expect, it } from 'vitest';
import { World, WorldOptions, SimEvent } from '../sim/world';
import { botInput } from '../sim/bot';
import { applySnapshot, heardEvents, snapshot, Snapshot, trimRecent, withHeard } from '../sim/netsync';

const opts: WorldOptions = { seed: 21, party: [{ cls: 'bulwark' }, { cls: 'lumen' }] };

/** Plays the host with bots, mirroring into a guest every 2 ticks through JSON. */
function play(seconds: number, me = 1) {
  const host = new World(opts);
  const guest = new World(opts);
  let events: SimEvent[] = [];
  let biggest = 0;
  let last: Snapshot | null = null;
  while (host.state !== 'ended' && host.time < seconds) {
    if (host.state === 'draft') {
      const h = host.heroes.findIndex((_, i) => host.choicesOf(i).length > 0);
      host.choose(0, Math.max(0, h));
    } else {
      host.step(host.heroes.map(() => botInput(host)));
      events.push(...host.events);
    }
    if (host.tick % 2 === 0) {
      const text = JSON.stringify(snapshot(host, events));
      biggest = Math.max(biggest, text.length);
      events = [];
      last = JSON.parse(text) as Snapshot;
      applySnapshot(guest, last, me);
    }
  }
  const text = JSON.stringify(snapshot(host, events));
  applySnapshot(guest, JSON.parse(text), me);
  return { host, guest, biggest, last };
}

describe('co-op snapshots', () => {
  it('a guest mirror matches the host after a long fight', () => {
    const { host, guest } = play(90);
    expect(guest.tick).toBe(host.tick);
    expect(guest.time).toBeCloseTo(host.time, 6);
    expect(guest.state).toBe(host.state);
    expect(guest.phase).toBe(host.phase);
    expect(guest.encounter).toBe(host.encounter);
    expect(guest.kills).toBe(host.kills);
    const alive = (w: World) => w.enemies.filter((e) => e.alive).length;
    expect(alive(guest)).toBe(alive(host));
    host.enemies.forEach((e, i) => {
      if (!e.alive) return;
      const g = guest.enemies[i];
      expect(g.kind).toBe(e.kind);
      expect(g.def).toBe(e.def);
      expect(g.x).toBeCloseTo(e.x, 1);
      expect(g.hp).toBeCloseTo(e.hp, 1);
    });
  });

  it('the guest sees the run as their own hero', () => {
    const { host, guest } = play(30, 2);
    expect(guest.cls).toBe('lumen');
    expect(guest.player.x).toBeCloseTo(host.hero(2).player.x, 6);
    expect(guest.player.hp).toBeCloseTo(host.hero(2).player.hp, 6);
    expect(guest.talents).toEqual(host.hero(2).talents);
    expect(guest.hero(0).player.x).toBeCloseTo(host.player.x, 6);
  });

  it("carries the host's events and draft cards", () => {
    const host = new World(opts);
    const guest = new World(opts);
    host.hero(1).player.pendingLevels = 1;
    (host as unknown as { openDraftAll(): void }).openDraftAll();
    applySnapshot(guest, JSON.parse(JSON.stringify(snapshot(host, [{ type: 'levelUp', level: 2 }]))), 1);
    expect(guest.state).toBe('draft');
    expect(guest.choices).toEqual(host.choicesOf(1));
    expect(guest.events).toEqual([{ type: 'levelUp', level: 2 }]);
  });

  it('stays small enough for a data channel', () => {
    const { biggest } = play(120);
    // SCTP data channels carry up to 64 KiB reliably across browsers; unreliable
    // messages should stay well under that so one lost fragment rarely drops a frame.
    expect(biggest).toBeLessThan(48_000);
    console.log('largest snapshot', biggest, 'bytes');
  });
});

describe('co-op events survive a lost snapshot and a slow guest frame', () => {
  // As client/net/coop.ts: the host sends each tick's events with its snapshots until one RESEND_TICKS later has gone
  // out (Snapshot.recent, trimRecent); the guest keeps every snapshot's batches it hears (heardEvents) and, at each of
  // its frames, applies the newest snapshot with all of them (withHeard). `snapEvery`: host ticks per snapshot (a host
  // frame sends at most one, so a 250 ms host frame is 8 or 9 ticks).
  function run(frameEvery: number, snapEvery = 2) {
    const host = new World(opts);
    const guest = new World(opts);
    const batches: { tick: number; events: SimEvent[] }[] = [];
    const heard = new Map<number, SimEvent[]>();
    const sent: string[] = [], got: string[] = [];
    let biggest = 0, n = 0, latest: Snapshot | null = null, sentTick = -1, prevSent = -1;
    while (host.state !== 'ended' && host.time < 120) {
      if (host.state === 'draft') {
        const h = host.heroes.findIndex((_, i) => host.choicesOf(i).length > 0);
        host.choose(0, Math.max(0, h));
      } else {
        host.step(host.heroes.map(() => botInput(host)));
        for (const e of host.events) sent.push(JSON.stringify(e));
        if (host.events.length) batches.push({ tick: host.tick, events: [...host.events] });
        trimRecent(batches, host.tick, prevSent);
      }
      if (host.tick % snapEvery === 0 && host.tick !== sentTick) {
        prevSent = sentTick;
        sentTick = host.tick;
        const text = JSON.stringify(snapshot(host, [], batches));
        biggest = Math.max(biggest, text.length);
        // Lose one snapshot in three (never two in a row).
        if (++n % 3 !== 0) {
          const s = JSON.parse(text) as Snapshot;
          heardEvents(heard, s);
          if (!latest || s.tick >= latest.tick) latest = s;
        }
      }
      // The guest's frame: only every `frameEvery` host ticks.
      if (host.tick % frameEvery === 0 && latest) {
        applySnapshot(guest, withHeard(latest, heard), 1);
        latest = null;
        for (const e of guest.events) got.push(JSON.stringify(e));
      }
    }
    if (latest) { applySnapshot(guest, withHeard(latest, heard), 1); for (const e of guest.events) got.push(JSON.stringify(e)); }
    const tail = batches.reduce((k, b) => k + b.events.length, 0);
    return { sent, got, tail, biggest };
  }

  for (const frameEvery of [2, 12, 30]) it(`a guest drawing a frame every ${frameEvery} host ticks plays every host event once, in order`, () => {
    const { sent, got, tail, biggest } = run(frameEvery);
    expect(sent.length).toBeGreaterThan(100);
    expect(got.length).toBeGreaterThanOrEqual(sent.length - tail);
    expect(got).toEqual(sent.slice(0, got.length));
    expect(biggest).toBeLessThan(48_000);
  });

  // QA, 25 Nov (Flue, four tabs): a slow host frame of 8 or more ticks lost the first tick since the last snapshot, so
  // guests heard 2 of 3 grate lifts. Every host frame here is that slow, and one snapshot in three is still lost.
  for (const snapEvery of [8, 9]) it(`a host sending a snapshot every ${snapEvery} ticks (a 250 ms frame) still gets every event to the guest`, () => {
    const { sent, got, tail, biggest } = run(snapEvery, snapEvery);
    expect(sent.length).toBeGreaterThan(100);
    expect(got.length).toBeGreaterThanOrEqual(sent.length - tail);
    expect(got).toEqual(sent.slice(0, got.length));
    expect(biggest).toBeLessThan(48_000);
  });
});

describe('H4: hosted co-op stays in step on a Halls map', () => {
  for (const [dungeon, tier] of [['hammerdeep', 4], ['ashvents', 7], ['pressworks', 10]] as const) it(`a guest mirror of a ${dungeon} map run has the host's packs, grates, rooms seen, foes and heroes`, () => {
    const o: WorldOptions = { seed: 5, tier, dungeon, halls: true, hallsBeta: true, cls: 'bulwark', party: [{ cls: 'lumen' }, { cls: 'duskblade' }] };
    const host = new World(o);
    const guest = new World(o);
    expect(host.halls).toBeTruthy();
    expect(JSON.stringify(guest.halls!.rooms.map((r) => [r.x, r.y, r.r, r.theme]))).toBe(JSON.stringify(host.halls!.rooms.map((r) => [r.x, r.y, r.r, r.theme])));
    let events: SimEvent[] = [];
    let sealedSeen = 0, wokeSeen = 0;
    const check = () => {
      const hm = host.halls!, gm = guest.halls!;
      expect(gm.packs.map((p) => p.state)).toEqual(hm.packs.map((p) => p.state));
      expect(gm.rooms.map((r) => r.lock ?? -1)).toEqual(hm.rooms.map((r) => r.lock ?? -1));
      expect(gm.seen).toEqual(hm.seen);
      expect(guest.hallsOn).toBe(host.hallsOn);
      expect(guest.phase).toBe(host.phase);
      host.enemies.forEach((e, i) => { if (e.alive) expect(guest.enemies[i].x).toBeCloseTo(e.x, 1); });
      host.heroes.forEach((_, i) => expect(guest.hero(i).player.x).toBeCloseTo(host.hero(i).player.x, 1));
      if (hm.rooms.some((r) => (r.lock ?? -1) >= 0)) sealedSeen++;
      if (hm.packs.some((p) => p.state === 'awake')) wokeSeen++;
    };
    while (host.state !== 'ended' && host.time < 240 && host.hallsOn) {
      if (host.state === 'draft') {
        const h = host.heroes.findIndex((_, i) => host.choicesOf(i).length > 0);
        host.choose(0, Math.max(0, h));
      } else {
        host.step(host.heroes.map((_, i) => { host.use(i); const inp = botInput(host); host.use(0); return inp; }));
        events.push(...host.events);
      }
      if (host.tick % 2 === 0) {
        applySnapshot(guest, JSON.parse(JSON.stringify(snapshot(host, events))) as Snapshot, 1);
        events = [];
        guest.use(0);
        check();
      }
    }
    expect(sealedSeen).toBeGreaterThan(50);
    expect(wokeSeen).toBeGreaterThan(50);
    expect(host.halls!.packs.some((p) => p.state === 'cleared')).toBe(true);
  }, 60000);
});

