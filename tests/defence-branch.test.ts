import { describe, expect, it } from 'vitest';
import { World, DEFENCE_BRANCH } from '../sim/world';
import { TALENTS, TalentId } from '../sim/content/emberwright';
import type { ClassId } from '../sim/content/emberwright';

type Inner = { talents: Partial<Record<TalentId, number>> };

function world(cls: ClassId): { w: World; inner: Inner } {
  const w = new World({ seed: 5, cls, tier: 4, omens: [] });
  for (const e of w.enemies) e.alive = false;
  return { w, inner: w as unknown as Inner };
}

describe('defence branches deal damage (Ashguard, Crust)', () => {
  it('Cinder Skin and Mend in Embers add damage per rank, and say so', () => {
    const { w, inner } = world('emberwright');
    const base = w.dmgMult;
    inner.talents = { cinderSkin: 2, mend: 3 };
    expect(w.dmgMult).toBeCloseTo(base * (1 + 2 * DEFENCE_BRANCH.skinDmg + 3 * DEFENCE_BRANCH.mendDmg));
    expect(TALENTS.cinderSkin.text).toContain(`+${Math.round(DEFENCE_BRANCH.skinDmg * 100)}% damage`);
    expect(TALENTS.mend.text).toContain(`+${Math.round(DEFENCE_BRANCH.mendDmg * 100)}% damage`);
  });

  it('Ring of Ash orbits wide and its tip states the burn', () => {
    const { w, inner } = world('emberwright');
    inner.talents.ringOfAsh = 1;
    for (const o of w.orbiters()) expect(Math.hypot(o.x - w.player.x, o.y - w.player.y)).toBeCloseTo(DEFENCE_BRANCH.ringR);
    expect(TALENTS.ringOfAsh.tip).toContain(`${DEFENCE_BRANCH.ringDamage} damage`);
    expect(TALENTS.ringOfAsh.tip).toContain(`${DEFENCE_BRANCH.ringR} px`);
  });

  it('Clinker Heart hits harder only while plated, and says so', () => {
    const { w, inner } = world('slagbinder');
    const p = w.player;
    const base = w.dmgMult;
    p.plate = 20;
    p.plateUntil = w.time + 5;
    expect(w.dmgMult).toBeCloseTo(base);
    inner.talents = { clinkerHeart: 1 };
    expect(w.dmgMult).toBeCloseTo(base * (1 + DEFENCE_BRANCH.clinkerDmg));
    p.plateUntil = w.time - 1;
    expect(w.dmgMult).toBeCloseTo(base);
    expect(TALENTS.clinkerHeart.text).toContain(`+${Math.round(DEFENCE_BRANCH.clinkerDmg * 100)}% damage while plated`);
  });
});

describe('more branch coverage (Forge, Grace, Wildfire)', () => {
  it('Twin Coat hits harder only while plated, and says so', () => {
    const { w, inner } = world('slagbinder');
    const p = w.player;
    const base = w.dmgMult;
    p.plate = 20;
    p.plateUntil = w.time + 5;
    inner.talents = { twinPour: 1 };
    expect(w.dmgMult).toBeCloseTo(base * (1 + DEFENCE_BRANCH.twinDmg));
    p.plateUntil = w.time - 1;
    expect(w.dmgMult).toBeCloseTo(base);
    expect(TALENTS.twinPour.text).toContain(`+${Math.round(DEFENCE_BRANCH.twinDmg * 100)}% damage while plated`);
  });

  it('Renewal, Gleam Guard and Kindled Ground add damage per rank, and say so', () => {
    const lumen = world('lumen');
    const lb = lumen.w.dmgMult;
    lumen.inner.talents = { renewal: 2, aegisOfLight: 1 };
    expect(lumen.w.dmgMult).toBeCloseTo(lb * (1 + 3 * DEFENCE_BRANCH.graceDmg));
    const ember = world('emberwright');
    const eb = ember.w.dmgMult;
    ember.inner.talents = { kindledGround: 3 };
    expect(ember.w.dmgMult).toBeCloseTo(eb * (1 + 3 * DEFENCE_BRANCH.groundDmg));
    const pct = (k: number) => `+${Math.round(k * 100)}% damage`;
    expect(TALENTS.renewal.text).toContain(pct(DEFENCE_BRANCH.graceDmg));
    expect(TALENTS.aegisOfLight.text).toContain(pct(DEFENCE_BRANCH.graceDmg));
    expect(TALENTS.kindledGround.text).toContain(pct(DEFENCE_BRANCH.groundDmg));
  });
});
