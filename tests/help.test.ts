import { describe, expect, it } from 'vitest';
import { PASSIVES, loadoutFrom, newHero, pointsAvailable } from '../sim/hero';

/** The tooltip numbers have to match what the points really do. */
describe('hero talent tooltips', () => {
  const at = (id: keyof typeof PASSIVES, n: number) => loadoutFrom({ [id]: n }, []);
  it('Might: +3% damage per point, +30% at 10', () => {
    expect(at('might', 1).dmgMult).toBeCloseTo(1.03);
    expect(at('might', 10).dmgMult).toBeCloseTo(1.3);
    expect(PASSIVES.might.max).toBe(10);
  });
  it('Fortitude: +8 max health per point, +80 at 10', () => {
    expect(at('fortitude', 10).maxHpBonus).toBe(80);
    expect(PASSIVES.fortitude.max).toBe(10);
  });
  it('Insight: +4% experience per point, +20% at 5', () => {
    expect(at('insight', 5).xpMult).toBeCloseTo(1.2);
    expect(PASSIVES.insight.max).toBe(5);
  });
  it('Alacrity: +2% attack speed per point, +20% at 10', () => {
    expect(at('alacrity', 10).hasteMult).toBeCloseTo(1.2);
    expect(PASSIVES.alacrity.max).toBe(10);
  });
  it('one point per hero level after the first', () => {
    const h = newHero();
    h.level = 5;
    expect(pointsAvailable(h)).toBe(4);
  });
});
