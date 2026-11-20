import { describe, it, expect } from 'vitest';
import { newThreat, damageThreat, healThreat, taunt, scaleThreat, dropHero, updateTarget, THREAT } from '../sim/threat';

describe('threat', () => {
  it('a tank holds the enemy over a damage dealer doing more damage', () => {
    const t = newThreat();
    damageThreat(t, 'tank', 100, THREAT.tankMult);
    damageThreat(t, 'dps', 300);
    expect(updateTarget(t, 0.1)).toBe('tank');
  });
  it('switches only past the margin', () => {
    const t = newThreat();
    damageThreat(t, 'a', 100); updateTarget(t, 0.1);
    damageThreat(t, 'b', 115);
    expect(updateTarget(t, 0.1)).toBe('a');
    damageThreat(t, 'b', 10);
    expect(updateTarget(t, 0.1)).toBe('b');
  });
  it('healing threat is halved and split across enemies', () => {
    const a = newThreat(), b = newThreat();
    healThreat([a, b], 'heal', 200);
    expect(a.amounts.heal).toBe(50);
    expect(b.amounts.heal).toBe(50);
  });
  it('taunt forces the enemy for its duration, then threat decides', () => {
    const t = newThreat();
    damageThreat(t, 'dps', 1000); updateTarget(t, 0.1);
    taunt(t, 'tank');
    expect(t.amounts.tank).toBeCloseTo(1100);
    damageThreat(t, 'dps', 5000);
    expect(updateTarget(t, 1)).toBe('tank');
    expect(updateTarget(t, 2.5)).toBe('dps');
  });
  it('threat dump and death', () => {
    const t = newThreat();
    damageThreat(t, 'a', 100); damageThreat(t, 'b', 90); updateTarget(t, 0.1);
    scaleThreat(t, 'a', 0.5);
    expect(updateTarget(t, 0.1)).toBe('b');
    dropHero(t, 'b');
    expect(updateTarget(t, 0.1)).toBe('a');
  });
});
