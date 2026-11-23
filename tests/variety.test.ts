import { describe, expect, it } from 'vitest';
import { World, VARIETY, LAYOUT, LAYOUTS, KILN_DRAW, KILN_VARIANTS, MAELRA_VARIANTS, SLUICETIDE, LENS_VARIANTS, GLINTFALL, NHEVRA_VARIANTS, EMBERDRIFT, HESSA_VARIANTS, OUTSURGE, ONDREL_VARIANTS, IRONLOAD, YSMERET_VARIANTS, WANDER, YSMERET, SLAG_VARIANTS, BRIM, SLAG, ARENA_EVENTS, ARENA_EVENT_POOLS } from '../sim/world';
import { applySnapshot, snapshot } from '../sim/netsync';
import { botInput } from '../sim/bot';
import { DUNGEONS, ENCOUNTERS, rollRoute } from '../sim/content/dungeon';
import { FIRST_DELVE } from '../sim/content/firstdelve';
import { HEAT_IDS, HEAT_POOLS, HEAT_TUNING, heatFits, heatFor } from '../sim/content/heat';

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
    const wrack = new World({ seed: 4, dungeon: 'wrackline', tier: 13, omens: [], cls: 'emberwright' });
    (wrack as unknown as L).rollLayout('lurkers');
    expect(wrack.layout).toBe('open');
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

  it('a bot pressed against the lava by a Brute crosses it, and otherwise keeps off it', () => {
    const w = new World({ seed: 2, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    while (!(w.phase === 'fight' && w.enemies.some((e) => e.alive))) w.step(botInput(w));
    for (const e of w.enemies) e.alive = false;
    const q = w as unknown as { spawn(kind: string, x: number, y: number): number };
    w.lava = [{ x1: 0, y1: -500, x2: 0, y2: 500, w: LAYOUT.lavaWidth }];
    w.player.x = -(LAYOUT.lavaWidth / 2 + 20); w.player.y = 0;
    const calm = botInput(w);
    expect(calm.x).toBeLessThan(0);
    const b = q.spawn('cinderBrute', -150, 0);
    w.enemies[b].castId = '';
    const pressed = botInput(w);
    expect(pressed.x).toBeGreaterThan(0);
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

  it('is the same all day for everyone, uses every Heat, and a solo dungeon keeps it at any tier', () => {
    expect(heatFor(20414)).toBe(heatFor(20414));
    const seen = new Set<string>();
    for (let d = 20000; d < 20060; d++) seen.add(heatFor(d));
    expect([...seen].sort()).toEqual([...HEAT_POOLS.kiln!].sort());
    expect(new World({ ...opts, heat: 'quickStudy' }).heat).toBe('quickStudy');
    expect(new World({ ...opts, tier: 2, heat: 'quickStudy' }).heat).toBe('quickStudy');
    // Phase 14 X1: every solo dungeon, every tier; never a group dungeon or a raid.
    expect(new World({ ...opts, tier: 3, heat: 'quickStudy' }).heat).toBe('quickStudy');
    expect(new World({ ...opts, dungeon: 'foundry', tier: 4, heat: 'quickStudy' }).heat).toBe('quickStudy');
    expect(new World({ ...opts, dungeon: 'hammerdeep', tier: 4, heat: 'quickStudy' }).heat).toBe('');
    expect(new World({ ...opts, dungeon: 'crucible', tier: 8, heat: 'richHaul' }).heat).toBe('');
    expect(new World({ ...opts, heat: 'quickStudy', firstDelve: true }).heat).toBe('');
    expect(new World({ ...opts, heat: 'quickStudy', bounty: 20414 }).heat).toBe('');
    expect(new World({ ...opts }).heat).toBe('');
  });

  it('Phase 14 X1: each solo dungeon picks from its own pool, and a floor it has no layout for never comes', () => {
    for (const dg of Object.keys(HEAT_POOLS) as (keyof typeof HEAT_POOLS)[]) {
      const pool = HEAT_POOLS[dg]!;
      const seen = new Set<string>();
      for (let d = 20000; d < 20120; d++) seen.add(heatFor(d, dg));
      expect([...seen].sort(), dg).toEqual([...pool].sort());
      const floors = LAYOUTS[dg] ?? [];
      if (pool.includes('stoneFloor')) expect(floors, dg).toContain('pillars');
      else expect(floors, dg).not.toContain('pillars');
      if (pool.includes('ventFloor')) expect(floors, dg).toContain('vents');
      else expect(floors, dg).not.toContain('vents');
      for (const h of HEAT_IDS) expect(heatFits(dg, h), `${dg} ${h}`).toBe(pool.includes(h));
    }
    // The Kiln's Heat on any day is the V4 pick.
    for (let d = 20000; d < 20060; d++) expect(heatFor(d, 'kiln')).toBe(heatFor(d));
    // Stone Floor can't come to the Glarewell, so the sim drops it; Vent Floor stays.
    expect(new World({ ...opts, dungeon: 'glarewell', tier: 7, heat: 'stoneFloor' }).heat).toBe('');
    expect(new World({ ...opts, dungeon: 'glarewell', tier: 7, heat: 'ventFloor' }).heat).toBe('ventFloor');
    expect(new World({ ...opts, dungeon: 'wrackline', tier: 13, heat: 'ventFloor' }).heat).toBe('');
    // Each dungeon's own Heat comes only there.
    expect(new World({ ...opts, dungeon: 'kiln', tier: 1, heat: 'thickSteam' }).heat).toBe('');
    expect(new World({ ...opts, dungeon: 'foundry', tier: 4, heat: 'thickSteam' }).heat).toBe('thickSteam');
  });

  it('Phase 14 X1: the dungeons\' own Heats change their signature mechanic', () => {
    const base = { seed: 3, omens: [], cls: 'emberwright' as const };
    const sun = new World({ ...base, dungeon: 'glarewell', tier: 7, heat: 'highSun' });
    expect(sun.shadowLen).toBeCloseTo(new World({ ...base, dungeon: 'glarewell', tier: 7 }).shadowLen * HEAT_TUNING.sunShadow, 9);
    const coal = new World({ ...base, dungeon: 'coldmarrow', tier: 10, heat: 'brightCoal' });
    expect(coal.coalMaxR).toBeCloseTo(new World({ ...base, dungeon: 'coldmarrow', tier: 10 }).coalMaxR * HEAT_TUNING.coalRadius, 9);
    const steam = new World({ ...base, dungeon: 'foundry', tier: 4, heat: 'thickSteam' });
    expect(steam.temperEvery).toBeCloseTo(new World({ ...base, dungeon: 'foundry', tier: 4 }).temperEvery * HEAT_TUNING.steamTemper, 9);
    // The getters fall back to the plain tuning on a day without them.
    expect(new World({ ...base, dungeon: 'foundry', tier: 4, heat: 'quickStudy' }).temperEvery).toBe(new World({ ...base, dungeon: 'foundry', tier: 4 }).temperEvery);
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

describe('V8 variety: Maelra\'s Sluicetide', () => {
  type M = { spawn(kind: string, x: number, y: number): number; runMaelra(i: number, dt: number): void; startMaelra(): void;
    rollMaelraVariant(): string; bossIndex: number; bossSpawned: boolean; bossPhase: number };
  function maelra(variant: 'water' | 'tide'): { w: World; q: M; b: number } {
    const w = new World({ seed: 9, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' });
    const q = w as unknown as M;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('maelra', 300, 300);
    q.bossIndex = b; q.bossSpawned = true;
    q.startMaelra();
    w.bossVariant = variant;
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5; // phase 2
    w.enemies[b].abilityT = 99;
    w.player.x = 0; w.player.y = 0;
    return { w, q, b };
  }

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' }) as unknown as M;
      const b = new World({ seed, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' }) as unknown as M;
      expect(a.rollMaelraVariant()).toBe(b.rollMaelraVariant());
      seen.add(a.rollMaelraVariant());
    }
    expect([...seen].sort()).toEqual([...MAELRA_VARIANTS].sort());
  });

  it('Rising Water shrinks the arena; the Sluicetide keeps it and pushes you one way, then turns', () => {
    const water = maelra('water');
    const full = water.w.arenaR;
    water.q.runMaelra(water.b, 5);
    expect(water.w.arenaR).toBeLessThan(full);
    const { w, q, b } = maelra('tide');
    const r0 = w.arenaR;
    q.runMaelra(b, 0.01);
    expect(w.events.filter((e) => e.type === 'tideTurn')).toHaveLength(1);
    const a0 = w.tideAngle;
    w.player.x = 0; w.player.y = 0;
    q.runMaelra(b, 1);
    expect(w.player.x).toBeCloseTo(Math.cos(a0) * SLUICETIDE.drift, 5);
    expect(w.player.y).toBeCloseTo(Math.sin(a0) * SLUICETIDE.drift, 5);
    expect(w.arenaR).toBe(r0);
    q.runMaelra(b, SLUICETIDE.turnEvery);
    expect(w.events.filter((e) => e.type === 'tideTurn')).toHaveLength(2);
    expect(Math.abs(Math.cos(w.tideAngle - a0) + 1)).toBeGreaterThan(0.01); // never straight back
  });

  it('phase 1 has no tide', () => {
    const { w, q, b } = maelra('tide');
    w.enemies[b].hp = w.enemies[b].maxHp;
    q.runMaelra(b, 1);
    expect(w.events.some((e) => e.type === 'tideTurn')).toBe(false);
    expect(w.player.x).toBe(0);
  });

  it('online co-op: a guest sees the same version and current', () => {
    const { w } = maelra('tide');
    w.tideAngle = 1.25;
    const g = new World({ seed: 9, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.bossVariant).toBe('tide');
    expect(g.tideAngle).toBe(1.25);
  });
});

describe('V8 variety: the Glarewell', () => {
  type L = { rollLayout(id: string): void; encounter: number };
  it('draws from 6 openers and 3 named fights, and rolls only vents (it has its own pillars); the Lensmother stays open', () => {
    const d = DUNGEONS.glarewell;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(3);
    for (const id of [...d.openers, ...d.named, ...d.hard]) expect(ENCOUNTERS[id]).toBeDefined();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const w = new World({ seed, dungeon: 'glarewell', tier: 7, omens: [], cls: 'emberwright' });
      const q = w as unknown as L;
      q.encounter = 1;
      q.rollLayout('shades');
      seen.add(w.layout);
      q.rollLayout('lensmother');
      expect(w.layout).toBe('open');
    }
    expect([...seen].sort()).toEqual(['open', 'vents']);
  });
});

describe('V8 variety: the Lensmother\'s Glintfall', () => {
  type G = { spawn(kind: string, x: number, y: number): number; runLensmother(i: number, dt: number): void; rollLensVariant(): string;
    bossIndex: number; bossSpawned: boolean; bossPhase: number; bossBrandT: number; glareT: number; markT: number };
  function lens(variant: 'brand' | 'glint'): { w: World; q: G; b: number } {
    const w = new World({ seed: 6, dungeon: 'glarewell', tier: 7, omens: [], cls: 'emberwright' });
    const q = w as unknown as G;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('lensmother', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = variant;
    q.bossPhase = 2; q.markT = 0; q.bossBrandT = 0; q.glareT = 99;
    w.enemies[b].abilityT = 99;
    return { w, q, b };
  }

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'glarewell', tier: 7, omens: [], cls: 'emberwright' }) as unknown as G;
      const c = new World({ seed, dungeon: 'glarewell', tier: 7, omens: [], cls: 'emberwright' }) as unknown as G;
      expect(a.rollLensVariant()).toBe(c.rollLensVariant());
      seen.add(a.rollLensVariant());
    }
    expect([...seen].sort()).toEqual([...LENS_VARIANTS].sort());
  });

  it('the brand version still casts Twin Brand; the glint version drops light on every standing pillar', () => {
    const brand = lens('brand');
    brand.q.runLensmother(brand.b, 0.01);
    expect(brand.w.enemies[brand.b].castId).toBe('twinBrand');
    const { w, q, b } = lens('glint');
    w.pillars = [0, 1, 2, 3].map((k) => ({ x: 200 * Math.cos(k), y: 200 * Math.sin(k), r: 26, cracked: k === 0 }));
    q.runLensmother(b, 0.01);
    expect(w.enemies[b].castId).toBe('glintfall');
    const ts = w.telegraphs.filter((t) => t.alive && t.owner === b);
    expect(ts).toHaveLength(3);
    for (const t of ts) {
      expect(t.r).toBe(GLINTFALL.radius);
      expect(w.pillars.some((p) => p.x === t.x && p.y === t.y && !p.cracked)).toBe(true);
    }
  });

  it('online co-op: a guest sees the same version', () => {
    const { w } = lens('glint');
    const g = new World({ seed: 6, dungeon: 'glarewell', tier: 7, omens: [], cls: 'emberwright' });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.bossVariant).toBe('glint');
  });
});

describe('V8 variety: the Coldmarrow', () => {
  type L = { rollLayout(id: string): void; encounter: number };
  it('draws from 6 openers and 3 named fights, and rolls only pillars; Nhevra stays open', () => {
    const d = DUNGEONS.coldmarrow;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(3);
    for (const id of [...d.openers, ...d.named, ...d.hard]) expect(ENCOUNTERS[id]).toBeDefined();
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const w = new World({ seed, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
      const q = w as unknown as L;
      q.encounter = 1;
      q.rollLayout('rimepack');
      seen.add(w.layout);
      q.rollLayout('nhevra');
      expect(w.layout).toBe('open');
    }
    expect([...seen].sort()).toEqual(['open', 'pillars']);
  });
});

describe('V8 variety: Nhevra\'s Emberdrift', () => {
  type N = { spawn(kind: string, x: number, y: number): number; coldClock(dt: number): void; rollNhevraVariant(): string;
    bossIndex: number; bossSpawned: boolean; coldPhase: number; driftT: number; iceT: number; snuffT: number; tideT: number; nightT: number };
  function nhevra(variant: 'ice' | 'drift'): { w: World; q: N; b: number } {
    const w = new World({ seed: 8, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
    const q = w as unknown as N;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('nhevra', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = variant;
    w.enemies[b].hp = w.enemies[b].maxHp * 0.4;
    q.coldPhase = 2; q.driftT = 0; q.iceT = 0; q.snuffT = 99; q.tideT = 99; q.nightT = 99;
    w.player.x = 500; w.player.y = 500; w.player.coal = 0.5;
    return { w, q, b };
  }

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' }) as unknown as N;
      const c = new World({ seed, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' }) as unknown as N;
      expect(a.rollNhevraVariant()).toBe(c.rollNhevraVariant());
      seen.add(a.rollNhevraVariant());
    }
    expect([...seen].sort()).toEqual([...NHEVRA_VARIANTS].sort());
  });

  it('the ice version cracks the river; the drift version drops embers instead, drains coal faster, and an ember refills it', () => {
    const ice = nhevra('ice');
    ice.q.coldClock(0.01);
    expect(ice.w.cracks.some((c) => c.alive)).toBe(true);
    expect(ice.w.driftEmbers).toHaveLength(0);
    const { w, q } = nhevra('drift');
    q.coldClock(0.01);
    expect(w.cracks.some((c) => c.alive)).toBe(false);
    expect(w.driftEmbers).toHaveLength(EMBERDRIFT.n);
    expect(w.events.some((e) => e.type === 'emberDrift')).toBe(true);
    const before = w.player.coal!;
    q.coldClock(1);
    expect(before - w.player.coal!).toBeCloseTo(0.01 * EMBERDRIFT.drainMult, 5);
    const m = w.driftEmbers[0];
    w.player.x = m.x; w.player.y = m.y;
    const c0 = w.player.coal!;
    q.coldClock(0.01);
    expect(w.player.coal!).toBeGreaterThan(c0 + EMBERDRIFT.refill - 0.01);
    expect(w.driftEmbers).toHaveLength(EMBERDRIFT.n - 1);
    expect(w.events.some((e) => e.type === 'emberPick')).toBe(true);
  });

  it('online co-op: a guest sees the same version and embers', () => {
    const { w, q } = nhevra('drift');
    q.coldClock(0.01);
    const g = new World({ seed: 8, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.bossVariant).toBe('drift');
    expect(g.driftEmbers).toEqual(w.driftEmbers);
  });
});

describe('Phase 12 W1: Hessa\'s Outsurge', () => {
  type H = { spawn(kind: string, x: number, y: number): number; wrackClock(dt: number): void; rollHessaVariant(): string;
    bossIndex: number; bossSpawned: boolean; wrackPhase: number; ebbT: number; rafts: unknown[] };
  function hessa(variant: 'riptide' | 'outsurge', phase = 2): { w: World; q: H } {
    const w = new World({ seed: 5, dungeon: 'wrackline', tier: 10, omens: [], cls: 'emberwright' });
    const q = w as unknown as H;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('hessa', 0, 0);
    q.bossIndex = b; q.bossSpawned = true; q.wrackPhase = phase;
    w.bossVariant = variant;
    w.enemies[b].abilityT = 99;
    q.rafts = [];
    q.ebbT = 1;
    w.player.x = 300; w.player.y = 0;
    return { w, q };
  }

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'wrackline', tier: 10, omens: [], cls: 'emberwright' }) as unknown as H;
      const b = new World({ seed, dungeon: 'wrackline', tier: 10, omens: [], cls: 'emberwright' }) as unknown as H;
      expect(a.rollHessaVariant()).toBe(b.rollHessaVariant());
      seen.add(a.rollHessaVariant());
    }
    expect([...seen].sort()).toEqual([...HESSA_VARIANTS].sort());
  });

  it('in phase 2 the Outsurge pushes out to the rim and burns there; Riptide still pulls in', () => {
    const rip = hessa('riptide');
    rip.q.wrackClock(0.5);
    expect(rip.w.player.x).toBeLessThan(300);
    const out = hessa('outsurge');
    expect(out.w.outsurge).toBe(true);
    out.q.wrackClock(0.5);
    expect(out.w.player.x).toBeGreaterThan(300);
    const rim = hessa('outsurge');
    rim.w.player.x = rim.w.arenaR - 30;
    const hp = rim.w.player.hp;
    rim.q.wrackClock(0.5);
    expect(rim.w.player.x).toBeLessThanOrEqual(rim.w.arenaR);
    // tideBurn plus the rim's burn, against tideBurn alone in open water away from the rim
    const lost = hp - rim.w.player.hp;
    const mid = hessa('outsurge');
    const hp2 = mid.w.player.hp;
    mid.q.wrackClock(0.5);
    expect(lost).toBeGreaterThan((hp2 - mid.w.player.hp) * 1.5);
    expect(OUTSURGE.rimBurn).toBeGreaterThan(0);
  });

  it('phase 1 pulls in for both versions', () => {
    const { w, q } = hessa('outsurge', 1);
    expect(w.outsurge).toBe(false);
    q.wrackClock(0.5);
    expect(w.player.x).toBeLessThan(300);
  });
});

describe('Phase 12 W2: the Hammerdeep and Ondrel\'s Ironload', () => {
  type O = { rollOndrelVariant(): string; ondrelClock(dt: number): void; finishCast(i: number): void; spawn(kind: string, x: number, y: number): number;
    bossIndex: number; bossSpawned: boolean; choirT: number; anvilT: number };
  const party = [{ cls: 'bulwark' as const, name: 'a' }, { cls: 'lumen' as const, name: 'b' }, { cls: 'duskblade' as const, name: 'c' }, { cls: 'emberwright' as const, name: 'd' }];
  function ondrel(): { w: World; q: O; b: number } {
    const w = new World({ seed: 3, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark', party });
    const q = w as unknown as O;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('ondrel', 0, -200);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = 'load';
    q.anvilT = 99;
    return { w, q, b };
  }

  it('draws from 6 openers and 3 named fights, and rolls stones or vents but never lava', () => {
    const d = DUNGEONS.hammerdeep;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(3);
    for (const id of [...d.openers, ...d.named, ...d.hard]) expect(ENCOUNTERS[id]).toBeDefined();
    expect(LAYOUTS.hammerdeep).not.toContain('channel');
  });

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark' }) as unknown as O;
      const b = new World({ seed, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark' }) as unknown as O;
      expect(a.rollOndrelVariant()).toBe(b.rollOndrelVariant());
      seen.add(a.rollOndrelVariant());
    }
    expect([...seen].sort()).toEqual([...ONDREL_VARIANTS].sort());
  });

  it('Ironload marks a hero and lands split among everyone standing with them', () => {
    const { w, q, b } = ondrel();
    const e = w.enemies[b];
    e.castId = 'ironload';
    q.finishCast(b);
    expect(w.loadHero).toBeGreaterThanOrEqual(0);
    expect(w.loadT).toBe(IRONLOAD.time);
    const m = w.loadHero;
    // Two heroes with the mark, two far away.
    const others = [0, 1, 2, 3].filter((k) => k !== m);
    w.heroData(m).player.x = 300; w.heroData(m).player.y = 300;
    w.heroData(others[0]).player.x = 320; w.heroData(others[0]).player.y = 300;
    w.heroData(others[1]).player.x = -400; w.heroData(others[1]).player.y = 0;
    w.heroData(others[2]).player.x = -400; w.heroData(others[2]).player.y = 100;
    const hp = [0, 1, 2, 3].map((k) => w.heroData(k).player.hp);
    q.choirT = 99;
    q.ondrelClock(IRONLOAD.time + 0.01);
    expect(w.loadHero).toBe(-1);
    const lost = [0, 1, 2, 3].map((k) => hp[k] - w.heroData(k).player.hp);
    expect(lost[m]).toBeGreaterThan(0);
    expect(lost[others[0]]).toBeGreaterThan(0);
    expect(lost[others[1]]).toBe(0);
    expect(lost[others[2]]).toBe(0);
  });
});

describe('Phase 12 W2: the Ashvents and Ysmeret\'s Wandering Vents', () => {
  type Y = { rollYsmeretVariant(): string; ysmeretClock(dt: number): void; spawn(kind: string, x: number, y: number): number;
    bossIndex: number; bossSpawned: boolean; twinVentT: number; scatterT: number; bellowT: number };
  function ysmeret(variant: string): { w: World; q: Y; b: number } {
    const w = new World({ seed: 3, dungeon: 'ashvents', tier: 6, omens: [], cls: 'bulwark' });
    const q = w as unknown as Y;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('ysmeret', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = variant as never;
    q.twinVentT = 0; q.scatterT = 99; q.bellowT = 99;
    return { w, q, b };
  }
  const vents = (w: World) => w.telegraphs.filter((t) => t.alive && t.kind === 'soak' && t.owner === -2).map((t) => ({ x: t.x, y: t.y }));

  it('draws from 6 openers and 3 named fights (its layouts came later, in Phase 13 E2)', () => {
    const d = DUNGEONS.ashvents;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(3);
    for (const id of [...d.openers, ...d.named, ...d.hard]) expect(ENCOUNTERS[id]).toBeDefined();
    expect(LAYOUTS.ashvents).toEqual(['open', 'open', 'pillars', 'vents']);
  });

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'ashvents', tier: 6, omens: [], cls: 'bulwark' }) as unknown as Y;
      const b = new World({ seed, dungeon: 'ashvents', tier: 6, omens: [], cls: 'bulwark' }) as unknown as Y;
      expect(a.rollYsmeretVariant()).toBe(b.rollYsmeretVariant());
      seen.add(a.rollYsmeretVariant());
    }
    expect([...seen].sort()).toEqual([...YSMERET_VARIANTS].sort());
  });

  it('still vents stay put; wandering vents circle her at the set speed', () => {
    for (const v of ['still', 'wander']) {
      const { w, q, b } = ysmeret(v);
      q.ysmeretClock(1 / 30);
      const start = vents(w);
      expect(start).toHaveLength(2);
      const named = w.events.find((ev) => ev.type === 'castStart' && ev.id === 'twinVents') as { name: string } | undefined;
      expect(named?.name).toBe(v === 'wander' ? 'Wandering Vents' : 'Twin Vents');
      for (let k = 0; k < 30; k++) q.ysmeretClock(1 / 30);
      const now = vents(w);
      const e = w.enemies[b];
      for (let k = 0; k < 2; k++) {
        const moved = Math.hypot(now[k].x - start[k].x, now[k].y - start[k].y);
        if (v === 'still') expect(moved).toBe(0);
        else {
          expect(moved).toBeGreaterThan(WANDER.speed * 0.8);
          expect(moved).toBeLessThan(WANDER.speed * 1.05);
          // Still ventDist from her.
          expect(Math.hypot(now[k].x - e.x, now[k].y - e.y)).toBeCloseTo(YSMERET.ventDist, 3);
        }
      }
    }
  });

  it('a wandering vent pulled in at the rim swings back out to its distance', () => {
    const { w, q, b } = ysmeret('wander');
    const e = w.enemies[b];
    q.ysmeretClock(1 / 30);
    const t = w.telegraphs.find((x) => x.alive && x.kind === 'soak' && x.owner === -2)!;
    // As if the rim had pulled it in close to her.
    t.x = e.x + 40; t.y = e.y;
    q.ysmeretClock(1 / 30);
    expect(Math.hypot(t.x - e.x, t.y - e.y)).toBeCloseTo(YSMERET.ventDist, 3);
  });
});

describe('Phase 12 W3: Grandmother Slag\'s Brimming', () => {
  type G = { rollSlagVariant(): string; slagClock(dt: number): void; spawn(kind: string, x: number, y: number): number;
    bossIndex: number; bossSpawned: boolean; heatT: number; pourT: number; ladleT: number; use(k: number): void };
  const party = [{ cls: 'lumen' as const, name: 'b' }, { cls: 'duskblade' as const, name: 'c' }, { cls: 'emberwright' as const, name: 'd' }];
  function slag(variant: string): { w: World; q: G; b: number } {
    const w = new World({ seed: 3, dungeon: 'crucible', tier: 8, omens: [], cls: 'bulwark', party });
    const q = w as unknown as G;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('grandmotherSlag', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = variant as never;
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ladleT = 99;
    return { w, q, b };
  }

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'crucible', tier: 8, omens: [], cls: 'bulwark' }) as unknown as G;
      const b = new World({ seed, dungeon: 'crucible', tier: 8, omens: [], cls: 'bulwark' }) as unknown as G;
      expect(a.rollSlagVariant()).toBe(b.rollSlagVariant());
      seen.add(a.rollSlagVariant());
    }
    expect([...seen].sort()).toEqual([...SLAG_VARIANTS].sort());
  });

  it('the Pour version raises no islands; the Brimming raises them, and casts no lanes', () => {
    const pour = slag('pour');
    pour.q.slagClock(1 / 30);
    expect(pour.w.islands).toHaveLength(0);
    const { w, q } = slag('brim');
    q.slagClock(1 / 30);
    expect(w.islands).toHaveLength(BRIM.count);
    expect(w.events.some((ev) => ev.type === 'castStart' && ev.id === 'brimming')).toBe(true);
    q.pourT = 0;
    for (let k = 0; k < 10; k++) q.slagClock(1 / 30);
    expect(w.telegraphs.filter((t) => t.alive && t.shape === 'cone')).toHaveLength(0);
    // On the Pour's timer she Churns instead: a cast with no lanes (the tank's breather, as in the Pour).
    expect(w.enemies[w.bossIndex].castId).toBe('churn');
  });

  it('islands sink in turn and new ones rise elsewhere', () => {
    const { w, q } = slag('brim');
    q.slagClock(1 / 30);
    const first = w.islands.map((s) => ({ x: s.x, y: s.y }));
    for (let k = 0; k < 30 * (BRIM.life / BRIM.count + 0.5); k++) q.slagClock(1 / 30);
    expect(w.islands).toHaveLength(BRIM.count);
    const moved = w.islands.filter((s, k) => s.x !== first[k].x || s.y !== first[k].y);
    expect(moved).toHaveLength(1);
  });

  it('the rising slag burns a hero off an island harder, and one on an island not at all', () => {
    const { w, q } = slag('brim');
    q.slagClock(1 / 30);
    const isl = w.islands[w.islands.length - 1];
    w.heroData(0).player.x = isl.x; w.heroData(0).player.y = isl.y;
    w.heroData(1).player.x = -500; w.heroData(1).player.y = 500;
    w.heroData(1).player.y = w.islands.some((s) => Math.hypot(s.x + 500, s.y - 500) < BRIM.radius + 20) ? -500 : 500;
    const hp0 = w.heroData(0).player.hp, hp1 = w.heroData(1).player.hp;
    q.heatT = 0;
    q.slagClock(1 / 30);
    expect(w.heroData(0).player.hp).toBe(hp0);
    expect(hp1 - w.heroData(1).player.hp).toBeGreaterThan(w.heroData(1).player.maxHp * SLAG.heat);
  });

  it('Cinder Marks keep their own 10% self-burn, apart from Ysmeret\'s Scatter Embers', () => {
    const { w, q, b } = slag('pour');
    const f = q as unknown as { finishCast(i: number): void };
    const spots = [[-400, -400], [400, -400], [-400, 400], [400, 400]];
    spots.forEach(([x, y], k) => { w.heroData(k).player.x = x; w.heroData(k).player.y = y; });
    const hp = [0, 1, 2, 3].map((k) => w.heroData(k).player.hp);
    w.enemies[b].castId = 'scatter';
    f.finishCast(b);
    const lost = hp[2] - w.heroData(2).player.hp;
    expect(lost).toBeGreaterThan(0);
    expect(lost / w.heroData(2).player.maxHp).toBeLessThan(YSMERET.scatterSelf);
    expect(SLAG.marksSelf).toBe(0.1);
  });
});

describe('Phase 12 W3 follow-up: wider raid fight pools', () => {
  const raids = (Object.keys(DUNGEONS) as (keyof typeof DUNGEONS)[]).filter((id) => DUNGEONS[id].raid);
  it('every raid has at least 24 routes, and every fight in it is a real encounter', () => {
    expect(raids.sort()).toEqual(['crucible', 'flue', 'hoard', 'smeltery']);
    for (const id of raids) {
      const d = DUNGEONS[id];
      expect(d.openers.length * (d.openers.length - 1) * d.named.length).toBeGreaterThanOrEqual(24);
      for (const f of [...d.openers, ...d.named]) expect(ENCOUNTERS[f]).toBeDefined();
    }
  });

  it('a raid route is two different openers, a named fight and the boss', () => {
    for (const id of raids) {
      let s = 7;
      const pick = (m: number): number => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) % m; };
      const many = new Set<string>();
      for (let k = 0; k < 2000; k++) {
        const r = rollRoute(pick, id);
        expect(r[0]).not.toBe(r[1]);
        expect(r[3]).toBe(DUNGEONS[id].boss);
        many.add(r.join(','));
      }
      const d = DUNGEONS[id];
      expect(many.size).toBe(d.openers.length * (d.openers.length - 1) * d.named.length);
    }
  });
});

describe('Phase 13 E1 and E2: raid and Ashvents trash layouts', () => {
  it('every raid (and the Ashvents) rolls stones or vents for its trash, never lava, and never for the boss fight', () => {
    for (const id of ['crucible', 'hoard', 'smeltery', 'flue', 'ashvents'] as const) {
      expect(LAYOUTS[id]).toBeDefined();
      expect(LAYOUTS[id]).not.toContain('channel');
      const seen = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) {
        const w = new World({ seed, dungeon: id, omens: [], cls: 'bulwark' });
        w.route.forEach((f, k) => {
          const l = w.layoutAt(k, f);
          if (f === DUNGEONS[id].boss) expect(l).toBe('open');
          else seen.add(l);
        });
      }
      expect([...seen].sort()).toEqual(['open', 'pillars', 'vents']);
    }
  });
});

describe('Phase 14 X3: arena events', () => {
  type Q = { rollLayout(id: string): void; rollArenaEvent(id: string): void; arenaEventClock(dt: number): void; encounter: number; tideClockT: number; ebbT: number; ebbWarnT: number };
  const make = (dungeon: 'kiln' | 'foundry' | 'glarewell' | 'coldmarrow' | 'wrackline' | 'hammerdeep', seed = 1) =>
    new World({ seed, dungeon, tier: { kiln: 2, foundry: 4, glarewell: 7, coldmarrow: 10, wrackline: 13, hammerdeep: 4 }[dungeon], omens: [], cls: 'emberwright' });

  it('about 40% of solo trash fights get one from the dungeon\'s own pool, never the boss, never a group dungeon', () => {
    for (const dg of Object.keys(ARENA_EVENT_POOLS) as (keyof typeof ARENA_EVENT_POOLS)[]) {
      let hits = 0, n = 0;
      const seen = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) {
        const w = make(dg as 'kiln', seed);
        for (let k = 0; k < w.route.length; k++) {
          const ev = w.arenaEventAt(k, w.route[k]);
          if (w.route[k] === w.dungeonDef.boss) { expect(ev).toBe(''); continue; }
          n++;
          if (ev) { hits++; seen.add(ev); expect(ARENA_EVENT_POOLS[dg]).toContain(ev); }
          expect(w.arenaEventAt(k, w.route[k])).toBe(ev);
        }
      }
      expect(hits / n, dg).toBeGreaterThan(ARENA_EVENTS.chance - 0.08);
      expect(hits / n, dg).toBeLessThan(ARENA_EVENTS.chance + 0.08);
      expect([...seen].sort(), dg).toEqual([...ARENA_EVENT_POOLS[dg]!].sort());
    }
    const g = make('hammerdeep');
    for (let k = 0; k < g.route.length; k++) expect(g.arenaEventAt(k, g.route[k])).toBe('');
    expect(new World({ seed: 1, omens: [], firstDelve: true }).arenaEventAt(0, 'pack')).toBe('');
  });

  it('a Cave-in warns over its spots, then leaves stones there', () => {
    const w = make('kiln');
    const q = w as unknown as Q;
    ARENA_EVENTS.force = 'caveIn';
    try { q.encounter = 1; q.rollLayout('pack'); q.rollArenaEvent('pack'); } finally { ARENA_EVENTS.force = ''; }
    expect(w.arenaEvent).toBe('caveIn');
    const stones = w.stones.length;
    w.events.length = 0;
    q.arenaEventClock(w.arenaEventT + 0.01);
    expect(w.events).toContainEqual({ type: 'arenaEvent', id: 'caveIn', stage: 'warn' });
    const spots = w.caveInSpots();
    for (const c of spots) expect(w.telegraphs.some((t) => t.alive && t.x === c.x && t.y === c.y)).toBe(true);
    q.arenaEventClock(ARENA_EVENTS.caveWarn + 0.01);
    expect(w.events).toContainEqual({ type: 'arenaEvent', id: 'caveIn', stage: 'land' });
    expect(w.stones.length).toBe(stones + ARENA_EVENTS.caveCount);
    q.arenaEventClock(100);
    expect(w.stones.length).toBe(stones + ARENA_EVENTS.caveCount);
  });

  it('a Vent Surge erupts every vent at once; a Cold Snap dims the coal; High Water brings the Ebb now', () => {
    const k = make('kiln');
    const qk = k as unknown as Q;
    ARENA_EVENTS.force = 'ventSurge';
    try { qk.encounter = 1; qk.rollLayout('pack'); qk.rollArenaEvent('pack'); } finally { ARENA_EVENTS.force = ''; }
    const before = k.telegraphs.filter((t) => t.alive).length;
    qk.arenaEventClock(k.arenaEventT + 0.01);
    expect(k.telegraphs.filter((t) => t.alive).length).toBe(before + k.surgeSpots().length);

    const c = make('coldmarrow');
    const qc = c as unknown as Q;
    ARENA_EVENTS.force = 'coldSnap';
    try { qc.encounter = 1; qc.rollLayout('rimepack'); qc.rollArenaEvent('rimepack'); } finally { ARENA_EVENTS.force = ''; }
    c.player.coal = 0.8;
    qc.arenaEventClock(c.arenaEventT + 0.01);
    qc.arenaEventClock(ARENA_EVENTS.snapWarn + 0.01);
    expect(c.player.coal).toBeCloseTo(0.8 - ARENA_EVENTS.snapCut, 9);

    const r = make('wrackline');
    const qr = r as unknown as Q;
    ARENA_EVENTS.force = 'highWater';
    try { qr.encounter = 1; qr.rollLayout('lurkers'); qr.rollArenaEvent('lurkers'); } finally { ARENA_EVENTS.force = ''; }
    qr.ebbT = 0; qr.ebbWarnT = 0; qr.tideClockT = 10;
    qr.arenaEventClock(r.arenaEventT + 0.01);
    expect(qr.tideClockT).toBe(0);
  });

  it('a forced event that the dungeon has no use for never comes', () => {
    ARENA_EVENTS.force = 'coldSnap';
    try { expect(make('kiln').arenaEventAt(1, 'pack')).toBe(''); } finally { ARENA_EVENTS.force = ''; }
  });
});
