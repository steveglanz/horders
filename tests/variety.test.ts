import { describe, expect, it } from 'vitest';
import { World, VARIETY, LAYOUT, LAYOUTS, KILN_DRAW, KILN_VARIANTS } from '../sim/world';
import { applySnapshot, snapshot } from '../sim/netsync';
import { DUNGEONS, ENCOUNTERS, rollRoute } from '../sim/content/dungeon';
import { FIRST_DELVE } from '../sim/content/firstdelve';
import { HEAT_IDS, HEAT_TUNING, heatFor } from '../sim/content/heat';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  runAbilities(i: number, dt: number): void;
  finishCast(i: number): void;
  runStationary(i: number, dt: number): void;
};

/** A Kiln fight with every foe cleared, so a test can place its own. */
function kiln(): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}

const step = (w: World, n: number) => { for (let k = 0; k < n; k++) w.step({ mx: 0, my: 0 } as never); };

describe('V1 variety: the Kiln\'s new foes', () => {
  it('the Kiln draws from 6 openers and 4 named fights, and the first delve keeps its fixed route', () => {
    const d = DUNGEONS.kiln;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(4);
    for (const id of [...d.openers, ...d.named]) expect(ENCOUNTERS[id]).toBeDefined();
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) { let n = s; seen.add(rollRoute((k) => (n = (n * 7 + 3) % 97) % k, 'kiln').join(',')); }
    expect(seen.size).toBeGreaterThan(20);
    expect(FIRST_DELVE.route).toEqual(['pack', 'wardens', 'brute', 'acolytes', 'kilnMother']);
  });

  it('an Ember Spitter backs off when you close in, and lobs a fire circle where you stand', () => {
    const { w, inner } = kiln();
    const i = inner.spawn('emberSpitter', 100, 0);
    const e = w.enemies[i];
    e.abilityT = 99;
    step(w, 10);
    expect(Math.hypot(e.x, e.y)).toBeGreaterThan(100); // moved away from the hero
    e.abilityT = 0;
    w.player.x = e.x - 200; w.player.y = e.y;
    inner.runAbilities(i, 0.01);
    expect(e.castId).toBe('emberLob');
    const t = w.telegraphs.find((q) => q.alive && q.owner === i)!;
    expect(t.shape).toBe('circle');
    expect(t.r).toBe(VARIETY.lobRadius);
    expect(t.x).toBeCloseTo(w.player.x, 5);
    expect(w.events.some((ev) => ev.type === 'spitLob')).toBe(true);
  });

  it('an Ashbuck shows its lane, then charges straight down it', () => {
    const { w, inner } = kiln();
    const i = inner.spawn('ashbuck', 250, 0);
    const e = w.enemies[i];
    e.abilityT = 0;
    inner.runAbilities(i, 0.01);
    expect(e.castId).toBe('charge');
    const t = w.telegraphs.find((q) => q.alive && q.owner === i)!;
    expect(t.shape).toBe('cone');
    expect(t.angle).toBeCloseTo(Math.PI, 3); // toward the hero at the origin
    inner.finishCast(i);
    expect(w.events.some((ev) => ev.type === 'charge')).toBe(true);
    const x0 = e.x;
    w.player.x = 0; w.player.y = 300; // the hero steps aside: the charge doesn't steer
    step(w, 6);
    expect(x0 - e.x).toBeGreaterThan(100);
    expect(Math.abs(e.y)).toBeLessThan(40);
  });

  it('a Hollow Rift in a dungeon fight keeps at most riftCap Ashlings out', () => {
    const { w, inner } = kiln();
    const r = inner.spawn('rift', 200, 0);
    for (let k = 0; k < 10; k++) { w.enemies[r].abilityT = 0; inner.runStationary(r, 0.01); }
    expect(w.enemies.filter((e) => e.alive && e.kind === 'ashling').length).toBe(VARIETY.riftCap);
  });
});

describe('V2 variety: arena layouts', () => {
  type L = { rollLayout(id: string): void; layoutClock(dt: number): void; clampArena(o: { x: number; y: number }, r: number): void; encounter: number };

  it('Kiln fights roll layouts from the seed alone; the boss fight and the first delve stay open', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const w = new World({ seed, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
      const q = w as unknown as L;
      q.encounter = 1;
      q.rollLayout('pack');
      seen.add(w.layout);
      const again = new World({ seed, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
      (again as unknown as L).encounter = 1;
      (again as unknown as L).rollLayout('pack');
      expect(again.layout).toBe(w.layout);
      q.rollLayout('kilnMother');
      expect(w.layout).toBe('open');
    }
    expect([...seen].sort()).toEqual([...new Set(LAYOUTS.kiln)].sort());
    const first = new World({ seed: 4, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright', firstDelve: true });
    (first as unknown as L).rollLayout('pack');
    expect(first.layout).toBe('open');
    const glare = new World({ seed: 4, dungeon: 'glarewell', tier: 7, omens: [], cls: 'emberwright' });
    (glare as unknown as L).rollLayout('shades');
    expect(glare.layout).toBe('open');
  });

  it('stones block, lava burns only inside its width, and vents flare one at a time', () => {
    const w = new World({ seed: 2, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    const q = w as unknown as L;
    w.stones = [{ x: 100, y: 0, r: LAYOUT.stoneRadius }];
    const o = { x: 100, y: 5 };
    q.clampArena(o, 10);
    expect(Math.hypot(o.x - 100, o.y)).toBeGreaterThanOrEqual(LAYOUT.stoneRadius + 10 - 1e-6);
    w.layout = 'channel';
    w.lava = [{ x1: -500, y1: 0, x2: 500, y2: 0, w: LAYOUT.lavaWidth }];
    w.player.x = 0; w.player.y = 10;
    const hp = w.player.hp;
    q.layoutClock(1);
    expect(w.player.hp).toBeLessThan(hp);
    w.player.hp = w.player.maxHp; w.player.y = LAYOUT.lavaWidth;
    q.layoutClock(1);
    expect(w.player.hp).toBe(w.player.maxHp);
    w.lava = [];
    w.layout = 'vents';
    w.flareVents = [{ x: 200, y: 0 }, { x: -200, y: 0 }];
    (w as unknown as { flareT: number }).flareT = 0;
    q.layoutClock(0.01);
    expect(w.telegraphs.filter((t) => t.alive)).toHaveLength(1);
    expect(w.events).toContainEqual({ type: 'ventFlare', x: 200, y: 0 });
  });

  it('online co-op: a guest sees the same layout', () => {
    const w = new World({ seed: 2, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    w.layout = 'pillars';
    w.stones = [{ x: 1, y: 2, r: 3 }];
    w.lava = [{ x1: 0, y1: 0, x2: 1, y2: 1, w: 70 }];
    w.flareVents = [{ x: 5, y: 6 }];
    const g = new World({ seed: 2, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.layout).toBe('pillars');
    expect(g.stones).toEqual(w.stones);
    expect(g.lava).toEqual(w.lava);
    expect(g.flareVents).toEqual(w.flareVents);
  });
});

describe('V3 variety: the Kiln Mother\'s Kiln Draw', () => {
  type B = Inner & { bossIndex: number; bossSpawned: boolean; bossPhase: number; rollKilnVariant(): string; runBoss(i: number, dt: number): void };

  /** A Kiln fight with only the Kiln Mother up, in phase 2, Cataclysm due now. */
  function mother(variant: 'cataclysm' | 'draw'): { w: World; q: B; b: number } {
    const { w, inner } = kiln();
    const q = inner as B;
    const b = q.spawn('kilnMother', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = variant;
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.5;
    q.bossPhase = 2;
    e.aux = 0;
    w.player.x = 200; w.player.y = 0;
    return { w, q, b };
  }

  it('rolls from the seed alone, both versions show up, and the first delve keeps Molten Cataclysm', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' }) as unknown as B;
      const b = new World({ seed, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' }) as unknown as B;
      expect(a.rollKilnVariant()).toBe(b.rollKilnVariant());
      seen.add(a.rollKilnVariant());
    }
    expect([...seen].sort()).toEqual([...KILN_VARIANTS].sort());
    for (let seed = 1; seed <= 10; seed++) {
      const f = new World({ seed, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright', firstDelve: true }) as unknown as B;
      expect(f.rollKilnVariant()).toBe('cataclysm');
    }
  });

  it('phase 1 is the same in both: Molten Cataclysm', () => {
    const { w, q, b } = mother('draw');
    q.bossPhase = 1;
    w.enemies[b].hp = w.enemies[b].maxHp;
    q.runBoss(b, 0.01);
    expect(w.enemies[b].castId).toBe('cataclysm');
  });

  it('from phase 2 the draw version breathes in: not interruptible, a fire circle on her, and it pulls you in', () => {
    const { w, q, b } = mother('draw');
    q.runBoss(b, 0.01);
    const e = w.enemies[b];
    expect(e.castId).toBe('kilnDraw');
    expect(e.interruptible).toBe(false);
    const t = w.telegraphs.find((x) => x.alive && x.owner === b)!;
    expect(t.r).toBe(KILN_DRAW.radius);
    expect(t.x).toBe(e.x);
    q.runAbilities(b, 1);
    expect(w.player.x).toBeCloseTo(200 - KILN_DRAW.pull, 5);
    // It never drags you into her body.
    w.player.x = e.def.radius + 13;
    q.runAbilities(b, 1);
    expect(w.player.x).toBeGreaterThanOrEqual(e.def.radius + 12 - 1e-9);
  });

  it('standing still in reach gets you burned; walking out against the pull escapes it', () => {
    for (const walk of [false, true]) {
      const { w, q, b } = mother('draw');
      w.player.x = 120;
      q.runBoss(b, 0.01);
      const hp = w.player.hp;
      for (let k = 0; k < 30 * (KILN_DRAW.cast + 0.2); k++) w.step({ x: walk ? 1 : 0, y: 0 } as never);
      if (walk) expect(w.player.hp).toBe(hp);
      else expect(w.player.hp).toBeLessThan(hp);
    }
  });

  it('the cataclysm version keeps Molten Cataclysm in phase 2', () => {
    const { w, q, b } = mother('cataclysm');
    q.runBoss(b, 0.01);
    expect(w.enemies[b].castId).toBe('cataclysm');
  });

  it('online co-op: a guest sees the same version', () => {
    const w = new World({ seed: 2, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    w.bossVariant = 'draw';
    const g = new World({ seed: 2, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.bossVariant).toBe('draw');
  });
});

describe('V4 variety: the Day\'s Heat', () => {
  type H = { rollLayout(id: string): void; encounter: number; gainXp(v: number): void };
  const opts = { seed: 5, dungeon: 'kiln' as const, tier: 1, omens: [], cls: 'emberwright' as const };

  it('is the same all day for everyone, uses every Heat, and only the Kiln below tier 3 keeps it', () => {
    expect(heatFor(20414)).toBe(heatFor(20414));
    const seen = new Set<string>();
    for (let d = 20000; d < 20060; d++) seen.add(heatFor(d));
    expect([...seen].sort()).toEqual([...HEAT_IDS].sort());
    expect(new World({ ...opts, heat: 'quickStudy' }).heat).toBe('quickStudy');
    expect(new World({ ...opts, tier: 2, heat: 'quickStudy' }).heat).toBe('quickStudy');
    expect(new World({ ...opts, tier: 3, heat: 'quickStudy' }).heat).toBe('');
    expect(new World({ ...opts, dungeon: 'foundry', tier: 1, heat: 'quickStudy' }).heat).toBe('');
    expect(new World({ ...opts, heat: 'quickStudy', firstDelve: true }).heat).toBe('');
    expect(new World({ ...opts, heat: 'quickStudy', bounty: 20414 }).heat).toBe('');
    expect(new World({ ...opts }).heat).toBe('');
  });

  it('a floor Heat fixes every non-boss layout; the boss stays open', () => {
    for (const [heat, layout] of [['stoneFloor', 'pillars'], ['ventFloor', 'vents']] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const w = new World({ ...opts, seed, heat });
        const q = w as unknown as H;
        q.encounter = 1;
        q.rollLayout('pack');
        expect(w.layout).toBe(layout);
        q.rollLayout('kilnMother');
        expect(w.layout).toBe('open');
      }
    }
  });

  it('Rich Haul raises loot luck', () => {
    expect(new World({ ...opts, heat: 'richHaul' }).luck).toBeCloseTo(new World({ ...opts }).luck * HEAT_TUNING.richHaulLuck, 9);
  });

  it('Quick Study gives more experience', () => {
    const a = new World({ ...opts });
    const b = new World({ ...opts, heat: 'quickStudy' });
    (a as unknown as H).gainXp(1);
    (b as unknown as H).gainXp(1);
    expect(b.player.xp).toBeCloseTo(a.player.xp * HEAT_TUNING.quickStudyXp, 9);
  });

  it('online co-op: a guest sees the same Heat', () => {
    const w = new World({ ...opts, heat: 'ventFloor' });
    const g = new World({ ...opts });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.heat).toBe('ventFloor');
  });
});

describe('V8 variety: the Drowned Foundry', () => {
  type L = { rollLayout(id: string): void; encounter: number };
  it('draws from 6 openers and 3 named fights, all defined', () => {
    const d = DUNGEONS.foundry;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(3);
    for (const id of [...d.openers, ...d.named, ...d.hard]) expect(ENCOUNTERS[id]).toBeDefined();
  });

  it('rolls stones or steam vents but never lava, and Maelra\'s fight stays open', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const w = new World({ seed, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' });
      const q = w as unknown as L;
      q.encounter = 1;
      q.rollLayout('twins');
      seen.add(w.layout);
      q.rollLayout('maelra');
      expect(w.layout).toBe('open');
    }
    expect([...seen].sort()).toEqual(['open', 'pillars', 'vents']);
  });
});
