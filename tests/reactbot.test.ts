import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput, reactBot, STEP_WINDOW } from '../sim/bot';

/** A Kiln t4 Duskblade run, played by `drive` until `until` holds, the run ends or 90 s pass (kept short: CI runs test files side by side). */
function play(drive: (w: World) => ReturnType<typeof botInput>, until: (w: World) => boolean = () => false, seed = 3): World {
  const w = new World({ seed, cls: 'duskblade', dungeon: 'kiln', tier: 4 });
  while (w.state !== 'ended' && w.time < 90 && !until(w)) { if (w.state === 'draft') w.choose(botChoose(w)); else w.step(drive(w)); }
  return w;
}
const fresh = (w: World, s: number) => w.telegraphs.some((t) => t.alive && t.t < s);

describe('playtest proxy: reactBot notices late but steers from where the hero is', () => {
  it('with no reaction time it is the full bot', () => {
    const a = play((w) => botInput(w));
    const b = play(reactBot(0));
    expect(b.summary()).toEqual(a.summary());
  }, 20000);

  it('does not see a telegraph younger than its reaction time, and sees it after', () => {
    const w = play((x) => botInput(x), (x) => fresh(x, 0.05));
    expect(fresh(w, 0.05)).toBe(true);
    const young = w.telegraphs.filter((t) => t.alive && t.t < 0.15);
    for (const t of young) t.alive = false;
    const blind = botInput(w);
    for (const t of young) t.alive = true;
    expect(reactBot(0.15)(w)).toEqual(blind);
    // Older than the reaction time, the same telegraph is in view.
    expect(reactBot(1 / 60)(w)).toEqual(botInput(w));
  });

  it('hides a fresh cast and a fresh foe while deciding, and puts the world back as it was', () => {
    const w = play((x) => botInput(x), (x) => x.enemies.some((e) => e.alive && !!e.castId && e.castT < 0.1) && fresh(x, 0.5));
    const before = JSON.stringify({ t: w.telegraphs.map((t) => t.alive), e: w.enemies.map((e) => [e.alive, e.castId]) });
    reactBot(0.5)(w);
    expect(JSON.stringify({ t: w.telegraphs.map((t) => t.alive), e: w.enemies.map((e) => [e.alive, e.castId]) })).toBe(before);
  });

  it('plays the same run from the same seed', () => {
    expect(play(reactBot(0.3, 0.5)).summary()).toEqual(play(reactBot(0.3, 0.5)).summary());
  }, 20000);

  it('mistakes: forget 1 never sees a telegraph however old; forget 0 is the mistake-free bot', () => {
    const w = play((x) => botInput(x), (x) => x.telegraphs.some((t) => t.alive && t.t > 0.3));
    const all = w.telegraphs.filter((t) => t.alive);
    for (const t of all) t.alive = false;
    const blind = botInput(w);
    for (const t of all) t.alive = true;
    expect(reactBot(0, 1, { forget: 1 })(w)).toEqual(blind);
    expect(reactBot(0, 1, { forget: 0 })(w)).toEqual(botInput(w));
  });

  it('mistakes: a misjudged step turns the move but keeps its length, held for a window', () => {
    const w = play((x) => botInput(x), (x) => x.time > 20);
    const base = botInput(w);
    const off = reactBot(0, 1, { stepErr: 0.5 })(w);
    expect(Math.hypot(off.x, off.y)).toBeCloseTo(Math.hypot(base.x, base.y), 6);
    const ang = Math.abs(Math.atan2(base.x * off.y - base.y * off.x, base.x * off.x + base.y * off.y));
    expect(ang).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(STEP_WINDOW).toBeGreaterThan(0);
  });

  it('with mistakes it still replays the same run from the same seed and salt', () => {
    const run = (m: Parameters<typeof reactBot>[2], seed: number) => { const w = new World({ seed, cls: 'duskblade', dungeon: 'kiln', tier: 6 }); const d = reactBot(0.3, 0.5, m); while (w.state !== 'ended' && w.time < 120) { if (w.state === 'draft') w.choose(botChoose(w)); else w.step(d(w)); } return w.player.hp / w.player.maxHp + w.encounter; };
    expect(run({ forget: 0.3, stepErr: 0.6, salt: 1 }, 4)).toEqual(run({ forget: 0.3, stepErr: 0.6, salt: 1 }, 4));
  }, 20000);
});
