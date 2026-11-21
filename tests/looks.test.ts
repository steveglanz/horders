import { describe, expect, it } from 'vitest';
import { cleanLooks } from '../client/net/coop';
import { GLOWS } from '../sim/content/season';

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
});
