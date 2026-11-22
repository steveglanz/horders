import { describe, expect, it } from 'vitest';
import { World, SITE_CARDS, LAYOUT } from '../sim/world';
import { TALENTS } from '../sim/content/emberwright';

const priv = (w: World) => w as unknown as {
  layoutClock(dt: number): void; flareVents: { x: number; y: number }[]; flareT: number; lava: { x1: number; y1: number; x2: number; y2: number; w: number }[];
  talents: Record<string, number>; phase: string;
};

describe('site cards (Phase 11 variety talents)', () => {
  it('every site card names a situation and is a plain rank-2 card', () => {
    for (const id of ['ventFed', 'readTheLane', 'backToStone', 'reachingLight', 'slagWade'] as const) {
      expect(TALENTS[id].where).toBeDefined();
      expect(TALENTS[id].maxRank).toBe(2);
      expect(TALENTS[id].capstone).toBeFalsy();
    }
  });

  it('layoutAt gives the layout each fight actually rolls', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const w = new World({ seed, dungeon: 'kiln', omens: [], cls: 'bulwark' });
      const expected = w.route.map((id, k) => w.layoutAt(k, id));
      const seen: string[] = [];
      while (w.state !== 'ended' && w.time < 400 && seen.length < 3) {
        if (w.state === 'draft') { w.choose(0); continue; }
        const before = w.encounter;
        w.step({ x: 0, y: 0 });
        if (w.events.some((e) => e.type === 'layout') && seen.length === before) seen.push(w.layout);
      }
      seen.forEach((l, k) => expect(l).toBe(expected[k]));
    }
  });

  it('a card is offered only while its situation is still ahead in the route', () => {
    // Vent Floor forces vents on every Kiln fight before the boss.
    const vents = new World({ seed: 2, dungeon: 'kiln', tier: 1, heat: 'ventFloor', omens: [], cls: 'emberwright' });
    expect(vents.situationAhead('vents')).toBe(true);
    expect(vents.situationAhead('lava')).toBe(false);
    // The Coldmarrow has no vents, lava or Spitters; its ice pillars can be ahead.
    const cold = new World({ seed: 2, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
    expect(cold.situationAhead('vents')).toBe(false);
    expect(cold.situationAhead('lava')).toBe(false);
    expect(cold.situationAhead('spitter')).toBe(false);
    // Only the boss left: her arena is always open, so no layout card.
    const late = new World({ seed: 2, dungeon: 'kiln', tier: 1, heat: 'ventFloor', omens: [], cls: 'emberwright' });
    late.encounter = late.route.length - 1;
    expect(late.situationAhead('vents')).toBe(false);
    // The Glarewell has its shade pillars in every fight, the boss's too.
    const glare = new World({ seed: 2, dungeon: 'glarewell', tier: 7, omens: [], cls: 'bulwark' });
    glare.encounter = glare.route.length - 1;
    expect(glare.situationAhead('pillars')).toBe(true);
    // Switched off for measuring: never offered.
    SITE_CARDS.off = 1;
    try { expect(vents.situationAhead('vents')).toBe(false); } finally { SITE_CARDS.off = 0; }
  });

  it('Vent-Fed: a flare close by, outside its circle, gives Heat and a double volley', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', omens: [], cls: 'emberwright' });
    const q = priv(w);
    q.talents.ventFed = 2;
    q.flareVents = [{ x: LAYOUT.ventRadius + 60, y: 0 }];
    q.flareT = 0.001;
    w.player.x = 0;
    w.player.y = 0;
    w.player.heat = 0;
    q.layoutClock(0.01);
    expect(w.player.heat).toBeCloseTo(SITE_CARDS.ventHeat * 2, 5);
    expect(w.player.ventVolley).toBe(true);
  });

  it('Back to Stone: less damage beside a stone, a smaller cut in the Glarewell', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', omens: [], cls: 'bulwark' });
    const base = w.damageTakenMult;
    priv(w).talents.backToStone = 2;
    w.stones = [{ x: 60, y: 0, r: 34 }];
    w.player.x = 0;
    w.player.y = 0;
    expect(w.damageTakenMult / base).toBeCloseTo(1 - SITE_CARDS.stoneDr * 2, 5);
    w.player.x = -400;
    expect(w.damageTakenMult).toBeCloseTo(base, 5);
    const g = new World({ seed: 3, dungeon: 'glarewell', tier: 7, omens: [], cls: 'bulwark' });
    const gb = g.damageTakenMult;
    priv(g).talents.backToStone = 1;
    g.pillars = [{ x: 200, y: 0, r: 30, cracked: false }];
    g.player.x = g.pillars[0].x + g.pillars[0].r + 10;
    g.player.y = g.pillars[0].y;
    expect(g.damageTakenMult / gb).toBeCloseTo(1 - SITE_CARDS.glareStoneDr, 5);
  });

  it('Slag Wade: lava burns a Slagbinder less', () => {
    const burn = (rank: number) => {
      const w = new World({ seed: 3, dungeon: 'kiln', omens: [], cls: 'slagbinder' });
      priv(w).talents.slagWade = rank;
      priv(w).lava = [{ x1: -300, y1: 0, x2: 300, y2: 0, w: 70 }];
      w.player.x = 0;
      w.player.y = 0;
      const hp = w.player.hp;
      priv(w).layoutClock(0.5);
      return hp - w.player.hp;
    };
    expect(burn(1) / burn(0)).toBeCloseTo(1 - SITE_CARDS.wadeBurn, 2);
  });
});

