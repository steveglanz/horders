import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { BOT_CHANGE, BOT_PRIORITY, botChoose } from '../sim/bot';
import { SPARKS, TALENTS, TalentId, isChangeSpark } from '../sim/content/emberwright';
import type { ClassId } from '../sim/content/emberwright';
import { CLASSES } from '../sim/content/classes';

const ALL: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];
type Inner = { talents: Partial<Record<TalentId, number>> };

describe('1.0 CP2 Sparks (8 per class, 3 that change how you play)', () => {
  it('each class has 5 plain and 3 play-changing Sparks of its own, all in BOT_PRIORITY and BOT_CHANGE', () => {
    for (const cls of ALL) {
      const { plain, change } = SPARKS[cls];
      expect(plain).toHaveLength(5);
      expect(change).toHaveLength(3);
      for (const id of [...plain, ...change]) {
        expect(TALENTS[id].cls).toBe(cls);
        expect(BOT_PRIORITY).toContain(id);
      }
      for (const id of change) {
        expect(TALENTS[id].capstone).toBe(true);
        expect(TALENTS[id].maxRank).toBe(1);
        expect(isChangeSpark(id)).toBe(true);
      }
      for (const id of plain) expect(isChangeSpark(id)).toBe(false);
      expect([...BOT_CHANGE[cls]].sort()).toEqual([...change].sort());
    }
  });

  it('a draft offers only Sparks (or the fallbacks), at most one of them play-changing', () => {
    for (const cls of ALL) {
      const mine = new Set<string>([...SPARKS[cls].plain, ...SPARKS[cls].change, 'stoke', 'smallHeal']);
      for (let s = 1; s <= 30; s++) {
        const ids = new World({ seed: s, cls, tier: 4, omens: [] }).rollDraft().map((o) => o.id);
        expect(ids).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
        for (const id of ids) expect(mine.has(id), `${cls} ${id}`).toBe(true);
        expect(ids.filter(isChangeSpark)).toHaveLength(1);
      }
    }
  });

  it('once every plain Spark is maxed, the draft falls back to Stoke the Flame and Warm Hearth', () => {
    const w = new World({ seed: 4, cls: 'bulwark', tier: 4, omens: [] });
    const t: Partial<Record<TalentId, number>> = { warpath: 1 };
    for (const id of SPARKS.bulwark.plain) t[id] = TALENTS[id].maxRank;
    (w as unknown as Inner).talents = t;
    expect(w.rollDraft().map((o) => o.id).sort()).toEqual(['smallHeal', 'stoke']);
  });

  it('the bot passes on a play-changer that is not its best for up to BOT_CHANGE_WAIT picks, then takes it', () => {
    // Find a seed whose first draft shows the Bulwark a changer other than Warpath.
    let seed = 1;
    while (new World({ seed, cls: 'bulwark', tier: 4, omens: [] }).rollDraft().some((o) => o.id === 'warpath')) seed++;
    const w = new World({ seed, cls: 'bulwark', tier: 4, omens: [] });
    w.choices = w.rollDraft();
    const pick = w.choices[botChoose(w)].id;
    expect(isChangeSpark(pick)).toBe(false);
    // Two picks in, it takes whatever changer is shown.
    (w as unknown as Inner).talents = { holdTheLine: 1, ward: 1 };
    w.choices = w.rollDraft();
    expect(isChangeSpark(w.choices[botChoose(w)].id)).toBe(true);
  });

  it('F says what it is: interrupt classes kick, the Lumen and Slagbinder stun', () => {
    expect(ALL.filter((c) => CLASSES[c].kick)).toEqual(['emberwright', 'duskblade', 'bulwark']);
  });
});
