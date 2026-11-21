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
  'deepSmoulder', 'emberCarpet', 'brightWick', 'fastFuse', 'sootCloak', 'bankedFire',
  'slowDrip', 'hungrySteel', 'lightGrip', 'keenLunge', 'lowStance', 'quietMend',
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
  it('adds two deep cards to every branch of every class', () => {
    const branches = ['bastion', 'retribution', 'vanguard', 'dawn', 'grace', 'choir', 'forge', 'clinker', 'crust', 'wildfire', 'kindling', 'ashguard', 'bloodletting', 'tempo', 'guard'];
    for (const b of branches) {
      expect(ROUND2.filter((id) => TALENTS[id].branch === b)).toHaveLength(2);
    }
    for (const id of ROUND2) expect(TALENTS[id].capstone).toBeFalsy();
  });

  it('deep cards stay out of the draft until their branch capstone is taken', () => {
    const before = new Set<string>();
    const after = new Set<string>();
    for (const cls of ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'] as ClassId[]) {
      const caps = (Object.values(TALENTS) as { id: TalentId; cls?: ClassId; capstone?: boolean; branch: string }[])
        .filter((d) => d.cls === cls && d.capstone);
      // One capstone from each branch.
      const taken: Partial<Record<TalentId, number>> = {};
      const seenBranch = new Set<string>();
      for (const c of caps) if (!seenBranch.has(c.branch)) { seenBranch.add(c.branch); taken[c.id] = 1; }
      for (let s = 1; s <= 60; s++) {
        const w = new World({ seed: s, cls, tier: 4, omens: [] });
        for (const o of w.rollDraft()) before.add(o.id);
        (w as unknown as Inner).talents = { ...taken };
        for (const o of w.rollDraft()) after.add(o.id);
      }
    }
    expect(ROUND2.filter((id) => before.has(id))).toEqual([]);
    expect(ROUND2.filter((id) => !after.has(id))).toEqual([]);
    for (const id of ROUND2) expect(TALENTS[id].deep).toBe(true);
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
    expect(inner.regen).toBeCloseTo(8);
  });

  it('Broad Shoulders: Shield Sweep swings more often', () => {
    const { inner } = world('bulwark');
    const base = inner.sweepCooldown;
    inner.talents = { broadShoulders: 3 };
    expect(inner.sweepCooldown).toBeCloseTo(base / 1.24);
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
    expect(inner.healPlayer(20)).toBeCloseTo(plain * 1.3);
  });

  it('Steady Halo and Slag Scales cut every hit', () => {
    expect(hitTaken('lumen', { steadyHalo: 2 })).toBeLessThan(hitTaken('lumen', {}));
    expect(hitTaken('slagbinder', { slagScales: 3 })).toBeLessThan(hitTaken('slagbinder', {}));
  });

  it('Soot Cloak and Low Stance cut every hit', () => {
    expect(hitTaken('emberwright', { sootCloak: 3 })).toBeLessThan(hitTaken('emberwright', {}));
    expect(hitTaken('duskblade', { lowStance: 3 })).toBeLessThan(hitTaken('duskblade', {}));
  });

  it('Fast Fuse: Combustion recharges sooner', () => {
    const { inner } = world('emberwright');
    const base = inner.baseCooldown(2);
    inner.talents = { fastFuse: 2 };
    expect(inner.baseCooldown(2)).toBeCloseTo(base - 4);
  });

  it('Light Grip and Slow Drip: faster swings, harder bleeds', () => {
    const { inner } = world('duskblade');
    const i = inner as unknown as { swingCooldown: number; bleedMult: number };
    const cd = i.swingCooldown;
    const bleed = i.bleedMult;
    inner.talents = { lightGrip: 3, slowDrip: 3 };
    expect(i.swingCooldown).toBeCloseTo(cd / 1.15);
    expect(i.bleedMult).toBeCloseTo(bleed * 1.3);
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
