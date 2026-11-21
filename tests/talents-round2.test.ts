import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { TALENTS, TalentId } from '../sim/content/emberwright';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  talents: Partial<Record<TalentId, number>>;
  rebuildHash(): void;
  hurtPlayer(amount: number, src?: number): void;
  healPlayer(amount: number): number;
  baseCooldown(slot: number): number;
  maxBrilliance: number;
  lumenRange: number;
  regen: number;
  damageTakenMult: number;
  sweepCooldown: number;
};

const ROUND2: TalentId[] = [
  'rivetedPlates', 'slowPulse', 'hardKnocks', 'grimTally', 'broadShoulders', 'fullWeight',
  'daybreakPulse', 'lanternHeart', 'lampglowCare', 'steadyHalo', 'longNote', 'hallowedEmbers',
  'deepCoat', 'wideSpatter', 'fastLadle', 'denseGlob', 'slagScales', 'slowCool',
];

function world(cls: ClassId): { w: World; inner: Inner } {
  const w = new World({ seed: 5, cls, tier: 4, omens: [] });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  inner.rebuildHash();
  return { w, inner };
}

/** Damage a fresh hero of `cls` takes from one 100-point hit, with `talents`. */
function hitTaken(cls: ClassId, talents: Partial<Record<TalentId, number>>): number {
  const { w, inner } = world(cls);
  inner.talents = talents;
  const before = w.player.hp;
  inner.hurtPlayer(100);
  return before - w.player.hp;
}

describe('class talents round 2 (C5)', () => {
  it('adds two non-capstone cards to every Bulwark, Lumen and Slagbinder branch', () => {
    const branches = ['bastion', 'retribution', 'vanguard', 'dawn', 'grace', 'choir', 'forge', 'clinker', 'crust'];
    for (const b of branches) {
      expect(ROUND2.filter((id) => TALENTS[id].branch === b)).toHaveLength(2);
    }
    for (const id of ROUND2) expect(TALENTS[id].capstone).toBeFalsy();
  });

  it('the draft can offer the new cards', () => {
    const seen = new Set<string>();
    for (const cls of ['bulwark', 'lumen', 'slagbinder'] as ClassId[]) {
      for (let s = 1; s <= 60; s++) {
        const w = new World({ seed: s, cls, tier: 4, omens: [] });
        for (const o of w.rollDraft()) seen.add(o.id);
      }
    }
    expect(ROUND2.filter((id) => !seen.has(id))).toEqual([]);
  });

  it('Riveted Plates: the Bulwark takes less from each hit', () => {
    const { inner } = world('bulwark');
    const base = inner.damageTakenMult;
    inner.talents = { rivetedPlates: 3 };
    expect(inner.damageTakenMult).toBeLessThan(base);
  });

  it('Slow Pulse only heals below half health', () => {
    const { w, inner } = world('bulwark');
    inner.talents = { slowPulse: 2 };
    expect(inner.regen).toBe(0);
    w.player.hp = w.player.maxHp * 0.4;
    expect(inner.regen).toBeCloseTo(3);
  });

  it('Broad Shoulders: Shield Sweep swings more often', () => {
    const { inner } = world('bulwark');
    const base = inner.sweepCooldown;
    inner.talents = { broadShoulders: 3 };
    expect(inner.sweepCooldown).toBeCloseTo(base / 1.18);
  });

  it('Daybreak Pulse: Radiant Burst recharges sooner', () => {
    const { inner } = world('lumen');
    const base = inner.baseCooldown(0);
    inner.talents = { daybreakPulse: 2 };
    expect(inner.baseCooldown(0)).toBeCloseTo(base - 1);
  });

  it('Lantern Heart and Long Note raise the Lumen caps', () => {
    const { inner } = world('lumen');
    const cap = inner.maxBrilliance;
    const range = inner.lumenRange;
    inner.talents = { lanternHeart: 3, longNote: 2 };
    expect(inner.maxBrilliance).toBe(cap + 90);
    expect(inner.lumenRange).toBe(range + 80);
  });

  it('Lampglow Care: Lumen heals are stronger', () => {
    const { w, inner } = world('lumen');
    w.player.hp = 10;
    const plain = inner.healPlayer(20);
    w.player.hp = 10;
    inner.talents = { lampglowCare: 3 };
    expect(inner.healPlayer(20)).toBeCloseTo(plain * 1.24);
  });

  it('Steady Halo and Slag Scales cut every hit', () => {
    expect(hitTaken('lumen', { steadyHalo: 2 })).toBeLessThan(hitTaken('lumen', {}));
    expect(hitTaken('slagbinder', { slagScales: 3 })).toBeLessThan(hitTaken('slagbinder', {}));
  });

  it('a card from another class does nothing', () => {
    expect(hitTaken('emberwright', { slagScales: 3, steadyHalo: 2 })).toBeCloseTo(hitTaken('emberwright', {}));
  });
});

describe('bot talent priority', () => {
  it('ranks every class talent, so a new card never jumps the queue', async () => {
    const { BOT_PRIORITY } = await import('../sim/bot');
    const missing = (Object.keys(TALENTS) as TalentId[]).filter((id) => !BOT_PRIORITY.includes(id));
    expect(missing).toEqual([]);
  });
});
