import { describe, expect, it } from 'vitest';
import { World, CAPSTONES_2 } from '../sim/world';
import { TALENTS, TalentId } from '../sim/content/emberwright';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  talents: Partial<Record<TalentId, number>>;
  applyTalent(id: TalentId): void;
  spawn(kind: string, x: number, y: number): number;
  rebuildHash(): void;
  flameWave(): void;
  blink(input: { x: number; y: number }): void;
  hurtPlayer(amount: number, src?: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean, silent?: boolean, forceCrit?: boolean): void;
  swing(t: number): void;
};

/** A tier 4 world for `cls` with no foes alive. */
function world(cls: ClassId): { w: World; inner: Inner } {
  const w = new World({ seed: 5, cls, tier: 4, omens: [] });
  for (const e of w.enemies) e.alive = false;
  return { w, inner: w as unknown as Inner };
}

describe('capstone choices (C5)', () => {
  it('an unlocked branch offers both its capstones first, and taking one closes the other', () => {
    const { w, inner } = world('duskblade');
    inner.talents = { quickBlades: 3 };
    const ids = w.rollDraft().map((o) => o.id);
    expect(ids.slice(0, 2).sort()).toEqual(['bladeStorm', 'killingRhythm']);
    expect(ids).toHaveLength(3);
    inner.talents.killingRhythm = 1;
    const next = w.rollDraft().map((o) => o.id);
    expect(next).not.toContain('bladeStorm');
    expect(next.filter((id) => TALENTS[id].capstone)).toHaveLength(0);
  });

  it('every branch of the Emberwright and Duskblade has two capstones', () => {
    for (const b of ['wildfire', 'kindling', 'ashguard', 'bloodletting', 'tempo', 'guard']) {
      expect(Object.values(TALENTS).filter((d) => d.branch === b && d.capstone)).toHaveLength(2);
    }
  });

  it('Cinder Tide: Flame Wave hits a foe behind you and leaves fire at your feet', () => {
    const hitBehind = (tide: boolean) => {
      const { w, inner } = world('emberwright');
      if (tide) inner.talents.cinderTide = 1;
      const p = w.player;
      const front = inner.spawn('cinderBrute', p.x + 120, p.y);
      const back = w.enemies[inner.spawn('cinderBrute', p.x - 120, p.y)];
      void front;
      const before = back.hp;
      inner.rebuildHash();
      inner.flameWave();
      return before - back.hp;
    };
    expect(hitBehind(false)).toBe(0);
    expect(hitBehind(true)).toBeGreaterThan(0);
  });

  it('Searing Bloom: a crit splashes onto foes next to the target and burns it', () => {
    const { w, inner } = world('emberwright');
    inner.talents.searingBloom = 1;
    const p = w.player;
    const t = inner.spawn('cinderBrute', p.x + 200, p.y);
    const n = w.enemies[inner.spawn('cinderBrute', p.x + 240, p.y)];
    const before = n.hp;
    inner.rebuildHash();
    inner.damageEnemy(t, 100, false, false, true);
    expect(before - n.hp).toBeCloseTo(200 * CAPSTONES_2.bloomShare, 0);
  });

  it('Ashen Mantle: 40% less damage for 3 s after Blink', () => {
    const { w, inner } = world('emberwright');
    inner.talents.ashenMantle = 1;
    const p = w.player;
    inner.blink({ x: 1, y: 0 });
    p.shieldT = 0;
    const hp0 = p.hp;
    inner.hurtPlayer(50);
    expect(hp0 - p.hp).toBeCloseTo(50 * (1 - CAPSTONES_2.mantleCut));
  });

  it('Open Veins: Duskblade bleeds deal 60% more', () => {
    const bleed = (veins: boolean) => {
      const { w, inner } = world('duskblade');
      inner.talents.serratedEdge = 1;
      if (veins) inner.talents.openVeins = 1;
      const p = w.player;
      const e = inner.spawn('cinderBrute', p.x + 50, p.y);
      inner.rebuildHash();
      inner.swing(e);
      return w.enemies[e].burnDps;
    };
    expect(bleed(true)).toBeCloseTo(bleed(false) * CAPSTONES_2.veinsMult);
  });

  it('Killing Rhythm: swings in quick succession speed up, a pause resets them', () => {
    const { w, inner } = world('duskblade');
    inner.talents.killingRhythm = 1;
    const p = w.player;
    const e = inner.spawn('cinderBrute', p.x + 50, p.y);
    w.enemies[e].hp = 1e9;
    inner.rebuildHash();
    const base = w.swingCooldown;
    inner.swing(e);
    inner.swing(e);
    inner.swing(e);
    expect(p.rhythmN).toBe(2);
    expect(w.swingCooldown).toBeCloseTo(base / (1 + 2 * CAPSTONES_2.rhythmStep));
    (w as unknown as { time: number }).time += 5;
    inner.swing(e);
    expect(p.rhythmN).toBe(0);
  });

  it('Shadow Slip: Sidestep holds a second charge', () => {
    const { w, inner } = world('duskblade');
    inner.applyTalent('shadowSlip');
    w.player.cds[1] = 5;
    expect(w.canCast(1)).toBe(true);
  });
});
