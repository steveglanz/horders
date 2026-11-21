import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { POTIONS, POTION, potionCost } from '../sim/content/potions';
import { brewBlocker, brewPotion, newHero, switchClass, takePotion } from '../sim/hero';

const ROUTE = ['pack', 'pack', 'pack', 'pack', 'kilnMother'] as const;

describe('Alchemy: one potion per delve', () => {
  it('brewing costs embers, and only one potion waits at a time', () => {
    const h = newHero();
    h.embers = 50;
    expect(brewPotion(h, 'stillwater')).toBe(true);
    expect(h.embers).toBe(50 - POTIONS.stillwater.cost);
    expect(brewBlocker(h, 'stillwater')).toMatch(/Already/);
    // Brewing a different one pours the first away, with no refund.
    expect(brewPotion(h, 'kindling')).toBe(true);
    expect(h.potion).toBe('kindling');
    expect(h.embers).toBe(50 - POTIONS.stillwater.cost - POTIONS.kindling.cost);
  });

  it("can't be brewed without the embers", () => {
    const h = newHero();
    h.embers = POTIONS.risingDraught.cost - 1;
    expect(brewPotion(h, 'risingDraught')).toBe(false);
    expect(h.potion).toBeUndefined();
    expect(h.embers).toBe(POTIONS.risingDraught.cost - 1);
  });

  it('Rising Draught costs more as the hero climbs; the others stay flat (P7)', () => {
    expect(potionCost('risingDraught', 1)).toBe(POTIONS.risingDraught.cost);
    expect(potionCost('risingDraught', 11)).toBe(POTIONS.risingDraught.cost + 10 * (POTIONS.risingDraught.costPerTier ?? 0));
    expect(potionCost('stillwater', 11)).toBe(POTIONS.stillwater.cost);
    const h = newHero();
    h.maxTier = 11;
    h.embers = potionCost('risingDraught', 11);
    expect(brewPotion(h, 'risingDraught')).toBe(true);
    expect(h.embers).toBe(0);
  });

  it('a delve takes the potion and uses it up', () => {
    const h = newHero();
    h.embers = 50;
    brewPotion(h, 'kindling');
    expect(takePotion(h)).toBe('kindling');
    expect(h.potion).toBeUndefined();
    expect(takePotion(h)).toBeUndefined();
  });

  it('each class keeps its own brewed potion', () => {
    const h = newHero();
    h.embers = 50;
    brewPotion(h, 'stillwater');
    switchClass(h, 'duskblade');
    expect(h.potion).toBeUndefined();
    switchClass(h, 'emberwright');
    expect(h.potion).toBe('stillwater');
  });

  it('Rising Draught turns the first killing blow aside, once', () => {
    const w = new World({ seed: 1, route: [...ROUTE], omens: [], potion: 'risingDraught' });
    const hurt = (w as unknown as { hurtPlayer(a: number): void }).hurtPlayer.bind(w);
    hurt(w.player.hp + 50);
    expect(w.player.hp).toBeCloseTo(w.player.maxHp * POTION.riseHp, 5);
    expect(w.potionUsed).toBe(true);
    expect(w.events.some((e) => e.type === 'potion')).toBe(true);
    w.player.shieldT = 0;
    hurt(w.player.hp + 50);
    expect(w.player.hp).toBeLessThanOrEqual(0);
  });

  it('Stillwater Tonic shortens only the interrupt', () => {
    const plain = new World({ seed: 1, route: [...ROUTE], omens: [] });
    const tonic = new World({ seed: 1, route: [...ROUTE], omens: [], potion: 'stillwater' });
    expect(tonic.abilityCooldown(3)).toBeCloseTo(plain.abilityCooldown(3) * POTION.stillwaterCd, 5);
    for (const s of [0, 1, 2]) expect(tonic.abilityCooldown(s)).toBe(plain.abilityCooldown(s));
  });

  it('Kindling Brew starts the delve a level up with a pick waiting', () => {
    const w = new World({ seed: 1, route: [...ROUTE], omens: [], potion: 'kindling' });
    expect(w.player.level).toBe(2);
    expect(w.player.pendingLevels).toBe(1);
  });

  it('the daily bounty ignores potions, so every player runs the same delve', () => {
    const w = new World({ seed: 1, route: [...ROUTE], omens: [], potion: 'kindling', bounty: 100 });
    expect(w.potion).toBeUndefined();
  });
});
