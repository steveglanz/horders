// Makes docs/art/style/palette.png from client/style.ts (the 1.0 CP1 palette), plus colour-blind views.
// Run: node docs/art/style/shots.cjs   (needs npm ci; uses the pre-installed Playwright Chromium)
const path = require('path');
const fs = require('fs');
const os = require('os');
const esbuild = require('esbuild');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const out = path.join(os.tmpdir(), 'horders-style.cjs');
esbuild.buildSync({ entryPoints: [path.join(root, 'client/style.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out });
const S = require(out);

// Machado et al. 2009 (severity 1), linear RGB: same matrices as tests/style.test.ts.
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = (c) => { const v = Math.min(1, Math.max(0, c)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };
const seen = (h, m) => { const l = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)); return '#' + m.map((r) => Math.round(enc(r[0] * l[0] + r[1] * l[1] + r[2] * l[2]) * 255).toString(16).padStart(2, '0')).join(''); };

const sw = (c, label) => `<div class="sw"><i style="background:${c}"></i><b>${label || ''}</b><code>${c}</code></div>`;
const row = (title, cols) => `<h3>${title}</h3><div class="row">${cols.join('')}</div>`;
const shapeSvg = {
  jagged: (c) => { let d = ''; const n = 28; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, r = i % 2 ? 30 : 36; d += (i ? 'L' : 'M') + (40 + r * Math.cos(a)).toFixed(1) + ',' + (40 + r * Math.sin(a)).toFixed(1); } return `<path d="${d}Z" fill="${c}" fill-opacity=".28" stroke="${c}" stroke-width="3"/>`; },
  'chevron-ring': (c) => `<circle cx="40" cy="40" r="32" fill="none" stroke="${c}" stroke-width="4"/>` + [0, 90, 180, 270].map((a) => `<path transform="rotate(${a} 40 40)" d="M33,4 L40,14 L47,4" fill="none" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>`).join(''),
  'cracked-ring': (c) => [0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a} 40 40)" d="M${40 + 32 * Math.cos(0.1)},${40 + 32 * Math.sin(0.1)} A32,32 0 0 1 ${40 + 32 * Math.cos(1.15)},${40 + 32 * Math.sin(1.15)}" fill="none" stroke="${c}" stroke-width="5"/>`).join(''),
  'solid-ring': (c) => `<circle cx="40" cy="40" r="32" fill="none" stroke="${c}" stroke-width="3"/>`,
};
const sigRow = (view, m) => `<div class="row">${Object.entries(S.SIGNAL).map(([k, s]) => { const c = m ? seen(s.color, m) : s.color; return `<div class="sig"><svg width="80" height="80">${shapeSvg[s.shape](c)}</svg><b>${k}</b><code>${view}</code></div>`; }).join('')}</div>`;

const M = S.MASTER;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:${M.soot[0]};color:${M.hearth[1]};font:14px/1.3 system-ui,sans-serif;width:1100px}
h2{margin:0 0 4px;font:600 22px Georgia,serif}h3{margin:18px 0 6px;font:600 15px Georgia,serif;color:${M.clay[3]}}
.row{display:flex;flex-wrap:wrap;gap:10px}.sw{width:118px}.sw i{display:block;height:52px;border-radius:6px;border:1px solid ${M.soot[4]}}
.sw b{display:block;font-weight:600;margin-top:4px;font-size:12px}.sw code,.sig code{font-size:11px;opacity:.75}
.sig{width:118px;text-align:center}.sig b{display:block}.p{opacity:.8;margin:2px 0 0}
</style><h2>Horders style.ts: master palette (24) and reserved signals</h2>
<p class="p">1.0 vision v2, Checkpoint 1. Made by docs/art/style/shots.cjs from client/style.ts. Signals glow flat; nothing else may sit near them.</p>
${row('Soot: void, floors, outlines', M.soot.map((c, i) => sw(c, i === 1 ? 'outline' : '')))}
${row('Clay: the Court\'s creatures', M.clay.map((c) => sw(c)))}
${row('Iron: heroes and props', M.iron.map((c) => sw(c)))}
${row('Fire: light, embers, cracks', M.fire.map((c) => sw(c)))}
${row('Hearth: brass and bone', M.hearth.map((c, i) => sw(c, i ? 'bone' : 'brass')))}
${row('Signal (reserved)', Object.entries(S.SIGNAL).map(([k, s]) => sw(s.color, k)))}
${row('Place accents (props and glaze only)', Object.entries(S.ACCENTS).flatMap(([k, [a, b]]) => [sw(a, k), sw(b, k)]))}
${row('Class cloth (heroes only)', Object.entries(S.CLOTH).map(([k, c]) => sw(c, k)))}
${row('Rarity (UI and loot beams only)', Object.entries(S.RARITY_COLOR).map(([k, c]) => sw(c, k)))}
<h3>Signal shapes, normal vision and colour-blind views</h3>
${sigRow('normal')}${sigRow('protan', CVD.protan)}${sigRow('deutan', CVD.deutan)}${sigRow('tritan', CVD.tritan)}`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1148, height: 600 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.screenshot({ path: path.join(__dirname, 'palette.png'), fullPage: true });
  await b.close();
  console.log('wrote', path.join(__dirname, 'palette.png'));
})();
