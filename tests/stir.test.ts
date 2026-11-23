import { describe, expect, it, vi } from 'vitest';
import { World, STIR, STIR_BIT, STIR_INFO, STIR_IDS, ARENA_EVENT_POOLS } from '../sim/world';
import type { EncounterId } from '../sim/content/dungeon';

type Q = {
  startEncounter(): void; countStir(id: EncounterId): void; clearEncounterFor(def: unknown): void; dropLoot(...a: unknown[]): void;
  encounter: number; route: EncounterId[]; namedAt: number;
};
const make = (dungeon: 'kiln' | 'foundry' | 'coldmarrow' | 'hammerdeep' | 'crucible', tier: number, extra: object = {}) =>
  new World({ seed: 1, dungeon, tier, omens: [], cls: 'emberwright', ...extra });

/** Start `id` as fight 2 with `reaction` forced. */
function fight(id: EncounterId, reaction: string, dungeon: 'kiln' | 'foundry' = 'foundry'): World {
  const w = make(dungeon, 4);
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  q.route[2] = id;
  q.encounter = 2;
  STIR.force = reaction;
  try { q.startEncounter(); } finally { STIR.force = ''; }
  return w;
}
const living = (w: World) => w.enemies.filter((e) => e.alive);

describe('Phase 15 Y10: the dungeon stirs', () => {
  it('is on from tier 4 in solo and group dungeons, off on the first delve, in raids, novice tiers and with fill bots', () => {
    expect(make('foundry', 4).stirOn).toBe(true);
    expect(make('kiln', 3).stirOn).toBe(false);
    expect(make('crucible', 8).stirOn).toBe(false);
    expect(new World({ seed: 1, omens: [], firstDelve: true }).stirOn).toBe(false);
    const g = { seed: 1, dungeon: 'hammerdeep' as const, tier: 8, omens: [], party: [{ cls: 'lumen' as const }, { cls: 'duskblade' as const }] };
    expect(new World(g).stirOn).toBe(true);
    expect(new World({ ...g, fillBots: 1 }).stirOn).toBe(false);
    STIR.off = true;
    try { expect(make('foundry', 4).stirOn).toBe(false); } finally { STIR.off = false; }
  });

  it('two clean clears stir the next trash fight; a rough one or a hero down sets the count back', () => {
    const w = make('foundry', 4);
    const q = w as unknown as Q;
    const clear = (hurt: number, down = false) => { w.fightHurt = hurt; w.fightDown = down; q.countStir('pack'); };
    clear(0.05);
    expect(w.stirCount).toBe(1);
    clear(0.6);
    expect(w.stirCount).toBe(0);
    clear(0.1); clear(0.3); // a middling fight neither builds nor resets
    expect(w.stirCount).toBe(1);
    clear(0.0, true);
    expect(w.stirCount).toBe(0);
    clear(0.1); clear(0.1);
    expect(w.stirNext).toBe(true);
    // The boss and shrines don't count either way.
    q.countStir(w.dungeonDef.boss as EncounterId);
    expect(w.stirNext).toBe(true);
    // At the cap, no more.
    w.stirNext = false; w.stirs = STIR.max;
    clear(0.1); clear(0.1);
    expect(w.stirNext).toBe(false);
  });

  it('each reaction does what it says, and a stirred fight drops a second bag', () => {
    const base = living(fight('pack', 'none-such')).length;
    const elite = fight('pack', 'elite');
    expect(elite.stir).toBe('elite');
    expect(living(elite)).toHaveLength(base + 1);
    expect(elite.events).toContainEqual({ type: 'stir', id: 'elite' });
    expect(elite.stirsMet).toBe(STIR_BIT.elite);

    const ev = fight('pack', 'event');
    expect(ev.stir).toBe('event');
    expect(ARENA_EVENT_POOLS.foundry).toContain(ev.arenaEvent);

    const wave = fight('pack', 'wave');
    expect(['pincer', 'ring']).toContain(wave.waveShape);

    const named = fight('wardens', 'named');
    if (named.stir === 'named') expect(named.enemies.some((e) => e.alive && e.named >= 0)).toBe(true);

    const q = elite as unknown as Q;
    const spy = vi.spyOn(q, 'dropLoot');
    q.clearEncounterFor({ id: 'pack' });
    expect(spy).toHaveBeenCalledTimes(2);
    const plain = fight('pack', '') as unknown as Q;
    const spy2 = vi.spyOn(plain, 'dropLoot');
    plain.clearEncounterFor({ id: 'pack' });
    expect(spy2).toHaveBeenCalledTimes(1);
  });

  it('never stirs the opener or the boss, and every reaction has a banner line', () => {
    const w = make('foundry', 4);
    const q = w as unknown as Q;
    for (const e of w.enemies) e.alive = false;
    q.encounter = 0;
    STIR.force = 'any';
    try { q.startEncounter(); } finally { STIR.force = ''; }
    expect(w.stir).toBe('');
    const b = make('foundry', 4);
    const qb = b as unknown as Q;
    qb.encounter = b.route.length - 1;
    STIR.force = 'any';
    try { qb.startEncounter(); } finally { STIR.force = ''; }
    expect(b.stir).toBe('');
    for (const id of STIR_IDS) expect(STIR_INFO[id].tip.length).toBeGreaterThan(10);
  });
});
