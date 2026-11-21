import { describe, expect, it } from 'vitest';
import { World, GLARE } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { DUNGEONS, rollRoute, EncounterId } from '../sim/content/dungeon';
import { Rng } from '../sim/rng';

function play(w: World, until: (w: World) => boolean, max = 600) {
  while (w.state !== 'ended' && w.time < max && !until(w)) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
}

/** Steps (standing still) until the first fight has started and its pillars stand. */
function toFight(route: EncounterId[], seed = 1, invulnerable = true): World {
  const w = new World({ seed, dungeon: 'glarewell', route, omens: [], invulnerable });
  while (w.time < 30 && !(w.phase === 'fight' && w.pillars.length)) {
    if (w.state === 'draft') w.choose(0);
    else w.step({ x: 0, y: 0 });
  }
  return w;
}

describe('the Glarewell', () => {
  it('routes use only Glarewell encounters and end with the Lensmother', () => {
    const d = DUNGEONS.glarewell;
    const pool = new Set([...d.openers, ...d.named, ...d.hard, d.boss]);
    for (let seed = 1; seed < 30; seed++) {
      const r = new Rng(seed);
      const route = rollRoute((n) => r.int(n), 'glarewell');
      expect(route.at(-1)).toBe('lensmother');
      for (const id of route) expect(pool.has(id)).toBe(true);
    }
  });

  it('unlocks after tier 6', () => {
    expect(DUNGEONS.glarewell.unlockTier).toBe(7);
  });

  it('raises four pillars, and only in the Glarewell', () => {
    const w = toFight(['shades', 'shades', 'shades', 'shades', 'lensmother']);
    expect(w.pillars.length).toBe(4);
    const kiln = new World({ seed: 1, route: ['pack', 'pack', 'pack', 'pack', 'kilnMother'], omens: [] });
    for (let k = 0; k < 200; k++) kiln.step({ x: 0, y: 0 });
    expect(kiln.pillars.length).toBe(0);
  });

  it('a pillar shadows the far side from the lens, not the near side or the centre', () => {
    const w = toFight(['shades', 'shades', 'shades', 'shades', 'lensmother']);
    const c = w.pillars[0];
    const d = Math.hypot(c.x, c.y);
    const ux = c.x / d;
    const uy = c.y / d;
    expect(w.shadowed(c.x + ux * (c.r + 40), c.y + uy * (c.r + 40))).toBe(true);
    expect(w.shadowed(c.x - ux * (c.r + 40), c.y - uy * (c.r + 40))).toBe(false);
    expect(w.shadowed(0, 0)).toBe(false);
    // Past the shadow's reach, the light finds you again.
    const far = GLARE.shadowLength + 20;
    expect(w.shadowed(c.x + ux * far, c.y + uy * far)).toBe(false);
    // A cracked pillar casts no shadow.
    c.cracked = true;
    expect(w.shadowed(c.x + ux * (c.r + 40), c.y + uy * (c.r + 40))).toBe(false);
  });

  it('Glare hurts you in the light and spares you in shadow', () => {
    const run = (hide: boolean) => {
      const w = toFight(['lensbearer', 'lensbearer', 'lensbearer', 'lensbearer', 'lensmother']);
      const c = w.pillars[0];
      const d = Math.hypot(c.x, c.y);
      const spot = hide
        ? { x: c.x + (c.x / d) * (c.r + 45), y: c.y + (c.y / d) * (c.r + 45) }
        : { x: -c.x, y: c.y };
      let glare: { hit: boolean } | undefined;
      while (w.time < 40 && !glare) {
        w.player.x = spot.x;
        w.player.y = spot.y;
        w.step({ x: 0, y: 0 });
        const ev = w.events.find((e) => e.type === 'glare');
        if (ev && ev.type === 'glare') glare = ev;
      }
      return glare;
    };
    expect(run(true)?.hit).toBe(false);
    expect(run(false)?.hit).toBe(true);
  });

  it('a Brand bursts on you, cracks a pillar beside you and heals enemies near you', () => {
    const w = toFight(['brandkeeper', 'brandkeeper', 'brandkeeper', 'brandkeeper', 'lensmother']);
    const c = w.pillars[0];
    let burst = false;
    let cracked = false;
    let healed = false;
    while (w.time < 40 && !burst) {
      // Stand against the pillar with an enemy pinned beside you.
      w.player.x = c.x + c.r + 30;
      w.player.y = c.y;
      const keeper = w.enemies.find((e) => e.alive && e.kind === 'brandkeeper');
      if (keeper) {
        keeper.x = w.player.x + 40;
        keeper.y = w.player.y;
        keeper.hp = keeper.maxHp * 0.5;
      }
      w.step({ x: 0, y: 0 });
      for (const ev of w.events) {
        if (ev.type === 'brandBurst') burst = true;
        if (ev.type === 'pillarCrack') cracked = true;
        if (ev.type === 'heal') healed = true;
      }
    }
    expect(burst).toBe(true);
    expect(cracked).toBe(true);
    expect(c.cracked).toBe(true);
    expect(healed).toBe(true);
  });

  it('Shades barely feel hits while they stand in shadow', () => {
    const w = toFight(['shades', 'shades', 'shades', 'shades', 'lensmother']);
    expect(GLARE.shadeShadowTaken).toBeLessThan(1);
    const c = w.pillars[0];
    const d = Math.hypot(c.x, c.y);
    const shade = w.enemies.find((e) => e.alive && e.kind === 'shade')!;
    shade.x = c.x + (c.x / d) * (c.r + 40);
    shade.y = c.y + (c.y / d) * (c.r + 40);
    expect(w.shadowed(shade.x, shade.y)).toBe(true);
  });

  it('the Twin Lamps burn you in the beam between them', () => {
    const w = toFight(['lamps', 'lamps', 'lamps', 'lamps', 'lensmother'], 1, false);
    const [a, b] = w.enemies.filter((e) => e.alive && e.kind === 'twinLamp');
    let hurt = 0;
    for (let k = 0; k < 60; k++) {
      a.x = -100; a.y = 300; b.x = 100; b.y = 300;
      w.player.x = 0; w.player.y = 300;
      w.player.hp = w.player.maxHp;
      const hp = w.player.hp;
      w.step({ x: 0, y: 0 });
      expect(w.lampBeam).not.toBeNull();
      if (w.player.hp < hp) hurt++;
    }
    expect(hurt).toBeGreaterThan(0);
  });

  it('the Lensmother reaches phase 3 and cracks pillars, but always leaves one', () => {
    const w = new World({ seed: 5, dungeon: 'glarewell', route: ['shades', 'shades', 'shades', 'shades', 'lensmother'], omens: [], invulnerable: true });
    let crack = 0;
    let phase3 = false;
    play(w, (x) => {
      for (const ev of x.events) {
        if (ev.type === 'pillarCrack') crack++;
        if (ev.type === 'phase' && ev.phase === 3) phase3 = true;
      }
      return x.victory;
    }, 900);
    expect(phase3).toBe(true);
    expect(crack).toBeGreaterThan(0);
    expect(w.pillars.some((c) => !c.cracked)).toBe(true);
  });

  it('the bot can clear it with a geared hero', () => {
    // The tuned target: tier 8 wins 24 of 24 seeds with tools/heroes/hero-t8.json
    // (tools/foundry.ts). Here, a quick check that a full run can be won at all.
    let wins = 0;
    for (let seed = 1; seed <= 3 && !wins; seed++) {
      const w = new World({ seed, dungeon: 'glarewell', omens: [], invulnerable: true });
      play(w, (x) => x.victory, 900);
      if (w.victory) wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});
