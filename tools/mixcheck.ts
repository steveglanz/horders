// Phone-speaker check: how much of each sound survives a speaker that rolls
// off below ~350 Hz. Prints the RMS kept after a 350 Hz high-pass vs the full RMS.
import { render } from '../client/audio/synth';
import { SOUNDS } from '../client/audio/sounds';
export function phoneShare(s: Float32Array, rate: number, cut = 350): number {
  // Two cascaded one-pole high-passes (12 dB/oct), a rough small-speaker model.
  const k = Math.exp((-2 * Math.PI * cut) / rate);
  let a1 = 0, i1 = 0, a2 = 0, i2 = 0, full = 0, kept = 0;
  for (const x of s) {
    a1 = k * (a1 + x - i1); i1 = x;
    a2 = k * (a2 + a1 - i2); i2 = a1;
    full += x * x; kept += a2 * a2;
  }
  return Math.sqrt(kept / Math.max(1e-12, full));
}
if (process.env.MIX) {
  const rows = Object.entries(SOUNDS).map(([id, r]) => [id, phoneShare(render(r, 32000), 32000)] as const).sort((a, b) => a[1] - b[1]);
  for (const [id, v] of rows) console.log(id.padEnd(16), (v * 100).toFixed(0) + '%');
}
