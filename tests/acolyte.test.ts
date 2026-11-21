import { describe, expect, it } from 'vitest';
import { World, ACOLYTE } from '../sim/world';

/** Stands still (invulnerable) until an acolyte is casting Kindle on a wounded Brute. */
function toKindle(seed = 1): { w: World; a: number } {
  const w = new World({ seed, route: ['acolytes', 'acolytes', 'acolytes', 'acolytes', 'kilnMother'], omens: [], invulnerable: true });
  while (w.time < 30) {
    if (w.state === 'draft') { w.choose(0); continue; }
    const brute = w.enemies.find((e) => e.alive && e.kind === 'cinderBrute');
    if (brute) brute.hp = brute.maxHp * 0.5;
    w.step({ x: 0, y: 0 });
    const a = w.enemies.findIndex((e) => e.alive && e.kind === 'acolyte' && e.castId === 'kindle');
    if (a >= 0) return { w, a };
  }
  throw new Error('no Kindle cast');
}

describe('Kiln acolytes heal with a Kindle cast', () => {
  it('shows a cast bar first, then heals its ward when the cast lands', () => {
    const { w, a } = toKindle();
    const acolyte = w.enemies[a];
    const brute = w.enemies[acolyte.aux2];
    expect(brute.kind).toBe('cinderBrute');
    expect(acolyte.interruptible).toBe(true);
    const before = brute.hp;
    let healed = 0;
    while (acolyte.castId === 'kindle') {
      w.step({ x: 0, y: 0 });
      for (const ev of w.events) if (ev.type === 'heal') healed += ev.amount;
    }
    expect(healed).toBeCloseTo(brute.maxHp * ACOLYTE.heal, 0);
    expect(brute.hp).toBeGreaterThan(before);
  });

  it('heals nothing between casts', () => {
    const { w, a } = toKindle();
    const acolyte = w.enemies[a];
    while (acolyte.castId === 'kindle') w.step({ x: 0, y: 0 });
    const brute = w.enemies[acolyte.aux2];
    // Stop the other acolyte too, then watch for one second.
    for (const e of w.enemies) if (e.kind === 'acolyte') { e.abilityT = 99; e.castId = ''; }
    const hp = brute.hp;
    for (let k = 0; k < 30; k++) w.step({ x: 0, y: 0 });
    expect(brute.hp).toBeLessThanOrEqual(hp);
  });

  it('a Quenched Kindle heals nothing and costs only half of Quench', () => {
    const { w, a } = toKindle();
    const acolyte = w.enemies[a];
    w.player.x = acolyte.x + 60;
    w.player.y = acolyte.y;
    // Keep the Brute out of the way so Kindle is the only cast up.
    const brute = w.enemies[acolyte.aux2];
    brute.castId = '';
    expect(w.interruptTarget()).toBe(a);
    const hp = brute.hp;
    w.step({ x: 0, y: 0, cast: 3 });
    expect(acolyte.castId).toBe('');
    expect(w.player.cds[3]).toBeCloseTo(w.abilityCooldown(3) * ACOLYTE.quenchCost, 1);
    for (let k = 0; k < 30; k++) w.step({ x: 0, y: 0 });
    expect(w.events.some((e) => e.type === 'heal')).toBe(false);
    expect(brute.hp).toBeLessThanOrEqual(hp);
  });

  it('Quench goes for a damaging cast before a heal', () => {
    const { w, a } = toKindle();
    const acolyte = w.enemies[a];
    const b = acolyte.aux2;
    const brute = w.enemies[b];
    // Put the hero next to both, with the Brute winding up a Ground Pound.
    w.player.x = (acolyte.x + brute.x) / 2;
    w.player.y = (acolyte.y + brute.y) / 2;
    brute.castId = 'groundPound';
    brute.castName = 'Ground Pound';
    brute.interruptible = true;
    brute.castT = 0;
    brute.castDur = 1.4;
    expect(w.interruptTarget()).toBe(b);
  });
});
