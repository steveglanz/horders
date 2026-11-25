import { describe, expect, it } from 'vitest';
import { World, FOUNDRY, GRIT_CUT } from '../sim/world';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  addTelegraph(shape: 'circle', x: number, y: number, r: number, angle: number, arc: number, dur: number, dmg: number, kind: 'bloom', owner: number): void;
};

/** A wounded Sluice Crawler next to a Bulwark, with a bloom about to burst on the Bulwark. */
function bloomOnBulwark(resolve: number): { w: World; healed: number; resolveLeft: number } {
  const w = new World({ seed: 3, cls: 'bulwark', dungeon: 'foundry', omens: [] });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  const p = w.player;
  const i = inner.spawn('sluiceCrawler', p.x + 30, p.y);
  const c = w.enemies[i];
  c.hp = c.maxHp * 0.5;
  c.stunT = 5;
  p.heat = resolve;
  inner.addTelegraph('circle', p.x, p.y, FOUNDRY.bloomRadius, 0, 0, 0.1, FOUNDRY.bloomDamage, 'bloom', -1);
  let healed = 0;
  for (let k = 0; k < 6; k++) {
    w.step({ x: 0, y: 0 });
    for (const ev of w.events) if (ev.type === 'heal' && ev.amount > 50) healed += ev.amount;
  }
  return { w, healed, resolveLeft: p.heat };
}

describe('Bulwark in the Drowned Foundry', () => {
  it('a bloom that bursts on a Bulwark with Resolve heals no one (Smother)', () => {
    const { healed } = bloomOnBulwark(50);
    expect(healed).toBe(0);
  });

  it('without the Resolve to smother it, the bloom feeds the crawler', () => {
    const { healed } = bloomOnBulwark(0);
    expect(healed).toBeGreaterThan(0);
  });
});

describe('Duskblade Open Wounds', () => {
  it('a crawler the Duskblade has cut gets half the bloom heal', () => {
    const heal = (wound: number) => {
      const w = new World({ seed: 3, cls: 'duskblade', dungeon: 'foundry', omens: [] });
      for (const e of w.enemies) e.alive = false;
      const inner = w as unknown as Inner;
      const p = w.player;
      // Far from the hero, so its swings don't land.
      const i = inner.spawn('sluiceCrawler', p.x + 400, p.y);
      const c = w.enemies[i];
      c.hp = c.maxHp * 0.5;
      c.stunT = 5;
      c.woundT = wound;
      inner.addTelegraph('circle', c.x, c.y, FOUNDRY.bloomRadius, 0, 0, 0.05, FOUNDRY.bloomDamage, 'bloom', -1);
      let healed = 0;
      for (let k = 0; k < 3; k++) {
        w.step({ x: 0, y: 0 });
        for (const ev of w.events) if (ev.type === 'heal' && ev.amount > 50) healed += ev.amount;
      }
      return healed / c.maxHp;
    };
    expect(heal(0)).toBeCloseTo(FOUNDRY.bloomHeal, 5);
    expect(heal(3)).toBeCloseTo(FOUNDRY.bloomHeal / 2, 5);
  });

  it('on a Halls run a Bloom heals hallsBloomHeal instead (a sealed room keeps the Crawler on its own Blooms)', () => {
    expect(FOUNDRY.hallsBloomHeal).toBeLessThan(FOUNDRY.bloomHeal);
    const arena = new World({ seed: 3, dungeon: 'foundry', tier: 4 });
    const map = new World({ seed: 3, dungeon: 'foundry', tier: 4, halls: true, hallsBeta: true });
    expect(map.halls).not.toBeNull();
    expect(arena.bloomHeal).toBe(FOUNDRY.bloomHeal);
    expect(map.bloomHeal).toBe(FOUNDRY.hallsBloomHeal);
  });
});

describe('Novice aid for melee heroes', () => {
  type Hurt = { hurtPlayer(a: number, s?: number): void };
  const hitFromTarget = (tier: number) => {
    const w = new World({ seed: 2, cls: 'duskblade', tier });
    w.player.guardId = 0;
    w.enemies[0].alive = true;
    const hp0 = w.player.hp;
    (w as unknown as Hurt).hurtPlayer.call(w, 20, 0);
    return hp0 - w.player.hp;
  };

  it('fades from full at tier 1 to nothing by tier 4', () => {
    expect(new World({ seed: 1, tier: 1 }).noviceAid).toBe(1);
    expect(new World({ seed: 1, tier: 4 }).noviceAid).toBe(0);
    expect(new World({ seed: 1, tier: 8 }).noviceAid).toBe(0);
  });

  it('Blade Guard halves hits from the Duskblade\'s target at tier 1, fades with the aid through tiers 2 and 3, and none from tier 4', () => {
    expect(hitFromTarget(1)).toBeCloseTo(10, 5);
    expect(hitFromTarget(2)).toBeCloseTo(20 * (1 - 0.5 * 2 / 3), 5);
    expect(hitFromTarget(3)).toBeCloseTo(20 * (1 - 0.5 / 3), 5);
    expect(hitFromTarget(4)).toBeCloseTo(20, 5);
    expect(hitFromTarget(8)).toBeCloseTo(20, 5);
  });

  it('Grit Guard: from tier 4 each Grit stack blocks 20% of hits from the Duskblade\'s target, up to 3 stacks', () => {
    const hit = (tier: number, grit: number) => {
      const w = new World({ seed: 2, cls: 'duskblade', tier, grit });
      w.player.guardId = 0;
      w.enemies[0].alive = true;
      const hp0 = w.player.hp;
      (w as unknown as Hurt).hurtPlayer.call(w, 20, 0);
      return hp0 - w.player.hp;
    };
    expect(hit(4, 0)).toBeCloseTo(20, 5);
    expect(hit(4, 1)).toBeCloseTo(16, 5);
    expect(hit(4, 3)).toBeCloseTo(8, 5);
    expect(hit(8, 2)).toBeCloseTo(12, 5);
    // Below tier 4 Blade Guard already covers it, and Grit adds nothing.
    expect(hit(2, 3)).toBeCloseTo(20 * (1 - 0.5 * 2 / 3), 5);
    expect(new World({ seed: 2, cls: 'duskblade', tier: 4, grit: 9 }).gritGuard).toBeCloseTo(0.6, 5);
  });

  it('Grit Cut: from tier 4 each Grit stack cuts every hit to a non-Duskblade by GRIT_CUT.perStack, up to 3 stacks', () => {
    const hit = (tier: number, grit: number) => {
      const w = new World({ seed: 2, cls: 'emberwright', tier, grit });
      w.enemies[0].alive = true;
      const hp0 = w.player.hp;
      (w as unknown as { hurtPlayer(amount: number, src: number): void }).hurtPlayer.call(w, 20, 0);
      return hp0 - w.player.hp;
    };
    const cut = GRIT_CUT.perStack;
    expect(cut).toBeGreaterThan(0);
    expect(hit(4, 0)).toBeCloseTo(20, 5);
    expect(hit(4, 1)).toBeCloseTo(20 * (1 - cut), 5);
    expect(hit(4, 3)).toBeCloseTo(20 * (1 - 3 * cut), 5);
    expect(hit(9, 2)).toBeCloseTo(20 * (1 - 2 * cut), 5);
    // Below tier 4 it does nothing (the novice aid covers those tiers), and stacks past 3 add nothing.
    expect(hit(3, 3)).toBeCloseTo(20, 5);
    for (const cls of ['lumen', 'slagbinder', 'bulwark'] as const) expect(new World({ seed: 2, cls, tier: 4, grit: 9 }).gritCut).toBeCloseTo(3 * cut, 5);
    // The Duskblade has Grit Guard instead, never both.
    expect(new World({ seed: 2, cls: 'duskblade', tier: 4, grit: 3 }).gritCut).toBe(0);
  });

  it('Shield Block at tier 1 covers only the foe the shield faces (the wide novice arc is gone)', () => {
    // A big foe in front of the shield but not its target takes the same toll as one behind it.
    const hitFrom = (faceIt: boolean) => {
      const w = new World({ seed: 2, cls: 'bulwark', tier: 1 });
      for (const e of w.enemies) e.alive = false;
      const inner = w as unknown as { spawn(kind: string, x: number, y: number): number };
      const a = inner.spawn('cinderBrute', w.player.x - 40, w.player.y);
      const b = inner.spawn('cinderBrute', w.player.x + 40, w.player.y);
      w.player.guardId = a;
      w.player.guardAng = faceIt ? 0 : Math.PI;
      const hp0 = w.player.hp;
      (w as unknown as Hurt).hurtPlayer.call(w, 50, b);
      return hp0 - w.player.hp;
    };
    expect(hitFrom(true)).toBeGreaterThan(0);
    expect(hitFrom(true)).toBeCloseTo(hitFrom(false), 5);
  });

  it('Steady Breath catches a melee hero once per fight at tier 1', () => {
    const w = new World({ seed: 2, cls: 'bulwark', tier: 1 });
    const hurt = (w as unknown as Hurt).hurtPlayer.bind(w);
    w.player.hp = w.player.maxHp * 0.35;
    hurt(w.player.maxHp * 0.1 / 0.8);
    expect(w.player.windUsed).toBe(true);
    expect(w.player.hp).toBeGreaterThan(w.player.maxHp * 0.4);
  });

  it('Steady Breath catches a low Emberwright once per fight at tier 1, fades by tier 3, and is gone from tier 4', () => {
    const caught = (tier: number) => {
      const w = new World({ seed: 2, cls: 'emberwright', tier });
      const hurt = (w as unknown as { hurtPlayer(amount: number, src: number): void }).hurtPlayer.bind(w);
      w.player.hp = w.player.maxHp * 0.35;
      hurt(w.player.maxHp * 0.1, -1);
      const after = w.player.hp / w.player.maxHp;
      hurt(w.player.maxHp * 0.01, -1);
      return { used: !!w.player.windUsed, after, again: w.player.hp / w.player.maxHp };
    };
    const t1 = caught(1), t3 = caught(3), t4 = caught(4);
    expect(t1.used).toBe(true);
    expect(t1.after).toBeCloseTo(0.45, 2);
    // Once per fight: a second low hit isn't caught.
    expect(t1.again).toBeCloseTo(0.44, 2);
    expect(t3.after).toBeCloseTo(0.25 + 0.2 / 3, 2);
    expect(t4.used).toBe(false);
    expect(t4.after).toBeCloseTo(0.25, 2);
  });
});
