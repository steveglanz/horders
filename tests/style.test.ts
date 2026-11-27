import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCENTS, ANIM, CAMERA, CLOTH, MASTER, MIN_WARNING_SEC, PALETTE_ALL, PALETTE_ONLY_MARK, RARITY_COLOR, SIGNAL,
  SIGNAL_CLEARANCE, SIZE, WORLD_NON_SIGNAL, offPalette, pxPerUnit,
} from '../client/style';
import { RARITY } from '../sim/content/items';

// sRGB hex -> CIE Lab (D65), and the CIE76 difference, as tests/season.test.ts uses for season colours.
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
function lab([r, g, b]: number[]): number[] {
  const [R, G, B] = [r, g, b].map(lin);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = (a: string, b: string) => Math.hypot(...lab(rgb(a)).map((v, i) => v - lab(rgb(b))[i]));
// Colour-blind views (Machado et al. 2009, severity 1.0), applied in linear RGB.
const CVD: Record<string, number[][]> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
function seen(h: string, m: number[][]): string {
  const l = rgb(h).map(lin);
  const enc = (c: number) => { const v = Math.min(1, Math.max(0, c)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };
  return '#' + m.map((row) => Math.round(enc(row[0] * l[0] + row[1] * l[1] + row[2] * l[2]) * 255).toString(16).padStart(2, '0')).join('');
}
const HEX = /^#[0-9a-f]{6}$/;

describe('style.ts master palette (1.0 CP1, pillar 5)', () => {
  it('has exactly 24 distinct, valid lower-case colours', () => {
    const all = Object.values(MASTER).flat();
    expect(all).toHaveLength(24);
    for (const c of all) expect(c).toMatch(HEX);
    expect(new Set(all).size).toBe(24);
  });

  it('every accent, cloth and rarity colour is a valid hex and none repeats a master colour by accident', () => {
    for (const c of [...Object.values(ACCENTS).flat(), ...Object.values(CLOTH), ...Object.values(RARITY_COLOR)]) expect(c).toMatch(HEX);
    const master = new Set<string>(Object.values(MASTER).flat());
    for (const c of Object.values(ACCENTS).flat()) expect(master.has(c)).toBe(false);
  });

  it('each place has exactly two accents, and they are told apart (>= 20 dE)', () => {
    for (const [a, b] of Object.values(ACCENTS)) expect(dE(a, b)).toBeGreaterThanOrEqual(20);
  });

  it('each group runs dark to light, so a 3-step toon ramp can pick neighbours', () => {
    for (const g of ['soot', 'clay', 'iron', 'fire'] as const) {
      const L = MASTER[g].map((c) => lab(rgb(c))[0]);
      for (let i = 1; i < L.length; i++) expect(L[i]).toBeGreaterThan(L[i - 1]);
    }
  });

  it('the five class cloths are told apart from each other (>= 20 dE)', () => {
    const c = Object.values(CLOTH);
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) expect(dE(c[i], c[j])).toBeGreaterThanOrEqual(20);
  });

  it('rarity colours match the game (sim/content/items.ts RARITY)', () => {
    for (const [k, v] of Object.entries(RARITY_COLOR)) expect(RARITY[k as keyof typeof RARITY].color.toLowerCase()).toBe(v);
    expect(Object.keys(RARITY_COLOR).sort()).toEqual(Object.keys(RARITY).sort());
  });
});

describe('style.ts signals (pillar 2: read it, answer it)', () => {
  const sig = Object.values(SIGNAL);

  it('four reserved signals, each with its own colour and its own shape', () => {
    expect(sig.map((s) => s.color)).toEqual([...MASTER.signal]);
    expect(new Set(sig.map((s) => s.shape)).size).toBe(4);
  });

  it('signals are far apart from each other (>= 40 dE) in normal vision', () => {
    for (let i = 0; i < sig.length; i++) for (let j = i + 1; j < sig.length; j++) expect(dE(sig[i].color, sig[j].color)).toBeGreaterThanOrEqual(40);
  });

  it(`no other in-world colour sits within ${SIGNAL_CLEARANCE} dE of a signal`, () => {
    for (const s of sig) for (const c of WORLD_NON_SIGNAL) expect(dE(s.color, c), `${c} vs ${s.color}`).toBeGreaterThanOrEqual(SIGNAL_CLEARANCE);
  });

  it('Danger stays clear of every fire colour, so a threat never reads as a lit brazier (>= 30 dE)', () => {
    for (const f of MASTER.fire) expect(dE(SIGNAL.danger.color, f)).toBeGreaterThanOrEqual(30);
  });

  it('colour-blind views: every signal pair stays >= 15 dE apart; shape carries the closest pairs', () => {
    // Measured 27 Nov: weakest pairs are tritan Interrupt/Ally 19.9 and protan Stand/Ally 21.4 (both look
    // alike in hue), so those signals must never drop their shapes (chevrons vs plain ring vs cracks).
    for (const m of Object.values(CVD)) for (let i = 0; i < sig.length; i++) for (let j = i + 1; j < sig.length; j++) {
      expect(dE(seen(sig[i].color, m), seen(sig[j].color, m))).toBeGreaterThanOrEqual(15);
    }
  });

  it('telegraphs warn for at least 0.8 s', () => {
    expect(MIN_WARNING_SEC).toBeGreaterThanOrEqual(0.8);
  });
});

describe('style.ts sizes and animation spec', () => {
  it('hero height lands in the 70-80 px target on the reference phone', () => {
    const px = SIZE.heroUnits * pxPerUnit();
    expect(px).toBeGreaterThanOrEqual(SIZE.heroPx[0]);
    expect(px).toBeLessThanOrEqual(SIZE.heroPx[1]);
    expect(CAMERA.refWidthPx).toBe(390);
  });

  it('a boss at 3x hero height is at least a third of the screen width', () => {
    expect(SIZE.heroUnits * SIZE.bossHeroScale[0] * pxPerUnit()).toBeGreaterThanOrEqual(CAMERA.refWidthPx * SIZE.bossMinScreenFrac);
  });

  it('hit flash is 60-80 ms and in a non-signal colour; clay foes shatter into 6-10 shards', () => {
    expect(ANIM.hit.flashSec[0]).toBeGreaterThanOrEqual(0.06);
    expect(ANIM.hit.flashSec[1]).toBeLessThanOrEqual(0.08);
    expect(MASTER.signal as readonly string[]).not.toContain(ANIM.hit.flashColor);
    expect(ANIM.die.shards).toEqual([6, 10]);
  });
});

describe('palette-only files', () => {
  it('offPalette finds off-palette colours and ignores palette ones and PR numbers', () => {
    expect(offPalette(`const a = '#FF2D6F'; const b = 0x120d0b; // see #844`)).toEqual([]);
    expect(offPalette(`const a = '#ff3b3b', b = 0x123456;`)).toEqual(['#ff3b3b', '#123456']);
  });

  it(`every file starting with "${PALETTE_ONLY_MARK}" uses only style.ts colours`, () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      if (f === 'vendor' || f === 'node_modules') return [];
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|js|cjs|css|html)$/.test(f) ? [p] : [];
    });
    for (const f of [...walk('client'), ...walk('sim')]) {
      const text = readFileSync(f, 'utf8');
      if (!text.startsWith(PALETTE_ONLY_MARK)) continue;
      expect(offPalette(text), f).toEqual([]);
    }
    expect(PALETTE_ALL.size).toBeGreaterThan(24);
  });
});
