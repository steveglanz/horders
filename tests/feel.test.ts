// CP2 feel kit (client/feel.ts): the table stays inside the vision's ranges, numbers never wear a signal colour,
// and the size rules hold.
import { describe, expect, it } from 'vitest';
import { FEEL, HEAVY_X, HitScale, applyFeelParams, hitSize, killSize, knockCurve, BUZZ_INTERRUPT } from '../client/feel';
import { BUZZ } from '../client/audio/haptics';
import { SIGNAL, SIGNAL_CLEARANCE } from '../client/style';

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function lab([r, g, b]: number[]): number[] {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = (a: string, b: string) => Math.hypot(...lab(rgb(a)).map((v, i) => v - lab(rgb(b))[i]));

describe('feel kit table', () => {
  it('every hit you land flashes 60 to 80 ms (vision section 3)', () => {
    for (const s of ['tap', 'crit', 'heavy'] as const) {
      expect(FEEL[s].flashMs).toBeGreaterThanOrEqual(60);
      expect(FEEL[s].flashMs).toBeLessThanOrEqual(80);
    }
  });
  it('a heavy hit stops 40 to 90 ms; ordinary hits and crits never stop', () => {
    expect(FEEL.heavy.stopMs).toBeGreaterThanOrEqual(40);
    expect(FEEL.heavy.stopMs).toBeLessThanOrEqual(90);
    expect(FEEL.tap.stopMs).toBe(0);
    expect(FEEL.crit.stopMs).toBe(0);
  });
  it('bigger hits push, shake and show more, never less', () => {
    const order = ['tap', 'crit', 'heavy'] as const;
    for (let i = 1; i < order.length; i++) {
      const a = FEEL[order[i - 1]], b = FEEL[order[i]];
      expect(b.knock).toBeGreaterThanOrEqual(a.knock);
      expect(b.shake).toBeGreaterThanOrEqual(a.shake);
      expect(b.num!.size).toBeGreaterThanOrEqual(a.num!.size);
    }
  });
  it('damage numbers are small and far from every signal colour', () => {
    for (const f of Object.values(FEEL)) {
      if (!f.num) continue;
      expect(f.num.size).toBeLessThanOrEqual(18);
      for (const s of Object.values(SIGNAL)) expect(dE(f.num.color, s.color), `${f.num.color} vs ${s.color}`).toBeGreaterThanOrEqual(SIGNAL_CLEARANCE);
    }
  });
  it('kills leave shards, more for bigger foes', () => {
    expect(FEEL.kill.shards).toBeGreaterThan(0);
    expect(FEEL.bigKill.shards).toBeGreaterThan(FEEL.kill.shards);
    expect(FEEL.bossKill.shards).toBeGreaterThan(FEEL.bigKill.shards);
  });
  it('haptics read the same table: hurt light, big hurt heavier, the interrupt a pattern', () => {
    expect(BUZZ.hurt).toBe(FEEL.hurt.buzz);
    expect(BUZZ.hurtBig).toBe(FEEL.hurtBig.buzz);
    expect(BUZZ.interrupt).toBe(BUZZ_INTERRUPT);
    expect(BUZZ_INTERRUPT.length).toBeGreaterThan(1);
    const len = (p: number[] | null) => (p ?? []).reduce((a, b) => a + b, 0);
    expect(len(FEEL.hurtBig.buzz)).toBeGreaterThan(len(FEEL.hurt.buzz));
    expect(len(FEEL.tap.buzz)).toBeLessThan(len(FEEL.hurt.buzz));
  });
});

describe('feel kit sizes', () => {
  it('a hit is a tap unless it crits; a crit HEAVY_X times your average is heavy', () => {
    expect(hitSize(500, false, 10)).toBe('tap');
    expect(hitSize(15, true, 10)).toBe('crit');
    expect(hitSize(10 * HEAVY_X, true, 10)).toBe('heavy');
    expect(hitSize(999, true, 0)).toBe('crit'); // no average yet
  });
  it('HitScale keeps "heavy" relative to your own hits, so high tiers do not stop on every crit', () => {
    const lo = new HitScale(), hi = new HitScale();
    for (let k = 0; k < 20; k++) { lo.size(20, false); hi.size(2000, false); }
    expect(lo.size(60, true)).toBe('heavy');
    expect(hi.size(60, true)).toBe('crit');
    expect(hi.size(6000, true)).toBe('heavy');
  });
  it('kills by rank: bosses, then rares and the Cinder Brute, then the rest', () => {
    expect(killSize('boss', 'kilnMother')).toBe('bossKill');
    expect(killSize('rare', 'x')).toBe('bigKill');
    expect(killSize('elite', 'cinderBrute')).toBe('bigKill');
    expect(killSize('elite', 'husk')).toBe('kill');
    expect(killSize('normal', 'ashling')).toBe('kill');
  });
  it('the push goes out fast and comes all the way back', () => {
    expect(knockCurve(0)).toBe(0);
    expect(knockCurve(0.25)).toBeCloseTo(1);
    expect(knockCurve(0.6)).toBeLessThan(1);
    expect(knockCurve(1)).toBe(0);
  });
  it('?feelstop tries another heavy stop, clamped to 0 to 150 ms', () => {
    const was = FEEL.heavy.stopMs;
    applyFeelParams('?feelstop=85'); expect(FEEL.heavy.stopMs).toBe(85);
    applyFeelParams('?feelstop=900'); expect(FEEL.heavy.stopMs).toBe(150);
    applyFeelParams('?seed=3'); expect(FEEL.heavy.stopMs).toBe(150);
    FEEL.heavy.stopMs = was;
  });
});
