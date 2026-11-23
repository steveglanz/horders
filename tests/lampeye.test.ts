import { describe, expect, it } from 'vitest';
import { World, LAMPEYE, NEW_FOES } from '../sim/world';
import { botInput } from '../sim/bot';
import { DUNGEONS, ENCOUNTERS } from '../sim/content/dungeon';

type Inner = { spawn(kind: string, x: number, y: number): number; route: string[] };

/** A Glarewell run already in its first fight, every foe cleared, with one pillar at (200, 0) that a test can hide behind. */
function fight(cls: 'emberwright' | 'duskblade' = 'emberwright'): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'glarewell', tier: 4, omens: [], cls });
  const inner = w as unknown as Inner;
  inner.route[0] = 'lampeye';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.pillars = [{ x: 200, y: 0, r: 40, cracked: false }];
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}
const step = (w: World, n: number) => { for (let k = 0; k < n; k++) w.step({ x: 0, y: 0 }); };

describe('Phase 16 U2: the Lampeye (the Glarewell)', () => {
  it('is a Glarewell opener: one Lampeye and three Shades, and a new foe', () => {
    expect(DUNGEONS.glarewell.openers).toContain('lampeye');
    expect(ENCOUNTERS.lampeye.spawns).toEqual([{ kind: 'lampeye', n: 1 }, { kind: 'shade', n: 3 }]);
    expect(NEW_FOES).toContain('lampeye');
  });

  it('sees past a pillar off the line, and not through one on it', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('lampeye', 400, 0)];
    expect(w.lampeyeSees(e, 0, 0)).toBe(false);
    expect(w.lampeyeSees(e, 0, 200)).toBe(true);
    w.pillars[0].cracked = true;
    expect(w.lampeyeSees(e, 0, 0)).toBe(true);
  });

  it('its gaze builds in the open, then Searing Look hurts a hero it still sees and resets', () => {
    const { w, inner } = fight();
    w.player.y = 300;
    const i = inner.spawn('lampeye', 400, 300);
    const e = w.enemies[i];
    e.abilityT = 99;
    step(w, 60);
    expect(e.aux).toBeGreaterThan(1.8);
    e.aux = LAMPEYE.full - 0.01;
    step(w, 2);
    expect(e.castId).toBe('searingLook');
    const hp = w.player.hp;
    w.events.length = 0;
    step(w, Math.ceil(LAMPEYE.lookCast * 30) + 2);
    expect(w.player.hp).toBeLessThan(hp);
    expect(e.aux).toBeLessThan(0.2);
  });

  it('fades behind a pillar, and Searing Look misses a hero who got behind one during the cast', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('lampeye', 400, 0)];
    e.abilityT = 99;
    e.aux = 3;
    step(w, 15);
    expect(e.aux).toBeLessThan(3 - 0.5 * LAMPEYE.fade * 0.9);
    e.castId = 'searingLook'; e.castName = 'Searing Look'; e.castT = 0; e.castDur = 0.1; e.interruptible = false;
    const hp = w.player.hp;
    step(w, 6);
    expect(e.castId).toBe('');
    expect(w.player.hp).toBe(hp);
    expect(e.aux).toBe(0);
  });

  it('a bot with a half-full gaze on it heads behind the nearest pillar', () => {
    const { w, inner } = fight();
    w.player.y = 150;
    const e = w.enemies[inner.spawn('lampeye', 0, 400)];
    e.abilityT = 99;
    const calm = botInput(w, 1);
    e.aux = LAMPEYE.full * 0.6;
    const hide = botInput(w, 1);
    // The hide point is past the pillar from the Lampeye, at about (229, -58): right of and below the hero.
    const toHide = Math.atan2(-58 - 150, 229);
    const turn = (v: { x: number; y: number }) => Math.abs(Math.atan2(Math.sin(Math.atan2(v.y, v.x) - toHide), Math.cos(Math.atan2(v.y, v.x) - toHide)));
    expect(turn(hide)).toBeLessThan(turn(calm) - 0.2);
  });

  it('a melee bot stays on the eye instead of hiding', () => {
    const { w, inner } = fight('duskblade');
    w.player.y = 150;
    const e = w.enemies[inner.spawn('lampeye', 0, 400)];
    e.abilityT = 99;
    const calm = botInput(w, 1);
    e.aux = LAMPEYE.full * 0.6;
    const hide = botInput(w, 1);
    expect(hide.x).toBeCloseTo(calm.x, 6);
    expect(hide.y).toBeCloseTo(calm.y, 6);
  });
});
