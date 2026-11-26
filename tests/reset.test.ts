import { describe, expect, it } from 'vitest';
import { charactersMade, newHero, newerHero, resetCharacter, resetProgress, switchClass } from '../sim/hero';

/** A save with two classes played: Emberwright level 6 (in the roster) and Bulwark level 4 (being played). */
function twoHeroes() {
  const h = newHero();
  h.level = 6; h.runs = 9; h.xp = 50; h.maxTier = 4; h.inventory.push({ id: 'i1' } as never);
  h.embers = 300; h.titles = ['Firstborn'];
  switchClass(h, 'bulwark');
  h.level = 4; h.runs = 5; h.maxTier = 3;
  return h;
}

describe('Start over (Settings)', () => {
  it('lists every class with a character, the played one first', () => {
    const h = twoHeroes();
    expect(charactersMade(h).map((c) => [c.cls, c.level])).toEqual([['bulwark', 4], ['emberwright', 6]]);
  });

  it('resets the played class to a fresh level 1 and keeps the account and other classes', () => {
    const h = twoHeroes();
    resetCharacter(h, 'bulwark');
    expect(h.cls).toBe('bulwark');
    expect([h.level, h.runs, h.maxTier, h.inventory.length]).toEqual([1, 0, 1, 0]);
    expect(h.roster?.emberwright?.level).toBe(6);
    expect(h.embers).toBe(300);
    expect(h.titles).toEqual(['Firstborn']);
    expect(h.resets).toBe(1);
  });

  it('resets a class waiting in the roster without touching the played one', () => {
    const h = twoHeroes();
    resetCharacter(h, 'emberwright');
    expect(h.roster?.emberwright).toBeUndefined();
    expect(h.level).toBe(4);
    switchClass(h, 'emberwright');
    expect([h.level, h.runs, h.inventory.length]).toEqual([1, 0, 0]);
  });

  it('reset all gives a brand new hero that still counts the reset', () => {
    const h = twoHeroes();
    h.resets = 2;
    const n = resetProgress(h);
    expect(n).toEqual({ ...newHero(), resets: 3 });
  });

  it('a reset copy beats an older copy with more progress, so cloud sync cannot undo it', () => {
    const old = twoHeroes();
    const fresh = resetProgress(old);
    expect(newerHero(old, fresh)).toBe(fresh);
    expect(newerHero(fresh, old)).toBe(fresh);
    const one = twoHeroes();
    resetCharacter(one, 'bulwark');
    expect(newerHero(twoHeroes(), one)).toBe(one);
    // With the same reset count, progress still decides as before.
    const more = resetProgress(old); more.runs = 1;
    expect(newerHero(fresh, more)).toBe(more);
  });
});
