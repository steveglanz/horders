import { describe, expect, it } from 'vitest';
import { World, DIMHORN, NEW_FOES } from '../sim/world';
import { botInput } from '../sim/bot';
import { DUNGEONS, ENCOUNTERS } from '../sim/content/dungeon';

type Inner = { spawn(kind: string, x: number, y: number): number; route: string[] };

/** A Coldmarrow run already in its first fight, every foe cleared, the hero at the centre with a full coal. */
function fight(): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
  const inner = w as unknown as Inner;
  inner.route[0] = 'dimhorn';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  w.player.coal = 1; w.player.coalR = 170;
  return { w, inner };
}
const step = (w: World, n: number) => { for (let k = 0; k < n; k++) w.step({ x: 0, y: 0 }); };
const hounds = (w: World) => w.enemies.filter((e) => e.alive && e.kind === 'rimehound').length;

describe('Phase 16 U2: the Dimhorn (the Coldmarrow)', () => {
  it('is a Coldmarrow opener: one Dimhorn and two Snuffers, and a new foe', () => {
    expect(DUNGEONS.coldmarrow.openers).toContain('dimhorn');
    expect(ENCOUNTERS.dimhorn.spawns).toEqual([{ kind: 'dimhorn', n: 1 }, { kind: 'snuffer', n: 2 }]);
    expect(NEW_FOES).toContain('dimhorn');
  });

  it('hangs just outside the coal light, backing off when it is inside', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('dimhorn', 100, 0)];
    step(w, 15);
    expect(e.x).toBeGreaterThan(100);
  });

  it('out in the dark it calls three Rimehounds in from the edge', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('dimhorn', 300, 0)];
    e.aux = DIMHORN.callAt - 0.05;
    step(w, 3);
    expect(e.castId).toBe('darkCall');
    step(w, Math.ceil(DIMHORN.callCast * 30) + 2);
    expect(hounds(w)).toBe(DIMHORN.calls);
    expect(e.aux).toBeLessThan(0.2);
  });

  it('its horn is spent after maxCalls calls', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('dimhorn', 300, 0)];
    e.aux2 = DIMHORN.maxCalls;
    e.aux = DIMHORN.callAt + 1;
    step(w, 3);
    expect(e.castId).toBe('');
  });

  it('inside a coal\'s light its count drains, and a call that ends there is lost', () => {
    const { w, inner } = fight();
    const i = inner.spawn('dimhorn', 60, 0);
    const e = w.enemies[i];
    e.def = { ...e.def, speed: 0 };
    e.aux = 4;
    step(w, 15);
    expect(e.aux).toBeLessThan(4 - DIMHORN.drain * 0.45);
    e.castId = 'darkCall'; e.castName = 'Dark Call'; e.castT = 0; e.castDur = 0.1; e.interruptible = false;
    step(w, 6);
    expect(e.castId).toBe('');
    expect(hounds(w)).toBe(0);
  });

  it('a bot brings its light over a Dimhorn well on its way to calling', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('dimhorn', 0, 320)];
    e.abilityT = 99;
    const calm = botInput(w, 1);
    e.aux = DIMHORN.callAt * 0.6;
    const go = botInput(w, 1);
    const toward = (v: { x: number; y: number }) => v.y / (Math.hypot(v.x, v.y) || 1);
    expect(toward(go)).toBeGreaterThan(toward(calm) + 0.2);
  });
});
