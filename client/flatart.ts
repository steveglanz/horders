/**
 * The flat debug view for QA (?flat=1). Every texture the scene uses is drawn as a plain flat shape instead of its
 * art: characters are solid discs in a colour of their own with a dark outline and a facing notch (no letters: the
 * scene mirrors sprites that face left), effects are plain white shapes (the scene tints them), props are flat discs
 * and lights are faint. Telegraphs, rings, walls and the HUD draw as always. The 3D look never loads.
 *
 * Why: browser QA (tools/playdriver.cjs, the AI playtest panel, the *shots.cjs checks) can't run the 3D look at speed
 * in a cloud container (about 8 to 10 times slower than real time), and the vision v2 plan retires the 2D art
 * (textures.ts). This view needs none of that art, so QA keeps a fast browser run after the 2D look is gone
 * (redteam.md point 7). It is a debug URL parameter like ?god or ?seed: no setting or button shows it, so players
 * never see it, and the native app can't pass it. A corner badge marks every screenshot taken in it.
 *
 * When the 2D art is deleted, keep textures.ts's make()/sheet() calls (key, size, frames) and drop their draw
 * functions: these flat shapes then stand in for every key.
 */

/** On for this page load when the URL has ?flat=1. */
export const FLAT = typeof location !== 'undefined' && new URLSearchParams(location.search).get('flat') === '1';

type Ctx = CanvasRenderingContext2D;

const INK = 'rgba(10,6,6,0.95)';

/** A steady colour per key, so each foe kind keeps its own flat colour across runs. */
export function flatColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 45%, 52%)`;
}

/** Plain white shapes the scene tints or blends: particles, hit stars, rings, beams. */
const EFFECT = new Set(['trailMote', 'frostFlake', 'oilDrop', 'woodChip', 'coalCrumb', 'plateShard', 'orb', 'ember', 'burn', 'blast', 'spark', 'hitstar', 'puff', 'gem', 'driftEmber', 'steam']);
/** Soft light pools and auras: kept faint so they never hide what stands in them. */
const LIGHT = /glow|Glow|Light|aura/;

/** A character or animated prop frame (faced right, like the art): a disc, an outline, a facing notch. */
export function flatSheet(ctx: Ctx, key: string, s: number): void {
  const c = s / 2;
  const r = s * 0.4;
  ctx.fillStyle = flatColor(key);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s / 24);
  ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Facing: a dark wedge on the right edge (the scene flips sprites to face left).
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.moveTo(c + r * 0.55, c - r * 0.3); ctx.lineTo(c + r * 1.0, c); ctx.lineTo(c + r * 0.55, c + r * 0.3); ctx.closePath(); ctx.fill();
}

/** A still texture. */
export function flatMake(ctx: Ctx, key: string, s: number): void {
  const c = s / 2;
  if (key === 'ground') {
    // Flat floor with a faint 64-unit grid, so movement still reads.
    ctx.fillStyle = '#1b1512';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < s; x += 64) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, s); ctx.stroke(); }
    for (let y = 0; y < s; y += 64) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(s, y + 0.5); ctx.stroke(); }
    return;
  }
  if (key === 'beam' || key === 'lavaTile' || key === 'water') {
    ctx.fillStyle = key === 'beam' ? '#ffffff' : key === 'lavaTile' ? '#c0401c' : '#2c5a7a';
    ctx.fillRect(0, 0, s, s);
    return;
  }
  if (key === 'ring') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s / 16;
    ctx.beginPath(); ctx.arc(c, c, c - s / 16, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  if (key === 'shadow') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.beginPath(); ctx.arc(c, c, c * 0.92, 0, Math.PI * 2);
  if (EFFECT.has(key)) { ctx.fillStyle = '#ffffff'; ctx.fill(); return; }
  if (LIGHT.test(key)) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); return; }
  // Props, stones, vents, rafts, marks: a flat disc in the key's colour with an outline.
  ctx.fillStyle = flatColor(key);
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, s / 40);
  ctx.stroke();
}

/** The badge that marks the flat view on screen (and so in every screenshot). */
export function showFlatBadge(): void {
  if (!FLAT || document.getElementById('flatBadge')) return;
  const b = document.createElement('div');
  b.id = 'flatBadge';
  b.textContent = 'FLAT QA VIEW';
  b.style.cssText = 'position:fixed;left:50%;bottom:2px;transform:translateX(-50%);z-index:9999;pointer-events:none;'
    + 'font:bold 10px sans-serif;letter-spacing:1px;color:#fff;background:rgba(200,0,120,0.75);padding:1px 6px;border-radius:3px;';
  document.body.appendChild(b);
}
