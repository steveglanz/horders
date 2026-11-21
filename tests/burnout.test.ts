import { describe, expect, it } from 'vitest';
import { World, BURNOUT, TICK } from '../sim/world';

/** Steps an idle hero until `until` holds, or for at most `cap` seconds. */
function idleUntil(w: World, until: () => boolean, cap: number): void {
  for (let n = 0; n < cap / TICK && !until(); n++) {
    if (w.state === 'draft') { w.choose(0); continue; }
    w.step({ x: 0, y: 0 });
  }
}

describe('Burnout (C7 stall fix)', () => {
  it('a fight nobody can win or lose ends: a warning, then the fire takes everything', () => {
    const w = new World({ seed: 3, omens: [] });
    idleUntil(w, () => w.phase === 'fight', 60);
    expect(w.phase).toBe('fight');
    const start = w.time;
    // Make the hero untouchable by foes: only Burnout can hurt it now.
    const inner = w as unknown as { hurtPlayer: () => void };
    inner.hurtPlayer = () => {};
    const seen: { warn: boolean; t: number }[] = [];
    for (let n = 0; n < (BURNOUT.fight + 30) / TICK && w.state !== 'ended'; n++) {
      if (w.state === 'draft') { w.choose(0); continue; }
      for (const e of w.enemies) if (e.alive) e.hp = e.maxHp; // and the hero can't win it either
      w.step({ x: 0, y: 0 });
      for (const e of w.events) if (e.type === 'burnout') seen.push({ warn: e.warn, t: w.time - start });
    }
    expect(w.state).toBe('ended');
    expect(w.summary().victory).toBe(false);
    expect(seen[0].warn).toBe(true);
    expect(seen[0].t).toBeCloseTo(BURNOUT.fight - BURNOUT.warn, 0);
    expect(seen[1].warn).toBe(false);
    expect(seen[1].t).toBeCloseTo(BURNOUT.fight, 0);
    // The ramp ends it within about 7 s.
    expect(w.time - start).toBeLessThan(BURNOUT.fight + 8);
  });

  it('a fight never holds more than the add cap', () => {
    const w = new World({ seed: 3, omens: [] });
    idleUntil(w, () => w.phase === 'fight', 60);
    const inner = w as unknown as { spawn(kind: string, x: number, y: number): number };
    for (let k = 0; k < BURNOUT.addCap + 50; k++) inner.spawn('ashling', 300, 300);
    expect(w.aliveEnemies).toBe(BURNOUT.addCap);
  });
});
