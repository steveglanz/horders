import { describe, expect, it } from 'vitest';
import { COLD, COLD_FED_BY, World } from '../sim/world';
import { loadoutFrom } from '../sim/hero';
import { Item } from '../sim/content/items';
import { SETS, SET_TUNING, SetId, setForDungeon } from '../sim/content/sets';

const piece = (slot: Item['slot'], set?: SetId): Item => ({
  id: `t-${slot}`, slot, rarity: 'rare', ilvl: 10, name: `Test ${slot}`, stats: [{ stat: 'vitality', value: 10 }], set,
});
const gear = (set: SetId, n: number): Item[] => (['head', 'hands', 'trinket'] as const).slice(0, n).map((s) => piece(s, set));

/** A world with gear, standing in the first fight. */
function world(items: Item[], dungeon: 'kiln' | 'foundry' | 'glarewell' = 'kiln'): World {
  const route = dungeon === 'kiln' ? ['pack', 'pack', 'pack', 'pack', 'kilnMother'] : dungeon === 'foundry' ? ['twins', 'twins', 'twins', 'twins', 'maelra'] : ['shades', 'shades', 'shades', 'shades', 'lensmother'];
  const w = new World({ seed: 3, dungeon, route: route as never, omens: [], gear: items });
  while (w.time < 10 && w.phase !== 'fight') {
    if (w.state === 'draft') w.choose(0);
    else w.step({ x: 0, y: 0 });
  }
  return w;
}

type Inner = {
  hurtPlayer(a: number): void;
  setDamageMult(e: unknown, silent: boolean): number;
  addTelegraph(shape: 'circle', x: number, y: number, r: number, a: number, arc: number, dur: number, dmg: number, kind?: 'hit' | 'soak' | 'bloom'): void;
  withSet(it: Item): Item;
  killEnemy(i: number): void;
};
const inner = (w: World) => w as unknown as Inner;

describe('verb sets (R4)', () => {
  it('each dungeon has its own set, and the loadout counts pieces', () => {
    expect(setForDungeon('kiln')).toBe('kilnbreaker');
    expect(setForDungeon('foundry')).toBe('tidewalker');
    expect(setForDungeon('glarewell')).toBe('glarewarden');
    expect(setForDungeon('coldmarrow')).toBe('hearthkeeper');
    expect(setForDungeon('wrackline')).toBe('wrackrider');
    expect(setForDungeon('hammerdeep')).toBe('deepguard');
    expect(setForDungeon('ashvents')).toBe('ventwalker');
    expect(setForDungeon('crucible')).toBeUndefined();
    expect(loadoutFrom({}, [...gear('kilnbreaker', 2), piece('chest')]).sets).toEqual({ kilnbreaker: 2 });
    expect(Object.keys(SETS)).toHaveLength(7);
  });

  it('Kilnbreaker: an interrupt sharpens you at 2 pieces and exposes the foe at 3', () => {
    for (const n of [1, 2, 3]) {
      const w = world(gear('kilnbreaker', n));
      const i = w.enemies.findIndex((e) => e.alive);
      const e = w.enemies[i];
      Object.assign(e, { castId: 'snap', castName: 'Snap', interruptible: true, castT: 0, castDur: 2, x: w.player.x + 40, y: w.player.y });
      w.player.cds[3] = 0;
      w.step({ x: 0, y: 0, cast: 3 });
      expect((w.player.kbT ?? 0) > 0).toBe(n >= 2);
      expect((e.exposedT ?? 0) > 0).toBe(n >= 3);
      const mult = inner(w).setDamageMult(e, true);
      const want = (n >= 2 ? 1 + SET_TUNING.kbDamage : 1) * (n >= 3 ? 1 + SET_TUNING.kbExposed : 1);
      expect(mult).toBeCloseTo(want, 5);
    }
  });

  it('Tidewalker: less damage while moving (2), and a charged hit after 2s on the move (3)', () => {
    const w = world(gear('tidewalker', 3), 'foundry');
    w.player.moving = true;
    const hp = w.player.hp;
    inner(w).hurtPlayer(50);
    expect(hp - w.player.hp).toBeCloseTo(50 * (1 - SET_TUNING.twCut), 3);
    w.player.moving = false;
    const hp2 = w.player.hp;
    inner(w).hurtPlayer(50);
    expect(hp2 - w.player.hp).toBeCloseTo(50, 3);

    const t = new World({ seed: 3, dungeon: 'foundry', route: ['twins', 'twins', 'twins', 'twins', 'maelra'], omens: [], gear: gear('tidewalker', 3), invulnerable: true });
    for (let k = 0; k < 75 && !t.player.surge; k++) t.step({ x: 1, y: 0 });
    expect(t.player.surge).toBe(true);
    const e = t.enemies.find((o) => o.alive) ?? t.enemies[0];
    expect(inner(t).setDamageMult(e, true)).toBe(1); // damage over time keeps the charge
    expect(inner(t).setDamageMult(e, false)).toBeCloseTo(1 + SET_TUNING.twSurge, 5);
    expect(t.player.surge).toBe(false);
  });

  it('Glarewarden: stepping out of a marked attack heals, at most every few seconds', () => {
    const w = world(gear('glarewarden', 3), 'glarewell');
    const p = w.player;
    p.hp = p.maxHp * 0.5;
    const before = p.hp;
    let got = 0;
    inner(w).addTelegraph('circle', p.x, p.y, 60, 0, 0, 0.5, 10);
    for (let k = 0; k < 20; k++) {
      w.step({ x: 1, y: 0 });
      got += w.events.filter((e) => e.type === 'dodge').length;
    }
    expect(got).toBe(1);
    expect(p.hp).toBeGreaterThan(before);
    expect((p.gwT ?? 0) > 0).toBe(true);
    // A second dodge right away is inside the cooldown.
    let again = 0;
    inner(w).addTelegraph('circle', p.x, p.y, 60, 0, 0, 0.5, 10);
    for (let k = 0; k < 20; k++) {
      w.step({ x: -1, y: 0 });
      again += w.events.filter((e) => e.type === 'dodge').length;
    }
    expect(again).toBe(0);
  });

  it('Hearthkeeper: kills build Warmth for damage (2), full Warmth cuts damage taken (3), and it fades', () => {
    for (const n of [1, 2, 3]) {
      const w = world(gear('hearthkeeper', n));
      const i = w.enemies.findIndex((e) => e.alive);
      for (let k = 0; k < 6; k++) {
        // The same foe, revived, so the fight around it doesn't change.
        w.enemies[i].alive = true;
        w.aliveEnemies++;
        inner(w).killEnemy(i);
      }
      const p = w.player;
      expect(p.warmth ?? 0).toBe(n >= 2 ? SET_TUNING.hkMax : 0);
      const e = w.enemies[i];
      expect(inner(w).setDamageMult(e, true)).toBeCloseTo(n >= 2 ? 1 + SET_TUNING.hkDamage * SET_TUNING.hkMax : 1, 5);
      p.hp = p.maxHp;
      inner(w).hurtPlayer(50);
      expect(p.maxHp - p.hp).toBeCloseTo(n >= 3 ? 50 * (1 - SET_TUNING.hkCut) : 50, 3);
    }
    // With no kills, a stack fades every hkFade seconds.
    const w = world(gear('hearthkeeper', 3));
    w.player.warmth = 3;
    w.player.warmT = 0;
    const t0 = w.time;
    while (w.time - t0 < SET_TUNING.hkFade + 0.05 && (w.player.warmth ?? 0) === 3) w.step({ x: 0, y: 0 });
    expect(w.player.warmth).toBe(2);
    expect(w.time - t0).toBeGreaterThan(SET_TUNING.hkFade - 0.1);
  });

  it('Hearthkeeper (2) feeds the Hearthcoal 50% more in the Coldmarrow', () => {
    const fed = (n: number): number => {
      const w = new World({ seed: 3, dungeon: 'coldmarrow', omens: [], gear: gear('hearthkeeper', n), invulnerable: true });
      while (w.time < 30 && w.phase !== 'fight') {
        if (w.state === 'draft') w.choose(0);
        else w.step({ x: 0, y: 0 });
      }
      w.player.coal = 0.5;
      const i = w.enemies.findIndex((e) => e.alive && COLD_FED_BY.includes(e.kind) && e.kind !== 'snuffer');
      expect(i).toBeGreaterThanOrEqual(0);
      inner(w).killEnemy(i);
      return (w.player.coal ?? 0) - 0.5;
    };
    expect(fed(0)).toBeCloseTo(COLD.feed, 5);
    expect(fed(2)).toBeCloseTo(COLD.feed * (1 + SET_TUNING.hkFeed), 5);
  });

  it('a boss item in a set slot can become a piece of that dungeon set, but never in a bounty', () => {
    let hits = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = new World({ seed, dungeon: 'foundry', omens: [] });
      const out = inner(w).withSet(piece('hands'));
      if (out.set) {
        hits++;
        expect(out.set).toBe('tidewalker');
        expect(out.name.startsWith('Tidewalker')).toBe(true);
      }
      expect(inner(w).withSet(piece('chest')).set).toBeUndefined();
    }
    expect(hits).toBeGreaterThan(10);
    expect(hits).toBeLessThan(40);
    const b = new World({ seed: 1, dungeon: 'kiln', omens: [], bounty: 5 });
    for (let k = 0; k < 10; k++) expect(inner(b).withSet(piece('head')).set).toBeUndefined();
  });

  it('Wrackrider: standing still plants you (2: less damage taken, 3: more damage dealt), and it lingers a moment', () => {
    for (const n of [1, 2, 3]) {
      const w = new World({ seed: 3, dungeon: 'kiln', route: ['pack', 'pack', 'pack', 'pack', 'kilnMother'] as never, omens: [], gear: gear('wrackrider', n) });
      while (w.phase !== 'fight') w.state === 'draft' ? w.choose(0) : w.step({ x: 0, y: 0 });
      for (let k = 0; k < 30; k++) w.step({ x: 0, y: 0 });
      expect(!!w.player.planted).toBe(n >= 2);
      if (n < 2) continue;
      const e = w.enemies.find((o) => o.alive) ?? w.enemies[0];
      expect(inner(w).setDamageMult(e, true)).toBeCloseTo(n >= 3 ? 1 + SET_TUNING.wrDamage : 1, 5);
      w.player.hp = w.player.maxHp;
      const hp = w.player.hp;
      inner(w).hurtPlayer(50);
      expect(hp - w.player.hp).toBeCloseTo(50 * (1 - SET_TUNING.wrCut), 3);
      // Walking off keeps you Planted for wrHold, then it fades.
      w.step({ x: 1, y: 0 });
      expect(w.player.planted).toBe(true);
      for (let k = 0; k < Math.ceil(SET_TUNING.wrHold * 30) + 2; k++) w.step({ x: 1, y: 0 });
      expect(w.player.planted).toBe(false);
    }
  });

  it('Wrackrider: in the Wrackline a raft keeps you Planted while you walk', () => {
    const w = new World({ seed: 5, dungeon: 'wrackline', omens: [], gear: gear('wrackrider', 2), invulnerable: true });
    while (w.phase !== 'fight' || !w.rafts.length) w.state === 'draft' ? w.choose(0) : w.step({ x: 0, y: 0 });
    const r = w.rafts[0];
    Object.assign(w.player, { x: r.x, y: r.y, stillT: 0, plantT: 0 });
    w.step({ x: 0.001, y: 1 });
    expect(w.player.moving).toBe(true);
    expect(w.player.planted).toBe(true);
  });

  it('Deepguard: an ally close by cuts your damage (2), and a 3-piece wearer guards the allies near it; nothing solo', () => {
    const solo = world(gear('deepguard', 3));
    const hp = solo.player.hp;
    inner(solo).hurtPlayer(50);
    expect(hp - solo.player.hp).toBeCloseTo(50, 3);

    const party = (me: number, ally: number) => {
      const w = new World({ seed: 3, dungeon: 'hammerdeep', omens: [], gear: gear('deepguard', me), party: [{ cls: 'lumen', gear: gear('deepguard', ally) }] });
      const a = w.hero(1).player;
      Object.assign(a, { x: w.player.x + 60, y: w.player.y });
      return w;
    };
    const taken = (w: World) => { w.player.hp = w.player.maxHp; const h0 = w.player.hp; inner(w).hurtPlayer(100); return h0 - w.player.hp; };
    expect(taken(party(0, 0))).toBeCloseTo(100, 3);
    expect(taken(party(2, 0))).toBeCloseTo(100 * (1 - SET_TUNING.dgCut), 3);
    expect(taken(party(0, 3))).toBeCloseTo(100 * (1 - SET_TUNING.dgAura), 3);
    expect(taken(party(3, 3))).toBeCloseTo(100 * (1 - SET_TUNING.dgCut) * (1 - SET_TUNING.dgAura), 3);
    // Too far apart: nothing.
    const far = party(3, 3);
    Object.assign(far.hero(1).player, { x: far.player.x + SET_TUNING.dgRange + 40, y: far.player.y });
    expect(taken(far)).toBeCloseTo(100, 3);
  });

  it('Ventwalker: split from every living ally for more damage (2); a gold circle heals its wearer (3)', () => {
    const solo = world(gear('ventwalker', 3));
    const e0 = solo.enemies.find((o) => o.alive) ?? solo.enemies[0];
    expect(inner(solo).setDamageMult(e0, true)).toBe(1);

    const w = new World({ seed: 3, dungeon: 'ashvents', omens: [], gear: gear('ventwalker', 3), party: [{ cls: 'lumen' }] });
    const e = w.enemies.find((o) => o.alive) ?? w.enemies[0];
    const ally = w.hero(1).player;
    Object.assign(ally, { x: w.player.x + 60, y: w.player.y });
    expect(inner(w).setDamageMult(e, true)).toBe(1);
    Object.assign(ally, { x: w.player.x + SET_TUNING.dgRange + 40, y: w.player.y });
    expect(inner(w).setDamageMult(e, true)).toBeCloseTo(1 + SET_TUNING.vwDamage, 5);
    ally.hp = 0;
    expect(inner(w).setDamageMult(e, true)).toBe(1);
    ally.hp = ally.maxHp;

    // A gold circle lands on the wearer: it heals.
    w.player.hp = w.player.maxHp * 0.5;
    const before = w.player.hp;
    inner(w).addTelegraph('circle', w.player.x, w.player.y, 70, 0, 0, 0.01, 0, 'soak');
    w.step({ x: 0, y: 0 });
    expect(w.player.hp).toBeGreaterThan(before + w.player.maxHp * SET_TUNING.vwHeal * 0.9);
  });
});
