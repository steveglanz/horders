import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { OMEN_IDS, OMEN_TUNING, omenCount, omensFor } from '../sim/content/omens';

function play(w: World, until: (w: World) => boolean, max = 600) {
  while (w.state !== 'ended' && w.time < max && !until(w)) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
}

describe('omens', () => {
  it('tiers 1 and 2 have none; counts grow with tier', () => {
    expect(omensFor(1, 100)).toEqual([]);
    expect(omensFor(2, 100)).toEqual([]);
    expect([3, 5, 6, 9, 10, 20].map(omenCount)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('the rotation is fixed for a week, nests across tiers, and changes between weeks', () => {
    expect(omensFor(10, 2900)).toEqual(omensFor(10, 2900));
    expect(omensFor(10, 2900).slice(0, 2)).toEqual(omensFor(7, 2900));
    const firsts = new Set(Array.from({ length: 30 }, (_, k) => omensFor(3, k)[0]));
    expect(firsts.size).toBeGreaterThan(2);
    for (const id of omensFor(10, 7)) expect(OMEN_IDS).toContain(id);
  });

  it('each omen adds loot luck', () => {
    const a = new World({ seed: 1, tier: 4, omens: [] });
    const b = new World({ seed: 1, tier: 4, omens: ['quickened', 'warded'] });
    expect(b.luck / a.luck).toBeCloseTo(1 + 2 * OMEN_TUNING.luckPerOmen);
  });

  it('quickened shortens enemy casts', () => {
    const route = ['brute', 'brute', 'brute', 'brute', 'kilnMother'] as const;
    const durs = (omens: ('quickened')[]) => {
      const w = new World({ seed: 5, route: [...route], omens });
      play(w, (x) => x.enemies.some((e) => e.alive && e.castId));
      return w.enemies.find((e) => e.alive && e.castId)!.castDur;
    };
    expect(durs(['quickened']) / durs([])).toBeCloseTo(OMEN_TUNING.quickenedCast);
  });

  it('warded grants one shield below half health', () => {
    const w = new World({ seed: 5, route: ['brute', 'brute', 'brute', 'brute', 'kilnMother'], omens: ['warded'] });
    let wards = 0;
    play(w, (x) => { wards += x.events.filter((e) => e.type === 'ward').length; return x.encounter >= 1; });
    expect(wards).toBe(1);
  });

  it('volatile ground erupts under the player during fights', () => {
    const w = new World({ seed: 3, omens: ['volatileGround'] });
    play(w, (x) => x.telegraphs.some((t) => t.alive && t.r === OMEN_TUNING.volatileRadius), 60);
    expect(w.telegraphs.some((t) => t.alive && t.r === OMEN_TUNING.volatileRadius)).toBe(true);
  });

  it('runs stay deterministic with omens', () => {
    const run = () => { const w = new World({ seed: 21, tier: 10, week: 3 }); play(w, () => false, 120); return [w.time, w.kills, Math.round(w.player.hp)]; };
    expect(run()).toEqual(run());
  });
});

describe('world boss omen', () => {
  it('adds the boss Omen to every tier, without duplicates, and raises luck', () => {
    const base = new World({ seed: 1, tier: 1, week: 100 });
    const w = new World({ seed: 1, tier: 1, week: 100, bossOmen: 'kindledDead' });
    expect(base.omens).toEqual([]);
    expect(w.omens).toEqual(['kindledDead']);
    expect(w.bossOmen).toBe('kindledDead');
    expect(w.luck).toBeCloseTo(base.luck * (1 + OMEN_TUNING.luckPerOmen) * (1 + OMEN_TUNING.bossOmenLuck));

    // When the tier already rolled the boss's Omen it is not added twice, but the boss bonus still applies.
    const weekly = omensFor(3, 100);
    const t3 = new World({ seed: 1, tier: 3, week: 100 });
    const dup = new World({ seed: 1, tier: 3, week: 100, bossOmen: weekly[0] });
    expect(dup.omens).toEqual(weekly);
    expect(dup.bossOmen).toBeUndefined();
    expect(dup.luck).toBeCloseTo(t3.luck * (1 + OMEN_TUNING.bossOmenLuck));
  });

  it('ignores an unknown Omen id from the server', () => {
    const w = new World({ seed: 1, tier: 1, bossOmen: 'notAnOmen' as never });
    expect(w.omens).toEqual([]);
  });
});
