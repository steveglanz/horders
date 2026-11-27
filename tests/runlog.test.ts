import { describe, expect, it } from 'vitest';
import { botChoose, botInput } from '../sim/bot';
import { checkOf, quantize, replayRun, RunLog, sameCheck, stepInputs } from '../sim/runlog';
import { World, type WorldOptions } from '../sim/world';
import { BUILD_ID, resumeBlocker, RESUME_MAX_AGE, type SavedRun } from '../client/resume';

/** Plays `ticks` ticks as GameScene does with a log on: bot-steered, jittered stick, picks logged. */
function play(w: World, log: RunLog, ticks: number, rnd: () => number): void {
  for (let t = 0; t < ticks && w.state !== 'ended'; t++) {
    if (w.state === 'draft') {
      for (let i = 1; i < w.heroes.length; i++) if (w.choicesOf(i).length) { w.use(i); const c = botChoose(w); w.use(0); w.choose(c, i); log.pick(c, i); }
      if (w.state === 'draft' && w.choices.length) { const c = botChoose(w); w.choose(c, 0); log.pick(c, 0); }
      continue;
    }
    const b = botInput(w);
    // A thumb on a stick: never quite the bot's exact vector.
    const q = quantize({ ...b, x: b.x + (rnd() - 0.5) * 0.3, y: b.y + (rnd() - 0.5) * 0.3 });
    log.step(q);
    w.step(stepInputs(w, q));
  }
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Everything a resumed run must match: hero, foes, clock, picks, the run summary. */
function state(w: World): string {
  return JSON.stringify({
    tick: w.tick, time: w.time, st: w.state, p: w.player, talents: w.talents,
    foes: w.enemies.filter((e) => e.alive).map((e) => [e.kind, e.hp, e.x, e.y]),
    heroes: w.heroes.map((_, i) => { const h = w.heroData(i).player; return [h.hp, h.x, h.y]; }),
    sum: w.summary(),
  });
}

function roundTrip(opts: WorldOptions, ticks: number, more: number): void {
  const live = new World(JSON.parse(JSON.stringify(opts)));
  const log = new RunLog();
  const rnd = lcg(7);
  play(live, log, ticks, rnd);
  // A real slice of a delve: Sparks picked and foes killed before the save.
  expect(log.ops.some((o) => o[0] < 0)).toBe(true);
  expect(live.summary().kills).toBeGreaterThan(0);
  // What localStorage keeps: JSON.
  const saved = JSON.parse(JSON.stringify({ opts, ops: log.ops, check: checkOf(live) }));
  const back = new World(saved.opts);
  // Replayed in chunks, as the client spreads it over frames.
  let at = { op: 0, done: 0 };
  while (at.op < saved.ops.length) at = replayRun(back, saved.ops, at, 97);
  expect(sameCheck(checkOf(back), saved.check)).toBe(true);
  expect(state(back)).toBe(state(live));
  // Play on from both: the resumed run carries on exactly as the live one would have.
  const log2 = new RunLog();
  log2.ops = saved.ops;
  play(live, log, more, lcg(11));
  play(back, log2, more, lcg(11));
  expect(state(back)).toBe(state(live));
}

describe('pause/resume run log', () => {
  it('replays a solo Kiln delve to the same tick, hero, foes and summary', () => {
    roundTrip({ seed: 3, tier: 2, halls: true, dungeon: 'kiln', cls: 'emberwright' }, 2400, 1200);
  });

  it('replays a bot-filled party (the bots are asked again, not logged)', () => {
    roundTrip({ seed: 9, tier: 2, halls: true, dungeon: 'kiln', cls: 'duskblade', party: [{ cls: 'lumen' }, { cls: 'bulwark' }], partySize: 3, fillBots: 2 }, 2400, 600);
  });

  it('keeps standing still as one op and packs a cast into the flags', () => {
    const log = new RunLog();
    for (let i = 0; i < 50; i++) log.step({ x: 0, y: 0 });
    log.step({ x: 0, y: 0, cast: 2, roll: true, hold: 1 });
    log.pick(1, 0);
    expect(log.ops).toEqual([[50, 0, 0, 0], [1, 0, 0, 3 | 8 | (2 << 4)], [-1, 1, 0]]);
  });

  it('only picks up a save from this build, this hero, and the last two days', () => {
    const hero = { cls: 'emberwright', runs: 4, nextItemId: 30 };
    const r = { build: BUILD_ID, at: 1000, hero } as SavedRun;
    expect(resumeBlocker(r, hero, 2000)).toBe('');
    expect(resumeBlocker({ ...r, build: 'other' }, hero, 2000)).toBe('build');
    expect(resumeBlocker(r, hero, 1000 + RESUME_MAX_AGE + 1)).toBe('old');
    expect(resumeBlocker(r, { ...hero, runs: 5 }, 2000)).toBe('hero');
  });
});
