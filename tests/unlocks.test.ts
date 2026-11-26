import { describe, expect, it } from 'vitest';
import { UNLOCK_AID, World } from '../sim/world';
import { CLASS_IDS, SLOT_UNLOCK, slotOpen } from '../sim/content/classes';
import { coachLine } from '../sim/content/firstdelve';
import { TALENTS } from '../sim/content/emberwright';
import type { ClassId } from '../sim/content/emberwright';

type Inner = { rollDraft(): void; use(i: number): void };

function world(cls: ClassId, unlockLevel?: number, party?: { cls: ClassId; unlockLevel?: number }[]): World {
  const w = new World({ seed: 5, cls, tier: 1, omens: [], unlockLevel, party });
  for (const e of w.enemies) e.alive = false;
  return w;
}

describe('ability unlocks by character level', () => {
  it('Q at 1, E at 2, R at 3, F at 4', () => {
    expect(SLOT_UNLOCK).toEqual([1, 2, 3, 4]);
    const open = (level: number | undefined) => [0, 1, 2, 3].filter((s) => slotOpen(s, level)).length;
    expect([1, 2, 3, 4, 5, 20].map(open)).toEqual([1, 2, 3, 4, 4, 4]);
    expect(open(undefined)).toBe(4);
    expect(open(0)).toBe(1);
    expect(open(Number.NaN)).toBe(1);
  });

  it('a locked slot cannot be cast, and an unlocked one can', () => {
    for (const cls of CLASS_IDS) {
      const w = world(cls, 1);
      w.player.heat = 100;
      expect(w.unlocked(0)).toBe(true);
      expect(w.canCast(0)).toBe(true);
      for (const slot of [1, 2, 3]) {
        expect(w.unlocked(slot)).toBe(false);
        expect(w.canCast(slot)).toBe(false);
      }
      const before = w.player.cds[3];
      w.step({ x: 0, y: 0, cast: 3 });
      expect(w.player.cds[3]).toBe(before);
    }
  });

  it('leaving the level out (tools, tests) keeps all 4, and levels 2 and 3 open E and R', () => {
    const all = world('emberwright');
    expect([0, 1, 2, 3].every((s) => all.unlocked(s))).toBe(true);
    const two = world('emberwright', 2);
    expect([0, 1, 2, 3].map((s) => two.unlocked(s))).toEqual([true, true, false, false]);
    const three = world('emberwright', 3);
    expect([0, 1, 2, 3].map((s) => three.unlocked(s))).toEqual([true, true, true, false]);
  });

  it('never drafts talents for a slot that is still locked', () => {
    for (const cls of CLASS_IDS) {
      const w = world(cls, 1);
      for (let n = 0; n < 40; n++) {
        (w as unknown as Inner).rollDraft();
        for (const c of w.choices) {
          const def = TALENTS[c.id as keyof typeof TALENTS];
          if (def && def.ability !== undefined) expect(def.ability).toBe(0);
        }
      }
    }
  });

  it('each party member keeps their own unlocks', () => {
    const w = world('bulwark', 4, [{ cls: 'lumen', unlockLevel: 2 }, { cls: 'duskblade' }]);
    const inner = w as unknown as Inner;
    inner.use(1);
    expect([0, 1, 2, 3].map((s) => w.unlocked(s))).toEqual([true, true, false, false]);
    inner.use(2);
    expect(w.unlocked(3)).toBe(true);
    inner.use(0);
    expect(w.unlocked(3)).toBe(true);
  });

  it('a hero with locked buttons hits harder and is hit softer, one step per locked button', () => {
    const full = world('emberwright', 4);
    const one = world('emberwright', 1);
    expect(full.lockedSlots).toBe(0);
    expect(one.lockedSlots).toBe(3);
    expect(one.dmgMult / full.dmgMult).toBeCloseTo(1 + 3 * UNLOCK_AID.dmg, 5);
    const hit = (w: World) => { const hp = w.player.hp; (w as unknown as { hurtPlayer(a: number): void }).hurtPlayer(20); return hp - w.player.hp; };
    const cut = UNLOCK_AID.cut;
    UNLOCK_AID.cut = 0;
    const plain = hit(world('emberwright', 1));
    UNLOCK_AID.cut = cut;
    expect(hit(one) / plain).toBeCloseTo(1 - 3 * cut, 2);
    expect(hit(full)).toBeGreaterThan(hit(world('emberwright', 1)));
  });

  it('the first delve teaches stepping out of the Brute\'s cast when there is no interrupt yet', () => {
    expect(coachLine('brute')).toContain('step out');
    expect(coachLine('kilnMother')).not.toContain('undefined');
    expect(coachLine('brute', 'Kick')).toContain('Kick');
  });
});
