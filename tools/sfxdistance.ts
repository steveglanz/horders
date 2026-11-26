/**
 * How different two short sound effects sound on a phone: the distance between their colour (energy share per band
 * above 150 Hz, the part a phone plays) plus the distance between their loudness shapes (RMS per 40 ms, normalised to
 * the louder peak, over the longer sound). Either a different colour or a different shape tells two sounds apart.
 */
const CUTS = [150, 400, 1000, 2500, 6000];

export function sfxProfile(x: Float32Array, rate: number): number[] {
  const lows = CUTS.map(() => 0), e = new Array(CUTS.length).fill(0);
  const a = CUTS.map((c) => 1 - Math.exp((-2 * Math.PI * c) / rate));
  for (let i = 0; i < x.length; i++) {
    for (let k = 0; k < CUTS.length; k++) lows[k] += (x[i] - lows[k]) * a[k];
    for (let k = 1; k < CUTS.length; k++) e[k - 1] += (lows[k] - lows[k - 1]) ** 2;
    e[CUTS.length - 1] += (x[i] - lows[CUTS.length - 1]) ** 2;
  }
  const tot = e.reduce((p, q) => p + q, 0) || 1;
  return e.map((v) => v / tot);
}

export function sfxShape(x: Float32Array, rate: number): number[] {
  const w = Math.round(rate * 0.04), r: number[] = [];
  for (let i = 0; i < x.length; i += w) {
    let s = 0; const n = Math.min(w, x.length - i);
    for (let j = 0; j < n; j++) s += x[i + j] ** 2;
    r.push(Math.sqrt(s / n));
  }
  return r;
}

export function soundDistance(a: Float32Array, b: Float32Array, rate: number): number {
  const pa = sfxProfile(a, rate), pb = sfxProfile(b, rate);
  const colour = Math.sqrt(pa.reduce((s, v, k) => s + (v - pb[k]) ** 2, 0));
  const sa = sfxShape(a, rate), sb = sfxShape(b, rate);
  const n = Math.max(sa.length, sb.length), m = Math.max(...sa, ...sb) || 1;
  let d = 0;
  for (let i = 0; i < n; i++) d += ((sa[i] ?? 0) - (sb[i] ?? 0)) ** 2;
  const shape = Math.sqrt(d / n) / m;
  return colour + shape;
}
