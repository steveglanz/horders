import { describe, expect, it } from 'vitest';
import { World, WorldOptions, SimEvent } from '../sim/world';
import { botInput } from '../sim/bot';
import { applySnapshot, snapshot, Snapshot } from '../sim/netsync';

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
