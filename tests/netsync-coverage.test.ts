import { describe, expect, it } from 'vitest';
import { World, WorldOptions } from '../sim/world';
import { botInput } from '../sim/bot';
import { DUNGEONS, DungeonId } from '../sim/content/dungeon';
import { ARRAYS, NOT_SENT, POOLS, SENT_APART, applySnapshot, snapshot } from '../sim/netsync';

/** A 4-hero party in `dungeon`, stepped by bots for `seconds` (some arrays only fill once a fight starts). */
function run(dungeon: DungeonId, seconds: number): World {
  const opts: WorldOptions = { seed: 5, dungeon, tier: 9, party: [{ cls: 'bulwark' }, { cls: 'lumen' }, { cls: 'duskblade' }], partySize: 4 };
  const w = new World(opts);
  while (w.state !== 'ended' && w.time < seconds) {
    if (w.state === 'draft') { const h = w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0); w.choose(0, Math.max(0, h)); continue; }
    w.step(w.heroes.map(() => botInput(w)));
  }
  return w;
}

const runs = new Map<string, World>();
/** One stepped run per dungeon, shared by the tests below so the suite stays light. */
const ran = (id: DungeonId) => { if (!runs.has(id)) runs.set(id, run(id, 40)); return runs.get(id)!; };

const isList = (v: unknown) => Array.isArray(v) || ArrayBuffer.isView(v) || v instanceof Map || v instanceof Set;

describe('Y2: every array on World reaches guests or is listed as not needed', () => {
  const known = new Set<string>([...POOLS, ...ARRAYS, ...SENT_APART, ...Object.keys(NOT_SENT)]);
  for (const id of Object.keys(DUNGEONS) as DungeonId[]) {
    it(`${id}: no unlisted arrays`, () => {
      for (const w of [new World({ seed: 5, dungeon: id, tier: 9, party: [{ cls: 'bulwark' }], partySize: 2 }), ran(id)]) {
        const W = w as unknown as Record<string, unknown>;
        const missing = Object.keys(W).filter((k) => isList(W[k]) && !known.has(k));
        // Add a new array to ARRAYS or POOLS in sim/netsync.ts (or to NOT_SENT with the reason a guest doesn't need it).
        expect(missing, `unsynced arrays on World in ${id}`).toEqual([]);
      }
    });
  }

  it('every listed name is a real field, so the lists stay honest', () => {
    const seen = new Set<string>();
    for (const id of Object.keys(DUNGEONS) as DungeonId[]) for (const k of Object.keys(ran(id))) seen.add(k);
    for (const k of known) expect(seen.has(k), k).toBe(true);
  });
});

describe('Y2: dungeon arrays a guest draws are mirrored', () => {
  /** Host state copied to a fresh mirror through JSON, as the network does. */
  const mirror = (host: World) => {
    const guest = new World({ seed: 5, dungeon: host.dungeonId, tier: 9, party: [{ cls: 'bulwark' }, { cls: 'lumen' }, { cls: 'duskblade' }], partySize: 4 });
    applySnapshot(guest, JSON.parse(JSON.stringify(snapshot(host))), 1);
    return guest;
  };

  it('the Wrackline rafts drift on the guest as on the host', () => {
    const host = ran('wrackline');
    expect(host.rafts.length).toBeGreaterThan(0);
    const fresh = new World({ seed: 5, dungeon: 'wrackline', tier: 9, party: [{ cls: 'bulwark' }], partySize: 2 });
    expect(JSON.stringify(host.rafts)).not.toBe(JSON.stringify(fresh.rafts)); // they really moved
    expect(mirror(host).rafts).toEqual(host.rafts);
  });

  it('a cracked Glarewell pillar shows cracked on the guest', () => {
    const host = ran('glarewell');
    expect(host.pillars.length).toBeGreaterThan(0);
    host.pillars[0].cracked = true;
    expect(mirror(host).pillars[0].cracked).toBe(true);
  });
});
