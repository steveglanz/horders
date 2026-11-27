import { describe, expect, it } from 'vitest';
import { World, BOIL, STALL, TICK } from '../sim/world';

/** Steps an idle hero until `until` holds, or for at most `cap` seconds. */
function idleUntil(w: World, until: () => boolean, cap: number): void {
  for (let n = 0; n < cap / TICK && !until(); n++) {
    if (w.state === 'draft') { w.choose(0); continue; }
    w.step({ x: 0, y: 0 });
  }
}

describe('Boil-over replaces Burnout (1.0 CP2, docs/design/fight-budgets.md)', () => {
  it('a regular fight nobody can win or lose still ends, and never by hurting the hero', () => {
    const w = new World({ seed: 3, omens: [], invulnerable: true });
    idleUntil(w, () => w.phase === 'fight', 60);
    expect(w.phase).toBe('fight');
    const start = w.time;
    const fight = w.encounter;
    const hp = w.player.hp;
    // ...and the hero can't hurt the foes: only the stall breaker can end it.
    (w as unknown as { loadout: { dmgMult: number } }).loadout = { ...w.loadout, dmgMult: 0 };
    // Foes can't hurt the hero; the stall breaker cracks the foes instead of burning the hero.
    idleUntil(w, () => w.encounter !== fight || w.state === 'ended', STALL.fight + STALL.named + 30);
    expect(w.state).not.toBe('ended');
    expect(w.player.hp).toBeGreaterThanOrEqual(hp);
    expect(w.time - start).toBeGreaterThan(STALL.fight - 1);
    expect(w.time - start).toBeLessThan(STALL.fight + STALL.named + 12);
  });

  it('a fight never holds more than the add cap', () => {
    const w = new World({ seed: 3, omens: [] });
    idleUntil(w, () => w.phase === 'fight', 60);
    const inner = w as unknown as { spawn(kind: string, x: number, y: number): number };
    for (let k = 0; k < STALL.addCap + 50; k++) inner.spawn('ashling', 300, 300);
    expect(w.aliveEnemies).toBe(STALL.addCap);
  });

  it('the Kiln Mother boils over at 90 s, shown, and every 10 s after it each hit lands harder (her own enrage still at 150 s)', () => {
    const w = new World({ seed: 5, omens: [], route: ['kilnMother'], invulnerable: true });
    idleUntil(w, () => w.bossSpawned, 60);
    expect(w.bossSpawned).toBe(true);
    const boss = w.enemies[w.bossIndex];
    expect(w.boilAfter(boss.kind)).toBe(90);
    const seen: number[] = [];
    const watch = () => { for (const e of w.events) if (e.type === 'boilOver') seen.push(w.time - boss.spawnedAt); return false; };
    idleUntil(w, () => { watch(); return w.time - boss.spawnedAt >= 89; }, 120);
    expect(w.boilSteps).toBe(0);
    expect(w.boilMult).toBe(1);
    idleUntil(w, () => { watch(); return w.time - boss.spawnedAt >= 91; }, 5);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeCloseTo(90, 0);
    expect(w.boilSteps).toBe(1);
    expect(w.boilMult).toBe(1);
    idleUntil(w, () => w.time - boss.spawnedAt >= 90 + 2 * BOIL.every + 1, 30);
    expect(w.boilSteps).toBe(3);
    expect(w.boilMult).toBeCloseTo(1 + 2 * BOIL.step, 6);
    expect(w.bossEnraged).toBe(false);
    idleUntil(w, () => w.time - boss.spawnedAt >= 151, 60);
    expect(w.bossEnraged).toBe(true);
    expect(w.boilSteps).toBe(7);
  });
});
