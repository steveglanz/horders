import { describe, expect, it } from 'vitest';
import { World, WorldOptions } from '../sim/world';
import { botInput } from '../sim/bot';

const party = (n: number): WorldOptions['party'] =>
  (['bulwark', 'lumen', 'duskblade'] as const).slice(0, n - 1).map((cls) => ({ cls }));

/** Steps every hero with the bot until `done` holds; drafts take the first card. */
function run(w: World, done: () => boolean, maxSeconds = 120): void {
  while (!done() && w.state !== 'ended' && w.time < maxSeconds) {
    if (w.state === 'draft') {
      const h = w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0);
      w.choose(0, Math.max(0, h));
    } else w.step(w.heroes.map(() => botInput(w)));
  }
}

describe('co-op party', () => {
  it('builds one hero per party member, each with their own class and spot', () => {
    for (const n of [2, 3, 4]) {
      const w = new World({ seed: 5, party: party(n) });
      expect(w.heroes).toHaveLength(n);
      expect(new Set(w.heroes.map((h) => h.id)).size).toBe(n);
      expect(w.hero(1).cls).toBe('bulwark');
      const spots = w.heroes.map((_, i) => `${w.hero(i).player.x},${w.hero(i).player.y}`);
      expect(new Set(spots).size).toBe(n);
      expect(w.player).toBe(w.hero(0).player); // the main hero is swapped in between calls
    }
  });

  it('is deterministic with a full party', () => {
    const go = () => {
      const w = new World({ seed: 11, party: party(4) });
      run(w, () => false, 60);
      return w;
    };
    const a = go();
    const b = go();
    expect(a.hash()).toBe(b.hash());
    expect(a.tick).toBe(b.tick);
  });

  it('enemies chase whoever holds the most threat', () => {
    const w = new World({ seed: 3, party: party(2) });
    run(w, () => w.phase === 'fight' && w.enemies.some((e) => e.alive && !e.def.stationary));
    const i = w.enemies.findIndex((e) => e.alive && !e.def.stationary);
    expect(i).toBeGreaterThanOrEqual(0);
    const e = w.enemies[i];
    const [a, b] = [w.hero(0).player, w.hero(1).player];
    // Put the two heroes on opposite sides of the enemy, far away.
    Object.assign(a, { x: e.x - 600, y: e.y, px: e.x - 600, py: e.y });
    Object.assign(b, { x: e.x + 600, y: e.y, px: e.x + 600, py: e.y });
    const chase = (id: string) => {
      w.threat[i] = { amounts: { [id]: 1000 }, target: id, forced: null, forcedT: 0 };
      const x0 = e.x;
      w.step([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
      return e.x - x0;
    };
    expect(chase('h1')).toBeGreaterThan(0);
    expect(chase('h0')).toBeLessThan(0);
  });

  it("every hero's hits build threat on the enemies they strike", () => {
    const w = new World({ seed: 3, party: party(2) });
    const both = () => w.threat.some((t) => (t.amounts.h0 ?? 0) > 0 && (t.amounts.h1 ?? 0) > 0);
    run(w, both, 120);
    expect(both()).toBe(true);
  });

  it('one hero going down does not end the run; the whole party going down does', () => {
    const w = new World({ seed: 8, party: party(3) });
    run(w, () => w.phase === 'fight');
    w.hero(1).player.hp = 0;
    w.step([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(w.state).not.toBe('ended');
    for (let i = 0; i < 3; i++) w.hero(i).player.hp = 0;
    w.step([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(w.state).toBe('ended');
    expect(w.victory).toBe(false);
  });

  it('downed heroes get back up between fights', () => {
    const w = new World({ seed: 8, party: party(2) });
    w.hero(1).player.hp = 0;
    (w as unknown as { afterClear: (d: unknown) => void }).afterClear(undefined);
    expect(w.hero(1).player.hp).toBeGreaterThan(0);
    expect(w.hero(1).player.hp).toBeLessThan(w.hero(1).player.maxHp);
  });

  it('each hero picks their own cards, and the run waits for everyone', () => {
    const w = new World({ seed: 4, party: party(3) });
    w.hero(0).player.pendingLevels = 1;
    w.hero(2).player.pendingLevels = 2;
    (w as unknown as { openDraftAll: () => void }).openDraftAll();
    expect(w.state).toBe('draft');
    expect(w.choicesOf(0)).toHaveLength(3);
    expect(w.choicesOf(1)).toHaveLength(0);
    expect(w.choicesOf(2)).toHaveLength(3);
    const pick = w.choicesOf(2)[0].id;
    w.choose(0, 2);
    expect(w.hero(2).talents[pick]).toBe(1);
    expect(w.hero(0).talents[pick]).toBeUndefined();
    expect(w.choicesOf(2)).toHaveLength(3); // second level: new cards
    w.choose(0, 0);
    expect(w.state).toBe('draft');
    w.choose(0, 2);
    expect(w.state).toBe('running');
  });

  it('a hero who levels on the same tick the draft opens still gets cards', () => {
    const w = new World({ seed: 4, party: party(2) });
    w.hero(0).player.pendingLevels = 1;
    (w as unknown as { openDraftAll: () => void }).openDraftAll();
    w.hero(1).player.pendingLevels = 1; // levelled after the cards were dealt
    w.choose(0, 0);
    expect(w.state).toBe('draft');
    expect(w.choicesOf(1)).toHaveLength(3);
    w.choose(0, 1);
    expect(w.state).toBe('running');
  });
});
