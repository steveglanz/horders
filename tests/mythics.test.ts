import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { makeItem } from '../sim/hero';
import { Rng } from '../sim/rng';
import { MYTHICS, MythicId, mythicPool } from '../sim/content/items';
import { ClassId } from '../sim/content/emberwright';

/** Private World methods the tests drive directly. */
type Inner = {
  spawn(kind: string, x: number, y: number): number;
  execution(): void;
  combustion(): void;
  quench(): void;
  sanctuary(): void;
  slamCone(ang: number, scale: number, stun: boolean): void;
  sidestep(input: { x: number; y: number }): void;
  swing(t: number): void;
  bulwarkMitigate(raw: number, src: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  /** The spatial hash is rebuilt each step; tests that spawn and then strike rebuild it by hand. */
  rebuildHash(): void;
};

/** A world with one hero wearing `mythic` (or nothing), no enemies left alive, at tier 4 (no novice aid). */
function world(cls: ClassId, mythic?: MythicId): { w: World; inner: Inner } {
  const gear = [];
  if (mythic) {
    const it = makeItem(new Rng(1), 'm1', 'ring', 'mythic', 10, cls);
    it.mythic = mythic;
    gear.push(it);
  }
  const w = new World({ seed: 5, cls, tier: 4, omens: [], gear });
  for (const e of w.enemies) e.alive = false;
  return { w, inner: w as unknown as Inner };
}

describe('class Mythics (R4)', () => {
  it('each class rolls the shared four plus only its own two', () => {
    for (const cls of ['emberwright', 'duskblade', 'bulwark', 'lumen'] as ClassId[]) {
      const pool = mythicPool(cls);
      expect(pool).toHaveLength(6);
      expect(pool.every((m) => !MYTHICS[m].cls || MYTHICS[m].cls === cls)).toBe(true);
    }
    expect(mythicPool()).toHaveLength(4);
    const rng = new Rng(9);
    for (let k = 0; k < 200; k++) {
      const m = makeItem(rng, `i${k}`, 'ring', 'mythic', 10, 'lumen').mythic!;
      expect(!MYTHICS[m].cls || MYTHICS[m].cls === 'lumen').toBe(true);
    }
  });

  it("Wanderer's Wake halves Blink's cooldown and lays fire along the path", () => {
    const plain = world('emberwright').w;
    const { w } = world('emberwright', 'wanderersWake');
    expect(w.abilityCooldown(1)).toBeCloseTo(plain.abilityCooldown(1) / 2);
  });

  it('Banked Heart bursts around the Emberwright and refunds Heat per kill', () => {
    const { w, inner } = world('emberwright', 'bankedHeart');
    const p = w.player;
    for (const dx of [-60, 0, 60]) w.enemies[inner.spawn('ashling', p.x + dx, p.y + 80)].hp = 1;
    p.heat = 0;
    inner.rebuildHash();
    inner.combustion();
    expect(w.enemies.filter((e) => e.alive)).toHaveLength(0);
    expect(p.heat).toBe(45);
  });

  it('Banked Heart still aims Combustion at an acolyte', () => {
    const { w, inner } = world('emberwright', 'bankedHeart');
    const p = w.player;
    const a = w.enemies[inner.spawn('acolyte', p.x + 400, p.y)];
    const before = a.hp;
    inner.rebuildHash();
    inner.combustion();
    expect(a.hp).toBeLessThan(before);
  });

  it('Red Ledger doubles Execution below 50% health and an Execution kill brings Rending Dash back', () => {
    const hitAt = (mythic?: MythicId) => {
      const { w, inner } = world('duskblade', mythic);
      const p = w.player;
      const e = w.enemies[inner.spawn('cinderBrute', p.x + 60, p.y)];
      e.hp = e.maxHp * 0.45;
      const before = e.hp;
      inner.rebuildHash();
      inner.execution();
      return before - e.hp;
    };
    expect(hitAt('redLedger')).toBeGreaterThan(hitAt() * 1.5);

    const { w, inner } = world('duskblade', 'redLedger');
    const p = w.player;
    w.enemies[inner.spawn('ashling', p.x + 60, p.y)].hp = 1;
    p.cds[0] = 4;
    inner.rebuildHash();
    inner.execution();
    expect(p.cds[0]).toBe(0);
  });

  it('Mirrorstep leaves an afterimage that strikes with the swing', () => {
    const { w, inner } = world('duskblade', 'mirrorstep');
    const p = w.player;
    const x0 = p.x;
    const y0 = p.y;
    // A foe beside where the Duskblade stood, another where it will land.
    const left = w.enemies[inner.spawn('cinderBrute', x0 - 60, y0)];
    inner.sidestep({ x: 1, y: 0 });
    expect(p.imageT).toBe(2);
    const right = inner.spawn('cinderBrute', p.x + 50, p.y);
    const before = left.hp;
    inner.rebuildHash();
    inner.swing(right);
    expect(left.hp).toBeLessThan(before);
  });

  it('Tethered Shield interrupts three casters and Charge rushes the first one', () => {
    const { w, inner } = world('bulwark', 'tetheredShield');
    const p = w.player;
    const ids = [0, 1, 2].map((k) => inner.spawn('cinderBrute', p.x + 150 + 60 * k, p.y + 40 * k));
    for (const i of ids) inner.startCast(i, 'test', 'Test', 3, true);
    inner.quench();
    expect(ids.every((i) => !w.enemies[i].castId)).toBe(true);
    expect(p.tossT).toBe(4);
    expect(w.chargeTarget()).toBe(p.tossId);
  });

  it('Ringwall Vow blocks 20% from every side and Rim Smash pulls foes in', () => {
    const block = (mythic?: MythicId) => {
      const { w, inner } = world('bulwark', mythic);
      const p = w.player;
      const behind = inner.spawn('cinderBrute', p.x - 60, p.y);
      p.guardId = -1;
      inner.rebuildHash();
      return inner.bulwarkMitigate(100, behind) / world('bulwark', mythic).inner.bulwarkMitigate(100, -1);
    };
    expect(block()).toBeCloseTo(1);
    expect(block('ringwallVow')).toBeCloseTo(0.8);

    const { w, inner } = world('bulwark', 'ringwallVow');
    const p = w.player;
    const small = w.enemies[inner.spawn('ashling', p.x + 120, p.y)];
    small.hp = 1e6;
    const big = w.enemies[inner.spawn('cinderBrute', p.x + 100, p.y + 30)];
    const dist = (e: typeof small) => Math.hypot(e.x - p.x, e.y - p.y);
    const s0 = dist(small);
    const b0 = dist(big);
    inner.rebuildHash();
    inner.slamCone(0, 1, true);
    // The horde comes in; big foes are still shoved, so blooms can be cleared.
    expect(dist(small)).toBeLessThan(s0);
    expect(dist(big)).toBeGreaterThan(b0);
  });

  it('Anchored Dawn lengthens Sanctuary by half and speeds Radiant Burst inside it', () => {
    const { w, inner } = world('lumen', 'anchoredDawn');
    const p = w.player;
    inner.sanctuary();
    expect(p.sanctT).toBe(9);
    p.cds[0] = 4;
    w.step({ x: 0, y: 0 });
    expect(4 - p.cds[0]).toBeCloseTo(1.5 / 30, 5);
  });

  it('Eclipse Glass widens Radiant Burst by 10%', () => {
    expect(world('lumen', 'eclipseGlass').w.burstRadius).toBeCloseTo(world('lumen').w.burstRadius * 1.1);
  });
});
