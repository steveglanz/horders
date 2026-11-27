import { describe, expect, it } from 'vitest';
import { World, TICK, RunSummary } from '../sim/world';
import { applyRun, bestKey, newHero } from '../sim/hero';
import { mastery, MasteryInput } from '../sim/mastery';

type Inner = {
  addTelegraph(shape: 'circle' | 'cone', x: number, y: number, r: number, angle: number, arc: number, dur: number, dmg: number, kind?: 'hit' | 'soak' | 'bloom', owner?: number): void;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): boolean;
  finishCast(i: number): void;
};

/** An empty Kiln room, every foe cleared, so only the test's own telegraphs land. */
function room(cls: 'emberwright' | 'lumen' = 'emberwright', level = 10): World {
  const w = new World({ seed: 3, omens: [], cls, unlockLevel: level });
  for (const e of w.enemies) e.alive = false;
  return w;
}

const base: MasteryInput = {
  victory: false, player: {}, kick: true, fName: 'Quench', soaks: 0, soaksMade: 0, time: 400, place: 'Kiln Depths', tier: 2, timed: true,
};

describe('1.0 CP2 mastery card: what the sim counts', () => {
  it('a red mark you walk out of is a dodge; one you stand in is not', () => {
    for (const walk of [true, false]) {
      const w = room();
      const p = w.player;
      (w as unknown as Inner).addTelegraph('circle', p.x, p.y, 40, 0, 0, 1.0, 10);
      for (let k = 0; k < Math.ceil(1.1 / TICK); k++) w.step({ x: walk ? 1 : 0, y: 0 });
      expect(w.player.tells).toBe(1);
      expect(w.player.dodges ?? 0).toBe(walk ? 1 : 0);
    }
  });

  it('a red mark rolled through counts as dodged; one far away counts for nothing', () => {
    const w = room();
    const p = w.player;
    (w as unknown as Inner).addTelegraph('circle', p.x, p.y, 400, 0, 0, TICK * 2, 30);
    (w as unknown as Inner).addTelegraph('circle', p.x + 2000, p.y, 40, 0, 0, TICK * 2, 30);
    w.step({ x: 1, y: 0, roll: true });
    for (let k = 0; k < 3; k++) w.step({ x: 0, y: 0 });
    expect(w.player.rolled).toBe(1);
    expect(w.player.tells).toBe(1);
    expect(w.player.dodges).toBe(1);
  });

  it('gold circles: made when stood in, missed when empty', () => {
    const w = room();
    const p = w.player;
    (w as unknown as Inner).addTelegraph('circle', p.x, p.y, 60, 0, 0, TICK * 2, 5, 'soak');
    (w as unknown as Inner).addTelegraph('circle', p.x + 900, p.y, 60, 0, 0, TICK * 2, 5, 'soak');
    for (let k = 0; k < 4; k++) w.step({ x: 0, y: 0 });
    expect(w.soaks).toBe(2);
    expect(w.soaksMade).toBe(1);
  });

  it('a stoppable cast that goes off is a missed Kick, for a kick class with F open only', () => {
    const missed = (cls: 'emberwright' | 'lumen', level: number, interruptible: boolean) => {
      const w = room(cls, level);
      (w as unknown as Inner).startCast(0, 'groundPound', 'Ground Pound', 2, interruptible);
      (w as unknown as Inner).finishCast(0);
      return w.player.castsMissed ?? 0;
    };
    expect(missed('emberwright', 10, true)).toBe(1);
    expect(missed('emberwright', 10, false)).toBe(0);
    expect(missed('lumen', 10, true)).toBe(0);
    // F is closed until level 4: nothing to count yet.
    expect(missed('emberwright', 1, true)).toBe(0);
  });
});

describe('1.0 CP2 mastery card: the lines', () => {
  it('never empty: a loss with nothing recorded still has a lesson', () => {
    const m = mastery(base);
    expect(m.tiles).toEqual([]);
    expect(m.lesson.length).toBeGreaterThan(0);
    expect(m.best).toBe('No best time in Kiln Depths tier 2 yet. Win it to set one.');
  });

  it('shows x of y tiles and names the felling blow on a loss', () => {
    const m = mastery({ ...base, player: { tells: 11, dodges: 9, castsMissed: 1, interrupts: 3, lastHurtBy: 'Smolderhusk, the Kiln Mother', hurtBy: { Ashbuck: 30 } }, soaks: 2, soaksMade: 2 });
    expect(m.tiles.map((t) => `${t.label} ${t.value}`)).toEqual(['Dodged 9 of 11', 'Quench 3 of 4', 'Gold circles 2 of 2']);
    expect(m.blow).toBe('Felled by Smolderhusk');
    expect(m.lesson).toBe('Watch Ashbuck: it took 100% of your health.');
  });

  it('picks one lesson, most useful first', () => {
    expect(mastery({ ...base, soaks: 3, soaksMade: 2, player: { tells: 10, dodges: 2 } }).lesson).toMatch(/gold circles/);
    expect(mastery({ ...base, player: { tells: 10, dodges: 5, castsMissed: 5, interrupts: 0 } }).lesson).toMatch(/^Red ground/);
    expect(mastery({ ...base, player: { tells: 10, dodges: 9, castsMissed: 4, interrupts: 1 } }).lesson).toBe('Stop blue casts with Quench (F) before the bar fills.');
    expect(mastery({ ...base, victory: true, player: { tells: 4, dodges: 4 } }).lesson).toBe('Clean run. Try the next tier.');
  });

  it('a stun class gets no Kick tile; a run that sets no best time gets no best line', () => {
    const m = mastery({ ...base, kick: false, timed: false, player: { castsMissed: 3, interrupts: 3 } });
    expect(m.tiles).toEqual([]);
    expect(m.best).toBe('');
  });

  it('best time lines', () => {
    expect(mastery({ ...base, victory: true, newBest: true }).best).toBe('First win in Kiln Depths tier 2: 6:40');
    expect(mastery({ ...base, victory: true, newBest: true, bestBefore: 450 }).best).toBe('New best for Kiln Depths tier 2: 6:40 (was 7:30)');
    expect(mastery({ ...base, victory: true, bestBefore: 380 }).best).toBe('Best for Kiln Depths tier 2: 6:20 (this run 6:40)');
    expect(mastery({ ...base, bestBefore: 380 }).best).toBe('Best for Kiln Depths tier 2: 6:20');
  });

  it('no line in the card breaks the voice guide (no "!", no em-dash, tips 20 words or fewer)', () => {
    const lines = [
      mastery(base), mastery({ ...base, soaks: 1 }), mastery({ ...base, player: { tells: 9 } }), mastery({ ...base, player: { castsMissed: 9 } }),
      mastery({ ...base, victory: true }), mastery({ ...base, victory: true, player: { tells: 1, dodges: 1 } }),
    ].flatMap((m) => [m.lesson, m.best, m.blow]);
    for (const l of lines) {
      expect(l).not.toMatch(/[!—…]/);
      expect(l.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });
});

describe('1.0 CP2 mastery card: best times', () => {
  const run = (over: Partial<RunSummary>): RunSummary => ({ victory: true, tier: 2, time: 400, kills: 10, level: 5, damageDealt: 100, talents: {}, dungeon: 'kiln', fightsCleared: 5, ...over });

  it('only a solo ladder delve counts', () => {
    expect(bestKey(run({}))).toBe('kiln:2');
    expect(bestKey(run({ bounty: 3 }))).toBe('');
    expect(bestKey(run({ keyLevel: 2 }))).toBe('');
    expect(bestKey(run({ realHeroes: 2 }))).toBe('');
    expect(bestKey(run({ firstDelve: true }))).toBe('');
  });

  it('a faster win sets a new best; a slower win or a loss keeps it', () => {
    const h = newHero();
    h.maxTier = 3;
    expect(applyRun(h, 1, run({ time: 400 }), false).newBest).toBe(true);
    expect(h.bestClear).toEqual({ 'kiln:2': 400 });
    const slow = applyRun(h, 2, run({ time: 450 }), false);
    expect(slow.newBest).toBeUndefined();
    expect(slow.bestBefore).toBe(400);
    applyRun(h, 3, run({ time: 300, victory: false }), false);
    expect(h.bestClear).toEqual({ 'kiln:2': 400 });
    const fast = applyRun(h, 4, run({ time: 350.04 }), false);
    expect(fast).toMatchObject({ newBest: true, bestBefore: 400 });
    expect(h.bestClear).toEqual({ 'kiln:2': 350 });
  });

  it('the tutorial first delve marks itself in the summary', () => {
    const w = new World({ seed: 1, omens: [], firstDelve: true });
    expect(w.summary().firstDelve).toBe(true);
    expect('firstDelve' in new World({ seed: 1, omens: [] }).summary()).toBe(false);
  });
});
