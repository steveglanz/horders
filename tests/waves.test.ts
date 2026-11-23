import { describe, expect, it } from 'vitest';
import { World, WAVES, WAVE_SHAPE_INFO, reinforceCount, wavesIn } from '../sim/world';
import { ENCOUNTERS, type EncounterId } from '../sim/content/dungeon';

type Q = { startEncounter(): void; encounter: number; route: EncounterId[] };
const tiers = { kiln: 2, foundry: 4, glarewell: 7, coldmarrow: 10, wrackline: 13, hammerdeep: 4, ashvents: 7, pressworks: 10, crucible: 8 } as const;
const make = (dungeon: keyof typeof tiers, seed = 1) => new World({ seed, dungeon, tier: tiers[dungeon], omens: [], cls: 'emberwright' });
/** Step `n` ticks and return every event they raised. */
const step = (w: World, n: number) => { const out: World['events'] = []; for (let k = 0; k < n; k++) { w.step({ mx: 0, my: 0 } as never); out.push(...w.events); } return out; };

/** Start `id` as fight 1 with the wave shape forced. */
function fight(id: EncounterId, shape: string, dungeon: keyof typeof tiers = 'kiln'): World {
  const w = make(dungeon);
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  q.route[1] = id;
  q.encounter = 1;
  WAVES.force = shape;
  try { q.startEncounter(); } finally { WAVES.force = ''; }
  return w;
}
const living = (w: World) => w.enemies.filter((e) => e.alive);
/** Each living foe's direction from the hero. */
const angles = (w: World) => living(w).map((e) => Math.atan2(e.y - w.player.y, e.x - w.player.x));
const far = (w: World) => Math.min(...living(w).map((e) => Math.hypot(e.x - w.player.x, e.y - w.player.y)));

describe('Phase 15 Y1: wave shapes', () => {
  it('rolls about its chances in solo and group trash, never in the opener, a boss fight, a raid or the first delve, and is the same every time', () => {
    for (const dg of ['kiln', 'foundry', 'glarewell', 'coldmarrow', 'wrackline', 'hammerdeep', 'ashvents', 'pressworks'] as const) {
      const c: Record<string, number> = { arc: 0, pincer: 0, ring: 0, reinforce: 0 };
      let n = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const w = make(dg, seed);
        for (let k = 0; k < w.route.length; k++) {
          const id = w.route[k];
          const s = w.waveShapeAt(k, id);
          expect(w.waveShapeAt(k, id)).toBe(s);
          if (k === 0 || id === w.dungeonDef.boss || id === 'shrine') { expect(s).toBe('arc'); continue; }
          if (ENCOUNTERS[id].spawns.reduce((a, x) => a + x.n, 0) < 2) continue;
          n++;
          c[s]++;
        }
      }
      expect(c.pincer / n, dg).toBeGreaterThan(WAVES.pincer - 0.07);
      expect(c.pincer / n, dg).toBeLessThan(WAVES.pincer + 0.07);
      expect(c.ring / n, dg).toBeGreaterThan(WAVES.ring - 0.07);
      expect(c.ring / n, dg).toBeLessThan(WAVES.ring + 0.07);
      expect(c.reinforce, dg).toBeGreaterThan(0);
    }
    const raid = make('crucible');
    for (let k = 0; k < raid.route.length; k++) expect(raid.waveShapeAt(k, raid.route[k])).toBe('arc');
    expect(new World({ seed: 1, omens: [], firstDelve: true }).waveShapeAt(0, 'pack')).toBe('arc');
    WAVES.off = true;
    try { expect(make('kiln').waveShapeAt(1, 'pack')).toBe('arc'); } finally { WAVES.off = false; }
  });

  it('a pincer comes from both flanks, a ring from all round, an arc from one side, and none lands on the hero', () => {
    const spread = (w: World) => {
      const a = angles(w);
      const sx = a.reduce((s, x) => s + Math.cos(x), 0), sy = a.reduce((s, x) => s + Math.sin(x), 0);
      return Math.hypot(sx, sy) / a.length; // 1 = all one way, 0 = balanced round the party
    };
    const arc = fight('pack', 'arc'), pin = fight('pack', 'pincer'), ring = fight('pack', 'ring');
    for (const w of [arc, pin, ring]) expect(living(w)).toHaveLength(4);
    expect(spread(arc)).toBeGreaterThan(0.9);
    expect(spread(pin)).toBeLessThan(0.15);
    expect(spread(ring)).toBeLessThan(0.05);
    for (const w of [arc, pin, ring]) expect(far(w)).toBeGreaterThan(300);
    // A hero near the wall still isn't spawned on.
    for (const shape of ['arc', 'pincer', 'ring']) {
      for (const [x, y] of [[480, 0], [0, -480], [-340, 340]]) {
        const w = make('kiln');
        const q = w as unknown as Q;
        for (const e of w.enemies) e.alive = false;
        w.player.x = x; w.player.y = y;
        q.route[1] = 'pack'; q.encounter = 1;
        WAVES.force = shape;
        try { q.startEncounter(); } finally { WAVES.force = ''; }
        expect(far(w), `${shape} ${x},${y}`).toBeGreaterThan(200);
      }
    }
    expect(pin.events).toContainEqual(expect.objectContaining({ type: 'waveShape', id: 'pincer', stage: 'start' }));
    expect(arc.events.some((e) => e.type === 'waveShape')).toBe(false);
    expect(wavesIn(pin.wavesMet)).toEqual(['pincer']);
    expect(wavesIn(ring.wavesMet)).toEqual(['ring']);
    expect(arc.wavesMet).toBe(0);
  });

  it('reinforcements hold back up to half the pack, warn, then come from a flank; the fight waits for them', () => {
    expect(reinforceCount(ENCOUNTERS.pack.spawns)).toBe(2);
    expect(reinforceCount(ENCOUNTERS.warpack.spawns)).toBe(1);
    expect(reinforceCount(ENCOUNTERS.wardens.spawns)).toBe(0);
    expect(reinforceCount(ENCOUNTERS.brute.spawns)).toBe(0);
    const w = fight('pack', 'reinforce');
    expect(w.waveShape).toBe('reinforce');
    expect(living(w)).toHaveLength(2);
    expect(w.wavesMet).toBe(0); // met once the warning goes off
    const first = angles(w)[0];
    // Kill the first half at once: the fight doesn't end, and the rest come sooner, with a warning.
    for (const e of w.enemies) e.alive = false;
    w.aliveEnemies = 0;
    const ev = step(w, 5);
    expect(w.phase).toBe('fight');
    expect(w.reinforceN).toBe(2);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'waveShape', id: 'reinforce', stage: 'warn' }));
    expect(wavesIn(w.wavesMet)).toEqual(['reinforce']);
    const ev2 = step(w, Math.ceil(WAVES.reinforceWarn * 30) + 2);
    expect(w.reinforceN).toBe(0);
    expect(ev2).toContainEqual(expect.objectContaining({ type: 'waveShape', id: 'reinforce', stage: 'land' }));
    const late = living(w);
    expect(late).toHaveLength(2);
    for (const e of late) {
      expect(e.kind).toBe('cinderhound');
      const d = Math.abs(((Math.atan2(e.y - w.player.y, e.x - w.player.x) - first + 3 * Math.PI) % (2 * Math.PI)) - Math.PI); // 0 = same side, π = straight across
      expect(d).toBeGreaterThan(Math.PI / 2 - 0.8);
      expect(d).toBeLessThan(Math.PI / 2 + 0.8);
    }
  });

  it('a forced shape that a fight can\'t take stays an arc; every shape has a banner', () => {
    expect(fight('brute', 'pincer').waveShape).toBe('arc');
    expect(fight('wardens', 'reinforce').waveShape).toBe('arc');
    expect(fight('lamps', 'ring', 'glarewell').waveShape).toBe('arc');
    expect(fight('lamps', 'pincer', 'glarewell').waveShape).toBe('arc');
    // Skills' Y5: a pack of 3+ Rimehounds doesn't ring (a pincer still can).
    expect(fight('weaver', 'ring', 'coldmarrow').waveShape).toBe('arc');
    expect(fight('weaver', 'pincer', 'coldmarrow').waveShape).toBe('pincer');
    for (const s of ['pincer', 'ring', 'reinforce'] as const) expect(WAVE_SHAPE_INFO[s].tip.length).toBeGreaterThan(10);
  });
});
