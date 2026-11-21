import { describe, expect, it } from 'vitest';
import { cleanLooks } from '../client/net/coop';
import { GLOWS, TRAILS } from '../sim/content/season';

describe('P6 co-op looks', () => {
  const glow = Object.keys(GLOWS)[0];

  it('keeps a plain title and a known glow', () => {
    expect(cleanLooks({ title: 'Veteran of the Long Night', glow })).toEqual({ title: 'Veteran of the Long Night', glow });
  });

  it('strips markup and caps the length of a title', () => {
    expect(cleanLooks({ title: '<img src=x onerror=alert(1)>Delver' }).title).toBe('img srcx onerroralert1Delver');
    expect(cleanLooks({ title: 'x'.repeat(80) }).title).toHaveLength(40);
  });

  it('drops unknown glows, prototype keys and non-strings', () => {
    expect(cleanLooks({ glow: 'not-a-glow' })).toEqual({});
    expect(cleanLooks({ glow: '__proto__' })).toEqual({});
    expect(cleanLooks({ glow: 'constructor' })).toEqual({});
    expect(cleanLooks({ title: 42, glow: {} })).toEqual({});
    expect(cleanLooks({ title: '   ' })).toEqual({});
    expect(cleanLooks(undefined)).toEqual({});
  });

  it('keeps a known trail and clamps its stage to a whole 1 to 3', () => {
    const id = Object.keys(TRAILS)[0];
    expect(cleanLooks({ trail: { id, stage: 2 } })).toEqual({ trail: { id, stage: 2 } });
    expect(cleanLooks({ trail: { id, stage: 9 } }).trail).toEqual({ id, stage: 3 });
    expect(cleanLooks({ trail: { id, stage: 2.7 } }).trail).toEqual({ id, stage: 2 });
  });

  it('drops unknown trails, bad stages and odd shapes', () => {
    const id = Object.keys(TRAILS)[0];
    expect(cleanLooks({ trail: { id: 'not-a-trail', stage: 1 } })).toEqual({});
    expect(cleanLooks({ trail: { id: '__proto__', stage: 1 } })).toEqual({});
    expect(cleanLooks({ trail: { id, stage: 0 } })).toEqual({});
    expect(cleanLooks({ trail: { id, stage: NaN } })).toEqual({});
    expect(cleanLooks({ trail: { id, stage: '3' } })).toEqual({});
    expect(cleanLooks({ trail: id })).toEqual({});
    expect(cleanLooks({ trail: null })).toEqual({});
  });
});
