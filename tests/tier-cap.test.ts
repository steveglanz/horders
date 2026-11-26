import { describe, expect, it } from 'vitest';
import { applyRun, newHero } from '../sim/hero';
import { RunSummary } from '../sim/world';
import { MAX_TIER, topTier } from '../sim/content/scaling';
import { keyTier } from '../sim/content/keys';
import { bountyTier } from '../sim/content/bounty';

const win = (tier: number): RunSummary => ({ victory: true, time: 300, kills: 100, level: 5, damageDealt: 1000, talents: {}, tier, dungeon: 'kiln' });

describe('tier cap (Steve, 26 Nov: the ladder tops out at 15)', () => {
  it('a win on tier 15 marks it beaten but opens no tier 16', () => {
    const h = newHero();
    h.maxTier = MAX_TIER;
    applyRun(h, 1, win(MAX_TIER), false);
    expect(h.maxTier).toBe(MAX_TIER + 1);
    expect(topTier(h.maxTier)).toBe(MAX_TIER);
    applyRun(h, 2, win(MAX_TIER), false);
    expect(h.maxTier).toBe(MAX_TIER + 1);
  });

  it('below the cap a top-tier win still opens the next tier', () => {
    const h = newHero();
    h.maxTier = 7;
    applyRun(h, 1, win(7), false);
    expect(h.maxTier).toBe(8);
  });

  it('keys and bounties never go past tier 15, even for an old save above it', () => {
    expect(keyTier(MAX_TIER + 1)).toBe(MAX_TIER);
    expect(keyTier(22)).toBe(MAX_TIER);
    expect(bountyTier(22)).toBe(MAX_TIER);
    expect(topTier(22)).toBe(MAX_TIER);
    expect(keyTier(10)).toBe(9);
  });
});
