import { describe, expect, it } from 'vitest';
import { FLAT, flatColor, flatMake, flatSheet } from '../client/flatart';

/** A canvas context that records the calls, enough for the flat shapes (vitest runs in node, no DOM canvas). */
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : (...a: unknown[]) => { calls.push(String(k)); return a; }),
    set: (t, k, v) => { t[k as string] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('flat debug view (?flat=1)', () => {
  it('is off unless the URL asks for it', () => {
    expect(FLAT).toBe(false);
  });
  it('gives each key a steady colour of its own', () => {
    expect(flatColor('cinderBrute')).toBe(flatColor('cinderBrute'));
    expect(flatColor('cinderBrute')).not.toBe(flatColor('ashling'));
    expect(flatColor('kilnMother')).toMatch(/^hsl\(\d+, 45%, 52%\)$/);
  });
  it('draws characters and stills as plain shapes, never images', () => {
    for (const key of ['player', 'kilnMother', 'ground', 'beam', 'ring', 'shadow', 'spark', 'heroGlow', 'kilnStone']) {
      const { ctx, calls } = fakeCtx();
      if (key === 'player' || key === 'kilnMother') flatSheet(ctx, key, 48);
      else flatMake(ctx, key, 64);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls).not.toContain('drawImage');
      expect(calls).not.toContain('createRadialGradient');
    }
  });
});
