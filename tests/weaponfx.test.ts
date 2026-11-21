import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { makeItem } from '../sim/hero';
import { Rng } from '../sim/rng';
import { WEAPON_FX, WeaponFxId } from '../sim/content/items';
import { ClassId } from '../sim/content/emberwright';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  swing(t: number): void;
  shieldSweep(t: number): void;
  sunmote(t: number): void;
  fireVolley(): void;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  rebuildHash(): void;
};

function world(cls: ClassId, fx?: WeaponFxId): { w: World; inner: Inner } {
  // The same weapon either way, so only the effect differs.
  const it = makeItem(new Rng(1), 'w1', 'weapon', 'epic', 10, cls);
  if (fx) it.weaponFx = fx;
  else delete it.weaponFx;
  const gear = [it];
  const w = new World({ seed: 5, cls, tier: 4, omens: [], gear });
  for (const e of w.enemies) e.alive = false;
  return { w, inner: w as unknown as Inner };
}

describe('class weapon effects (R4)', () => {
  it('only Epic and Mythic weapons of a class roll one of its own two effects', () => {
    const rng = new Rng(3);
    for (let k = 0; k < 40; k++) {
      const epic = makeItem(rng, `i${k}`, 'weapon', 'epic', 10, 'duskblade');
      expect(WEAPON_FX[epic.weaponFx!].cls).toBe('duskblade');
      expect(makeItem(rng, `r${k}`, 'weapon', 'rare', 10, 'duskblade').weaponFx).toBeUndefined();
      expect(makeItem(rng, `h${k}`, 'head', 'epic', 10, 'duskblade').weaponFx).toBeUndefined();
    }
    // Both effects show up, picked from the item id.
    const seen = new Set([0, 1, 2, 3].map((k) => makeItem(new Rng(1), `i${k}`, 'weapon', 'epic', 10, 'lumen').weaponFx));
    expect(seen.size).toBe(2);
    // Rolling the effect doesn't use the RNG, so every other roll is unchanged.
    const a = new Rng(8); const b = new Rng(8);
    makeItem(a, 'i1', 'weapon', 'epic', 10, 'bulwark');
    makeItem(b, 'i1', 'weapon', 'epic', 10);
    expect(a.next()).toBe(b.next());
  });

  it('Cast-Cutter swings hit a casting foe 50% harder', () => {
    const hit = (fx?: WeaponFxId) => {
      const { w, inner } = world('duskblade', fx);
      const i = inner.spawn('cinderBrute', w.player.x + 50, w.player.y);
      inner.startCast(i, 'x', 'X', 3, true);
      const e = w.enemies[i];
      const hp = e.hp;
      w.loadout.critBonus = -1;
      inner.rebuildHash();
      inner.swing(i);
      return hp - e.hp;
    };
    expect(hit('castCutter')).toBeCloseTo(hit() * 1.35, 0);
  });

  it('Worrying Edge stacks on the same target', () => {
    const { w, inner } = world('duskblade', 'worryingEdge');
    const i = inner.spawn('cinderBrute', w.player.x + 50, w.player.y);
    inner.rebuildHash();
    for (let k = 0; k < 7; k++) inner.swing(i);
    expect(w.player.worryN).toBe(5);
    const j = inner.spawn('cinderBrute', w.player.x - 50, w.player.y);
    inner.rebuildHash();
    inner.swing(j);
    expect(w.player.worryN).toBe(0);
  });

  it('Rallying Sweep and Warding Sweep', () => {
    const rally = world('bulwark', 'rallyingSweep');
    const p = rally.w.player;
    const ids = [0, 1, 2, 3, 4, 5].map((k) => rally.inner.spawn('ashling', p.x + 40, p.y + (k - 2.5) * 12));
    for (const i of ids) rally.w.enemies[i].hp = 1e6;
    p.heat = 0;
    rally.inner.rebuildHash();
    rally.inner.shieldSweep(ids[0]);
    expect(p.heat).toBeCloseTo(12 + 2 * 5, 5);

    const ward = world('bulwark', 'wardingSweep');
    const q = ward.w.player;
    q.ward = 0;
    const b = ward.inner.spawn('cinderBrute', q.x + 50, q.y);
    ward.inner.rebuildHash();
    ward.inner.shieldSweep(b);
    expect(q.ward).toBeCloseTo(q.maxHp * 0.015, 5);
  });

  it('Piercing Cinders orbs carry one pass-through, Banked Flame makes every 5th orb big', () => {
    const { w, inner } = world('emberwright', 'piercingCinders');
    inner.spawn('cinderBrute', w.player.x + 100, w.player.y);
    inner.rebuildHash();
    inner.fireVolley();
    expect(w.orbs.filter((o) => o.alive).every((o) => o.pierce === 1)).toBe(true);

    const bf = world('emberwright', 'bankedFlame');
    bf.inner.spawn('cinderBrute', bf.w.player.x + 100, bf.w.player.y);
    bf.inner.rebuildHash();
    for (let k = 0; k < 5; k++) bf.inner.fireVolley();
    const dmgs = bf.w.orbs.filter((o) => o.alive).map((o) => o.dmg);
    const lo = Math.min(...dmgs);
    expect(dmgs.filter((d) => d > lo * 2).length).toBe(Math.floor(dmgs.length / 5));
  });

  it('Tender Light doubles the Sunmote heal below half health; Rebuking Light hits casters harder', () => {
    const heal = (fx: WeaponFxId | undefined, share: number) => {
      const { w, inner } = world('lumen', fx);
      const t = inner.spawn('cinderBrute', w.player.x + 200, w.player.y);
      w.player.hp = w.player.maxHp * share;
      const hp = w.player.hp;
      inner.rebuildHash();
      inner.sunmote(t);
      return w.player.hp - hp;
    };
    expect(heal('tenderLight', 0.3)).toBeCloseTo(heal(undefined, 0.3) * 2, 5);
    expect(heal('tenderLight', 0.8)).toBeCloseTo(heal(undefined, 0.8), 5);

    const dmg = (fx?: WeaponFxId) => {
      const { w, inner } = world('lumen', fx);
      const t = inner.spawn('cinderBrute', w.player.x + 200, w.player.y);
      inner.startCast(t, 'x', 'X', 3, true);
      w.loadout.critBonus = -1;
      const hp = w.enemies[t].hp;
      inner.rebuildHash();
      inner.sunmote(t);
      return hp - w.enemies[t].hp;
    };
    expect(dmg('rebukingLight')).toBeCloseTo(dmg() * 1.25, 0);
  });
});
