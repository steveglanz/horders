import { describe, expect, it } from 'vitest';
import { World, CONCH, NEW_FOES, WRACK } from '../sim/world';
import { DUNGEONS, ENCOUNTERS } from '../sim/content/dungeon';

type Inner = { spawn(kind: string, x: number, y: number): number; route: string[]; tideClockT: number; ebbWarnT: number };

/** A Wrackline run already in its first fight, every foe cleared. */
function fight(): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'wrackline', tier: 10, omens: [], cls: 'emberwright', invulnerable: true });
  const inner = w as unknown as Inner;
  inner.route[0] = 'conch';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}
const step = (w: World, n: number) => { for (let k = 0; k < n; k++) w.step({ x: 0, y: 0 }); };

describe('Phase 16 U2: the Conchblower (the Wrackline)', () => {
  it('is a Wrackline opener: one Conchblower and two Shoal Lurkers, and a new foe', () => {
    expect(DUNGEONS.wrackline.openers).toContain('conch');
    expect(ENCOUNTERS.conch.spawns).toEqual([{ kind: 'conchblower', n: 1 }, { kind: 'shoalLurker', n: 2 }]);
    expect(NEW_FOES).toContain('conchblower');
  });

  it('a Conch Call that lands brings the next Ebb hasten s sooner, and it is Quenchable', () => {
    const { w, inner } = fight();
    const i = inner.spawn('conchblower', 300, 0);
    const e = w.enemies[i];
    e.abilityT = 0;
    inner.ebbWarnT = 0; w.ebbT = 0;
    inner.tideClockT = 15;
    step(w, 1);
    expect(e.castId).toBe('conchCall');
    expect(e.interruptible).toBe(true);
    const before = inner.tideClockT;
    step(w, Math.ceil(CONCH.cast * 30) + 1);
    expect(e.castId).toBe('');
    // About cast seconds of the clock ran down on its own; the blast took hasten more.
    expect(before - inner.tideClockT).toBeGreaterThan(CONCH.hasten + CONCH.cast - 0.2);
  });

  it('never brings the Ebb nearer than floor s, and holds a running Ebb longer', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('conchblower', 300, 0)];
    inner.ebbWarnT = 0; w.ebbT = 0;
    inner.tideClockT = 3;
    e.castId = 'conchCall'; e.castName = 'Conch Call'; e.castT = 0; e.castDur = 0.05; e.abilityT = 99;
    step(w, 3);
    expect(inner.tideClockT).toBeGreaterThan(CONCH.floor - 0.2);
    w.ebbT = 2;
    e.castId = 'conchCall'; e.castT = 0; e.castDur = 0.05;
    step(w, 3);
    expect(w.ebbT).toBeGreaterThan(2 + CONCH.hold - 0.2);
  });

  it('swims the Ebb instead of drifting with it', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('conchblower', 300, 0)];
    e.def = { ...e.def, speed: 0 };
    e.abilityT = 99;
    w.ebbT = WRACK.tideOpen;
    step(w, 30);
    expect(Math.hypot(e.x, e.y)).toBeCloseTo(300, 0);
  });
});
