import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { POTIONS, POTION, PotionId, potionCost } from '../sim/content/potions';
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

describe('co-op: each hero brings their own potion', () => {
  const party = (potion?: PotionId, lead?: PotionId, bounty?: number) =>
    new World({ seed: 1, route: [...ROUTE], omens: [], potion: lead, bounty, party: [{ cls: 'bulwark', potion }], partySize: 2 });

  it('a party member\'s Rising Draught saves them, once, and leaves the lead hero\'s alone', () => {
    const w = party('risingDraught');
    const hurt = (w as unknown as { hurtPlayer(a: number): void }).hurtPlayer.bind(w);
    w.use(1);
    hurt(w.player.hp + 50);
    expect(w.player.hp).toBeCloseTo(w.player.maxHp * POTION.riseHp, 5);
    w.player.shieldT = 0;
    hurt(w.player.hp + 50);
    expect(w.player.hp).toBeLessThanOrEqual(0);
    w.use(0);
    expect(w.potionUsed).toBe(false);
    hurt(w.player.hp + 50);
    expect(w.player.hp).toBeLessThanOrEqual(0);
  });

  it('the lead hero\'s potion no longer covers the party', () => {
    const w = party(undefined, 'stillwater');
    const lead = w.abilityCooldown(3);
    w.use(1);
    const plain = new World({ seed: 1, route: [...ROUTE], omens: [], party: [{ cls: 'bulwark' }], partySize: 2 });
    plain.use(1);
    expect(w.abilityCooldown(3)).toBe(plain.abilityCooldown(3));
    w.use(0);
    expect(lead).toBeCloseTo(plain.abilityCooldown(3) * POTION.stillwaterCd, 5);
  });

  it('a party member\'s Stillwater Tonic and Kindling Brew work for them', () => {
    const tonic = party('stillwater');
    const plain = party();
    tonic.use(1); plain.use(1);
    expect(tonic.abilityCooldown(3)).toBeCloseTo(plain.abilityCooldown(3) * POTION.stillwaterCd, 5);
    const kin = party('kindling');
    expect(kin.hero(1).player.level).toBe(2);
    expect(kin.hero(1).player.pendingLevels).toBe(1);
    expect(kin.player.level).toBe(1);
  });

  it('a bounty ignores party potions, and an unknown potion is ignored', () => {
    expect(party('kindling', undefined, 100).hero(1).player.level).toBe(party(undefined, undefined, 100).hero(1).player.level);
    expect(party('bogus' as PotionId).hero(1).player.level).toBe(1);
  });
});
