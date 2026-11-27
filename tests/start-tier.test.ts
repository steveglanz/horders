import { describe, expect, it } from 'vitest';
import { newHero, switchClass } from '../sim/hero';
import { MAX_TIER, startTier } from '../sim/content/scaling';

// CP2 Kiln panel (27 Nov): the hub opened on the top unlocked tier (never won yet) and returning players died in 10-40 s.
describe('startTier', () => {
  it('opens a fresh hero on tier 1', () => {
    expect(startTier(newHero())).toBe(1);
  });
  it('opens an old save on the highest tier won, not the one above it', () => {
    expect(startTier({ maxTier: 6 })).toBe(5);
    expect(startTier({ maxTier: 2 })).toBe(1);
    expect(startTier({ maxTier: MAX_TIER + 1 })).toBe(MAX_TIER);
  });
  it('opens on the tier last delved, kept inside the unlocked range', () => {
    expect(startTier({ maxTier: 6, lastTier: 6 })).toBe(6);
    expect(startTier({ maxTier: 6, lastTier: 2 })).toBe(2);
    expect(startTier({ maxTier: 3, lastTier: 9 })).toBe(3);
    expect(startTier({ maxTier: 3, lastTier: 0 })).toBe(1);
  });
  it('keeps each class its own last tier', () => {
    const h = newHero();
    h.maxTier = 5;
    h.lastTier = 4;
    switchClass(h, 'bulwark');
    expect(startTier(h)).toBe(1);
    switchClass(h, 'emberwright');
    expect(startTier(h)).toBe(4);
  });
});
