import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput, reactBot } from '../sim/bot';

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
});
