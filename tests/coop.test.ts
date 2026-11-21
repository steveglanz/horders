import { describe, expect, it } from 'vitest';
import { World, WorldOptions, REVIVE_HEALTH, REVIVE_RADIUS, REVIVE_RULES, TICK, VEIN_TIME } from '../sim/world';
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

  it('an ally standing on a downed hero for 3 s picks them up mid-fight', () => {
    const w = new World({ seed: 8, party: party(2) });
    run(w, () => w.phase === 'fight');
    const down = w.hero(1).player, ally = w.hero(0).player;
    down.hp = 0;
    const still = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const hold = () => { ally.hp = ally.maxHp = 1e6; ally.x = down.x + REVIVE_RADIUS - 5; ally.y = down.y; };
    hold();
    w.step(still);
    expect(down.hp).toBe(0);
    let events: string[] = [];
    for (let t = 0; t < Math.round(2.8 / TICK); t++) { hold(); w.step(still); }
    expect(down.hp).toBe(0); // not yet at 2.8 s
    for (let t = 0; t < Math.round(0.3 / TICK) && down.hp === 0; t++) { hold(); w.step(still); events = w.events.map((e) => e.type); }
    expect(down.hp).toBeCloseTo(down.maxHp * REVIVE_HEALTH, 5);
    expect(events).toContain('revive');
    expect(w.events.find((e) => e.type === 'revive')).toMatchObject({ hero: 1, by: 0 });
  });

  it('while a boss is up, a pick-up is slower and the party gets bossCap of them', () => {
    const w = new World({ seed: 8, party: party(3) });
    run(w, () => w.phase === 'fight' && w.enemies.length > 0);
    // Stand in a boss: any living enemy, made unkillable.
    w.bossSpawned = true;
    w.bossIndex = 0;
    const boss = w.enemies[0];
    boss.hp = boss.maxHp = 1e9;
    expect(w.bossUp).toBe(true);
    expect(w.reviveSeconds).toBe(REVIVE_RULES.bossSeconds);
    expect(w.revivesLeft).toBe(REVIVE_RULES.bossCap);
    const [a, b, c] = [0, 1, 2].map((i) => w.hero(i).player);
    const still = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    const on = (q: typeof b) => () => { a.hp = a.maxHp = 1e6; a.x = q.x + 10; a.y = q.y; boss.hp = 1e9; };
    b.hp = 0;
    c.hp = 0;
    c.x = b.x + REVIVE_RADIUS * 4; c.y = b.y;
    const onB = on(b);
    for (let t = 0; t < Math.round((REVIVE_RULES.seconds + 0.2) / TICK); t++) { onB(); w.step(still); }
    expect(b.hp).toBe(0); // the trash-fight 3 s is not enough with a boss up
    for (let t = 0; t < Math.round(REVIVE_RULES.bossSeconds / TICK) && b.hp === 0; t++) { onB(); w.step(still); }
    expect(b.hp).toBeGreaterThan(0);
    expect(w.revivesLeft).toBe(REVIVE_RULES.bossCap - 1);
    if (REVIVE_RULES.bossCap === 1) {
      const onC = on(c);
      for (let t = 0; t < Math.round((REVIVE_RULES.bossSeconds + 1) / TICK); t++) { onC(); w.step(still); }
      expect(c.hp).toBe(0); // the cap is used up
      expect(c.reviveT ?? 0).toBe(0);
    }
    // The boss falls: back to trash rules, with no cap.
    w.enemies[0].hp = 0;
    expect(w.bossUp).toBe(false);
    expect(w.reviveSeconds).toBe(REVIVE_RULES.seconds);
    expect(w.revivesLeft).toBe(Infinity);
  });

  it('stepping off a downed hero resets the revive, and the downed cannot revive each other', () => {
    const w = new World({ seed: 8, party: party(3) });
    run(w, () => w.phase === 'fight');
    const [a, b, c] = [0, 1, 2].map((i) => w.hero(i).player);
    b.hp = 0;
    c.hp = 0;
    c.x = b.x; c.y = b.y; // a downed hero on top of another does nothing
    const still = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    const near = () => { a.hp = a.maxHp = 1e6; a.x = b.x + 10; a.y = b.y; };
    const far = () => { a.hp = a.maxHp = 1e6; a.x = b.x + REVIVE_RADIUS * 3; a.y = b.y; };
    for (let t = 0; t < Math.round(2 / TICK); t++) { near(); w.step(still); }
    for (let t = 0; t < 2; t++) { far(); w.step(still); }
    for (let t = 0; t < Math.round(2 / TICK); t++) { near(); w.step(still); }
    expect(b.hp).toBe(0); // 2 s + 2 s with a gap is not 3 s in a row
    for (let t = 0; t < Math.round(1.2 / TICK); t++) { near(); w.step(still); }
    expect(b.hp).toBeGreaterThan(0);
    expect(c.hp).toBeGreaterThan(0); // c lies on the same spot, so the same ally picks both up
  });

  it('telegraphs land on time with any party size and hit every hero inside', () => {
    let solo = -1;
    for (const n of [1, 2, 4]) {
      const w = new World({ seed: 8, party: n > 1 ? party(n) : undefined });
      run(w, () => w.phase === 'fight');
      for (const e of w.enemies) e.alive = false;
      const ps = w.heroes.map((_, i) => w.hero(i).player);
      ps.forEach((q, i) => { q.hp = q.maxHp; q.x = 10 * i; q.y = 0; });
      const priv = w as unknown as { addTelegraph: (...a: unknown[]) => void };
      priv.addTelegraph('circle', 0, 0, 120, 0, 0, 1.0, 20);
      const still = w.heroes.map(() => ({ x: 0, y: 0 }));
      let landed = -1;
      for (let t = 1; t <= 60 && landed < 0; t++) {
        w.step(still);
        if (w.events.some((e) => e.type === 'slam')) landed = t;
      }
      // A 1 s telegraph lands on the tick it reaches 1 s (30 or 31 with float steps), the same for every party size.
      if (n === 1) solo = landed;
      expect(landed, `party of ${n}`).toBe(solo);
      expect(landed).toBeGreaterThanOrEqual(30);
      expect(landed).toBeLessThanOrEqual(31);
      for (const q of ps) expect(q.hp, `party of ${n}`).toBeLessThan(q.maxHp);
    }
  });

  it('a vein fills while one hero stands on it, even with an ally elsewhere', () => {
    const w = new World({ seed: 8, party: party(2) });
    run(w, () => w.phase === 'fight');
    for (const e of w.enemies) e.alive = false;
    const v = w.veins[0];
    Object.assign(v, { alive: true, x: 0, y: 0, progress: 0 });
    const [a, b] = [w.hero(0).player, w.hero(1).player];
    a.x = 300; a.y = 300; b.x = 0; b.y = 0;
    const still = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    let gathered = false;
    for (let t = 0; t < Math.round((VEIN_TIME + 0.2) / TICK) && !gathered; t++) {
      w.step(still);
      gathered = w.events.some((e) => e.type === 'gather');
    }
    expect(gathered).toBe(true);
  });

  it('a pulled gem flies to one hero and is collected', () => {
    const w = new World({ seed: 8, party: party(2) });
    run(w, () => w.phase === 'fight');
    for (const e of w.enemies) e.alive = false;
    for (const g of w.gems) g.alive = false;
    const [a, b] = [w.hero(0).player, w.hero(1).player];
    a.x = -400; a.y = 0; b.x = 400; b.y = 0;
    const g = w.gems[0];
    Object.assign(g, { alive: true, x: 380, y: 0, px: 380, py: 0, value: 1, pulled: false });
    const xp = b.xp, lvl = b.level;
    const still = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    for (let t = 0; t < 30 && g.alive; t++) w.step(still);
    expect(g.alive).toBe(false);
    expect(b.xp > xp || b.level > lvl).toBe(true);
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

describe('co-op threat from class kits', () => {
  type Inner = { charge(): void; sidestep(input: { x: number; y: number }): void; use(i: number): void; spawn(kind: string, x: number, y: number): number };

  it('Bulwark Charge taunts its target onto the Bulwark', () => {
    const w = new World({ seed: 4, cls: 'bulwark', party: [{ cls: 'duskblade' }] });
    const inner = w as unknown as Inner;
    for (const e of w.enemies) e.alive = false;
    inner.use(0);
    const i = inner.spawn('cinderBrute', w.player.x + 200, w.player.y);
    w.threat[i].amounts = { [w.heroes[1].id]: 500 };
    inner.charge();
    expect(w.threat[i].forced).toBe(w.heroes[0].id);
    expect(w.threat[i].amounts[w.heroes[0].id]).toBeGreaterThan(500);
  });

  it('Duskblade Sidestep halves its threat on every enemy', () => {
    const w = new World({ seed: 4, cls: 'bulwark', party: [{ cls: 'duskblade' }] });
    const inner = w as unknown as Inner;
    const dusk = w.heroes[1].id;
    w.threat[0].amounts = { [dusk]: 80 };
    w.threat[1].amounts = { [dusk]: 40 };
    inner.use(1);
    inner.sidestep({ x: 1, y: 0 });
    inner.use(0);
    expect(w.threat[0].amounts[dusk]).toBeCloseTo(40, 5);
    expect(w.threat[1].amounts[dusk]).toBeCloseTo(20, 5);
  });

  it('healing adds threat split across living enemies', () => {
    const w = new World({ seed: 4, cls: 'lumen', party: [{ cls: 'bulwark' }] });
    const inner = w as unknown as Inner;
    for (const e of w.enemies) e.alive = false;
    inner.use(0);
    const a = inner.spawn('cinderBrute', 300, 0);
    const b = inner.spawn('cinderBrute', -300, 0);
    w.player.hp = w.player.maxHp - 40;
    const healed = w.healPlayer(40);
    const id = w.heroes[0].id;
    expect(healed).toBeCloseTo(40, 5);
    expect(w.threat[a].amounts[id]).toBeCloseTo(10, 5);
    expect(w.threat[b].amounts[id]).toBeCloseTo(10, 5);
  });
});

describe('co-op healing from the Lumen', () => {
  type Inner = { radiantBurst(): void; sunmote(t: number): void; use(i: number): void; spawn(kind: string, x: number, y: number): number; rebuildHash(): void };

  /** A Lumen (hero 0) with a wounded Bulwark (hero 1) beside it and no enemies. */
  function pair(dist: number) {
    const w = new World({ seed: 4, cls: 'lumen', party: [{ cls: 'bulwark' }] });
    const inner = w as unknown as Inner;
    for (const e of w.enemies) e.alive = false;
    inner.use(0);
    const tank = w.heroes[1].player;
    tank.x = w.player.x + dist;
    tank.y = w.player.y;
    tank.hp = tank.maxHp * 0.5;
    inner.rebuildHash();
    return { w, inner, tank };
  }

  it('Radiant Burst heals allies inside its radius, not beyond it', () => {
    const near = pair(60);
    const hp0 = near.tank.hp;
    near.inner.radiantBurst();
    expect(near.tank.hp).toBeCloseTo(hp0 + 15, 5);

    const far = pair(near.w.burstRadius + 50);
    const hp1 = far.tank.hp;
    far.inner.radiantBurst();
    expect(far.tank.hp).toBe(hp1);
  });

  it("Sunmote's heal goes to the most wounded hero in range", () => {
    const { w, inner, tank } = pair(200);
    const t = inner.spawn('cinderBrute', w.player.x + 300, w.player.y);
    inner.rebuildHash();
    w.player.hp = w.player.maxHp * 0.9;
    const mine = w.player.hp;
    const hp0 = tank.hp;
    inner.sunmote(t);
    expect(tank.hp).toBeGreaterThan(hp0);
    expect(w.player.hp).toBe(mine);
  });

  it('ally healing draws threat for the Lumen and skips downed heroes', () => {
    const { w, inner, tank } = pair(60);
    const a = inner.spawn('cinderBrute', 300, 0);
    inner.rebuildHash();
    inner.radiantBurst();
    expect(w.threat[a].amounts[w.heroes[0].id]).toBeGreaterThan(0);
    tank.hp = 0;
    expect(w.healAllies(w.player.x, w.player.y, 500, 50)).toBe(0);
    expect(tank.hp).toBe(0);
  });

  it('does nothing solo', () => {
    const w = new World({ seed: 4, cls: 'lumen' });
    expect(w.healAllies(0, 0, 1000, 50)).toBe(0);
  });

  it('tags personal events with the hero they belong to', () => {
    const w = new World({ seed: 8, party: party(2) });
    const hurt = w as unknown as { use(i: number): void; hurtPlayer(a: number, src?: number): void; events: { type: string; hero?: number }[] };
    hurt.use(1);
    hurt.hurtPlayer(5, -1);
    hurt.use(0);
    expect(w.events.filter((e) => e.type === 'playerHurt').map((e) => e.hero)).toEqual([1]);
  });

  it('in a party every hero carries a Brand, and bunching up stacks the bursts', () => {
    const hits = (spread: boolean) => {
      const w = new World({ seed: 8, dungeon: 'glarewell', tier: 7, party: party(3) });
      const W = w as unknown as { burstBrand(): void; events: { type: string; hero?: number; amount?: number }[] };
      for (let h = 0; h < 3; h++) Object.assign(w.hero(h).player, { x: spread ? h * 400 : h * 5, y: 0 });
      w.events.length = 0;
      W.burstBrand();
      const per = [0, 0, 0];
      for (const e of W.events) if (e.type === 'playerHurt') per[e.hero!]++;
      return { per, bursts: W.events.filter((e) => e.type === 'brandBurst').length, acting: w.acting };
    };
    const apart = hits(true);
    expect(apart.bursts).toBe(3);
    expect(apart.per).toEqual([1, 1, 1]);
    const together = hits(false);
    expect(together.per).toEqual([3, 3, 3]);
    expect(together.acting).toBe(0);
  });

  it("in a party the Lensmother's Glare burns every hero in the light, not just her target", () => {
    const w = new World({ seed: 8, dungeon: 'glarewell', tier: 7, party: party(3) });
    const W = w as unknown as { finishCast(i: number): void; shadowed(x: number, y: number): boolean; events: { type: string; hero?: number }[] };
    // Stand all three heroes where no pillar shades them.
    let x = 0;
    while (W.shadowed(x, 0) && x < 2000) x += 25;
    for (let h = 0; h < 3; h++) Object.assign(w.hero(h).player, { x: x + h * 3, y: 0 });
    w.enemies[0].alive = true;
    w.enemies[0].castId = 'glare';
    w.events.length = 0;
    W.finishCast(0);
    const hurt = W.events.filter((e) => e.type === 'playerHurt').map((e) => e.hero).sort();
    expect(hurt).toEqual([0, 1, 2]);
    expect(w.acting).toBe(0);
  });
});
