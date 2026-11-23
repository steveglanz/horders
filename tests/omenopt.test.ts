import { describe, expect, it } from 'vitest';
import { toolOmens } from '../tools/omenopt';
import { omensFor, weekOf } from '../sim/content/omens';

describe('balance tools: OMENS picks the Omens a tool run plays with', () => {
  it('defaults to none, as the tools always did', () => {
    expect(toolOmens(13, 1, {})).toEqual([]);
    expect(toolOmens(13, 1, { OMENS: 'none' })).toEqual([]);
  });

  it('client: what a normal delve gets, this week or WEEK=n; three from tier 10', () => {
    expect(toolOmens(13, 1, { OMENS: 'client', WEEK: '7' })).toEqual(omensFor(13, 7));
    expect(toolOmens(13, 1, { OMENS: 'client', WEEK: '7' })).toHaveLength(3);
    expect(toolOmens(4, 1, { OMENS: 'client' })).toEqual(omensFor(4, weekOf(Date.now())));
  });

  it('rotate: each seed plays a different week', () => {
    expect(toolOmens(10, 5, { OMENS: 'rotate' })).toEqual(omensFor(10, 5));
    const weeks = new Set(Array.from({ length: 12 }, (_, s) => toolOmens(10, s, { OMENS: 'rotate' }).join()));
    expect(weeks.size).toBeGreaterThan(1);
  });

  it('a list plays exactly those, and an unknown id is an error', () => {
    expect(toolOmens(10, 1, { OMENS: 'quickened,warded' })).toEqual(['quickened', 'warded']);
    expect(() => toolOmens(10, 1, { OMENS: 'quickend' })).toThrow(/unknown Omen quickend/);
  });
});
