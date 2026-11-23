import { describe, expect, it } from 'vitest';
import { World, ARENA_EVENT_ORDER, ARENA_EVENT_POOLS, ARENA_EVENTS } from '../sim/world';
import { DUNGEON_IDS } from '../sim/content/dungeon';
import { HEAT_POOLS } from '../sim/content/heat';
import { AFFIXES, NAMED } from '../sim/content/named';
import { botChoose, botInput } from '../sim/bot';
import { newHero } from '../sim/hero';
import { BOSS_VERSION_NAME } from '../sim/runshape';
import { BOSS_VERSIONS, metIn, recordSeen, seenIn, seenKey, seenPool } from '../sim/seen';
import { applySnapshot, snapshot } from '../sim/netsync';

type Q = { encounter: number; rollLayout(id: string): void; rollArenaEvent(id: string): void; arenaEventClock(dt: number): void };

/** Plays `w` with the bot until `done` holds or the run ends. */
function play(w: World, done: () => boolean, maxSeconds = 700): void {
  while (!done() && w.state !== 'ended' && w.time < maxSeconds) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
}

describe('Phase 15 Y4: the Seen log', () => {
  it('lists, for every dungeon, its boss versions, the named-foe traits, its events and its Heats, each named', () => {
    for (const d of DUNGEON_IDS) {
      const pool = seenPool(d);
      expect(pool.filter((e) => e.kind === 'boss').map((e) => e.id), d).toEqual([...BOSS_VERSIONS[d]]);
      expect(pool.filter((e) => e.kind === 'mark').map((e) => e.id), d).toEqual([...AFFIXES]);
      expect(pool.filter((e) => e.kind === 'event').map((e) => e.id), d).toEqual(ARENA_EVENT_POOLS[d] ?? []);
      expect(pool.filter((e) => e.kind === 'heat').map((e) => e.id), d).toEqual(HEAT_POOLS[d] ?? []);
      for (const e of pool) {
        expect(e.name, `${d} ${e.id}`).toBeTruthy();
        expect(e.tip, `${d} ${e.id}`).toBeTruthy();
      }
      for (const v of BOSS_VERSIONS[d]) expect(BOSS_VERSION_NAME[v], v).toBeTruthy();
    }
    // The Kiln: 2 boss versions, 5 traits, 2 events, 4 Heats.
    expect(seenPool('kiln')).toHaveLength(13);
  });

  it('a run counts the boss version only once the boss has rolled it, and never changes the run', () => {
    // A boss-only route, so the boss comes up in seconds (two full delves ran past CI's 5 s test limit).
    const opts = { seed: 5, dungeon: 'kiln' as const, tier: 3, omens: [], cls: 'emberwright' as const, route: ['kilnMother' as const] };
    const w = new World(opts);
    expect(metIn(w).some((k) => k.startsWith('kiln:boss:'))).toBe(false);
    const ref = new World(opts);
    play(w, () => !!w.bossVariant);
    play(ref, () => !!ref.bossVariant);
    expect(w.bossVariant).not.toBe('');
    for (let k = 0; k < 50; k++) metIn(w);
    expect(w.hash()).toBe(ref.hash());
    expect(metIn(w)).toContain(seenKey('kiln', 'boss', w.bossVariant));
  });

  it('counts a named foe only once it has spawned, with its trait', () => {
    const was = { ...NAMED };
    NAMED.forceNamed = 1;
    NAMED.forceAffix = AFFIXES.indexOf('Brood');
    try {
      const w = new World({ seed: 8, dungeon: 'kiln', tier: 3, omens: [], cls: 'emberwright' });
      expect(w.namedPlan()?.affix).toBe('Brood');
      expect(metIn(w).some((k) => k.includes(':mark:'))).toBe(false);
      play(w, () => w.namedMet >= 0);
      expect(metIn(w)).toContain('kiln:mark:Brood');
    } finally {
      Object.assign(NAMED, was);
    }
  });

  it('counts an arena event once its warning goes off, not when it is only planned', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 3, omens: [], cls: 'emberwright' });
    const q = w as unknown as Q;
    ARENA_EVENTS.force = 'ventSurge';
    try { q.encounter = 1; q.rollLayout('pack'); q.rollArenaEvent('pack'); } finally { ARENA_EVENTS.force = ''; }
    expect(w.arenaEvent).toBe('ventSurge');
    expect(metIn(w)).not.toContain('kiln:event:ventSurge');
    q.arenaEventClock(w.arenaEventT + 0.01);
    expect(metIn(w)).toContain('kiln:event:ventSurge');
    // Every event id has its own bit.
    expect(new Set(ARENA_EVENT_ORDER).size).toBe(ARENA_EVENT_ORDER.length);
    for (const d of DUNGEON_IDS) for (const e of ARENA_EVENT_POOLS[d] ?? []) expect(ARENA_EVENT_ORDER, e).toContain(e);
  });

  it('counts the run\'s Heat', () => {
    const w = new World({ seed: 9, dungeon: 'foundry', tier: 5, omens: [], cls: 'emberwright', heat: 'thickSteam' });
    expect(w.heat).toBe('thickSteam');
    expect(metIn(w)).toContain('foundry:heat:thickSteam');
  });

  it('records each key once on the hero, returns only first meetings, and counts by dungeon', () => {
    const h = newHero();
    expect(recordSeen(h, ['kiln:boss:draw', 'kiln:heat:richHaul', 'kiln:boss:draw'])).toEqual(['kiln:boss:draw', 'kiln:heat:richHaul']);
    expect(recordSeen(h, ['kiln:boss:draw', 'kiln:mark:Swift'])).toEqual(['kiln:mark:Swift']);
    expect(h.seen).toEqual(['kiln:boss:draw', 'kiln:heat:richHaul', 'kiln:mark:Swift']);
    const kiln = seenIn(h, 'kiln');
    expect(kiln.seen).toBe(3);
    expect(kiln.total).toBe(13);
    expect(kiln.entries.find((e) => e.id === 'draw')?.seen).toBe(true);
    expect(kiln.entries.find((e) => e.id === 'cataclysm')?.seen).toBe(false);
    expect(seenIn(h, 'foundry').seen).toBe(0);
    // A save from JSON keeps it.
    expect(JSON.parse(JSON.stringify(h)).seen).toEqual(h.seen);
  });

  it('a co-op guest meets what the host met, through the snapshot', () => {
    const w = new World({ seed: 21, dungeon: 'kiln', tier: 3, omens: [], cls: 'emberwright', party: [{ cls: 'lumen', name: 'Lumen' }] });
    w.bossVariant = 'cataclysm';
    w.namedMet = AFFIXES.indexOf('Smoldering');
    w.arenaEventsMet = 1 << ARENA_EVENT_ORDER.indexOf('caveIn');
    const g = new World({ seed: 99, dungeon: 'kiln', tier: 3, omens: [], cls: 'lumen', party: [{ cls: 'emberwright', name: 'Emberwright' }] });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(metIn(g).sort()).toEqual(metIn(w).sort());
    expect(metIn(g)).toEqual(expect.arrayContaining(['kiln:boss:cataclysm', 'kiln:mark:Smoldering', 'kiln:event:caveIn']));
  });
});
