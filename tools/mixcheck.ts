// Phone-speaker check: how much of each sound survives a speaker that rolls
// off below ~350 Hz. Prints the RMS kept after a 350 Hz high-pass vs the full RMS.
import { render } from '../client/audio/synth';
import { SOUNDS } from '../client/audio/sounds';
import { readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
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
// Themes, recorded in a browser by tools/themecheck.cjs (needs ffmpeg). Every theme should keep at least 25% too.
if (process.env.THEMES_DIR) {
  const dir = process.env.THEMES_DIR;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.webm')).sort()) {
    const raw = execSync(`ffmpeg -loglevel error -i "${dir}/${f}" -ac 1 -ar 22050 -f f32le -`, { maxBuffer: 1 << 28 });
    const s = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    console.log(f.replace('.webm', '').padEnd(16), (phoneShare(s, 22050) * 100).toFixed(0) + '%');
  }
}
