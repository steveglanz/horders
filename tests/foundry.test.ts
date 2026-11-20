import { describe, expect, it } from 'vitest';
import { World, FOUNDRY, ARENA } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { DUNGEONS, rollRoute } from '../sim/content/dungeon';
import { Rng } from '../sim/rng';

function play(w: World, until: (w: World) => boolean, max = 600) {
  while (w.state !== 'ended' && w.time < max && !until(w)) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
}

describe('the Drowned Foundry', () => {
  it('routes use only Foundry encounters and end with Maelra', () => {
    const f = DUNGEONS.foundry;
    const pool = new Set([...f.openers, ...f.named, ...f.hard, f.boss]);
    for (let seed = 1; seed < 30; seed++) {
      const r = new Rng(seed);
      const route = rollRoute((n) => r.int(n), 'foundry');
      expect(route.at(-1)).toBe('maelra');
      for (const id of route) expect(pool.has(id)).toBe(true);
    }
  });

  it('the Kiln Depths route roll is unchanged by default', () => {
    const a = new Rng(5); const b = new Rng(5);
    expect(rollRoute((n) => a.int(n))).toEqual(rollRoute((n) => b.int(n), 'kiln'));
  });

  it('a landed Mirror Ward reflects damage at the player', () => {
    const w = new World({ seed: 2, route: ['glass', 'glass', 'glass', 'glass', 'maelra'], omens: [] });
    // Never interrupt: only move, so Mirror Ward lands.
    let reflected = false;
    while (w.state !== 'ended' && w.time < 60 && !reflected) {
      if (w.state === 'draft') { w.choose(0); continue; }
      const warden = w.enemies.find((e) => e.alive && e.kind === 'glassWarden');
      const hp = w.player.hp;
      w.step({ x: 0, y: 0 });
      if (warden && warden.aux2 > 0 && w.player.hp < hp && w.events.some((e) => e.type === 'playerHurt')) reflected = true;
    }
    expect(reflected).toBe(true);
  });

  it('a fallen twin is rekindled unless stopped', () => {
    const w = new World({ seed: 3, route: ['twins', 'twins', 'twins', 'twins', 'maelra'], omens: [], invulnerable: true });
    let rekindled = false;
    play(w, (x) => {
      rekindled ||= x.events.some((e) => e.type === 'castStart' && e.name === 'Rekindle');
      return rekindled || x.encounter >= 1;
    }, 120);
    expect(rekindled).toBe(true);
  });

  it('Maelra builds Temper, the bot boils it off at vents, and the water rises', () => {
    const w = new World({ seed: 4, route: ['twins', 'glass', 'crawlers', 'tidepair', 'maelra'], omens: [], invulnerable: true });
    let maxTemper = 0;
    let boiled = false;
    play(w, (x) => {
      maxTemper = Math.max(maxTemper, x.temper);
      if (x.events.some((e) => e.type === 'explode' && e.r === FOUNDRY.ventRadius + 20)) boiled = true;
      return false;
    }, 900);
    expect(w.victory).toBe(true);
    expect(w.vents.length).toBe(3);
    expect(maxTemper).toBeGreaterThan(0);
    expect(maxTemper).toBeLessThanOrEqual(FOUNDRY.temperMax);
    expect(w.arenaR).toBeLessThan(ARENA);
    expect(w.arenaR).toBeGreaterThanOrEqual(FOUNDRY.waterMin);
    expect(boiled).toBe(true);
  });

  it('Foundry runs are deterministic', () => {
    const run = () => { const w = new World({ seed: 8, dungeon: 'foundry', omens: [] }); play(w, () => false, 200); return [w.time, w.kills, Math.round(w.player.hp), w.temper]; };
    expect(run()).toEqual(run());
  });
});
