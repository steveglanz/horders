// Halls H1 3D shots: node h1.cjs <dist> <outDir> [LAND=1]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html'); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(fs.readFileSync(path.resolve(f))); }).listen(0);
const SPOTS = (process.env.SPOTS || 'r1,r3,r5,r4').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(process.env.LAND ? { viewport: { width: 568, height: 320 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((LOOK) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full', look: LOOK })), process.env.NO3D ? '2d' : '3d');
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${process.env.SEED || 8}&god=1${process.env.NO3D ? '' : '&hd2d=1'}`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction((no3d) => window.__ember.scene()?.world?.tick > 0 && (no3d || window.__ember.scene().hd2d), !!process.env.NO3D, { timeout: 120000 });
  await page.evaluate((seed) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed, cls: 'emberwright', dungeon: 'hammerdeep', tier: 4, invulnerable: true, halls: true, hallsBeta: true }, hud: s.hud, onEnd: () => {} }); }, +(process.env.SEED || 8));
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
  const info = await page.evaluate(() => { const w = window.__ember.scene().world; return { themes: w.halls?.rooms.map((r) => r.theme).join(','), halls: !!w.halls, mirror: w.halls?.mirror, packs: w.halls?.packs.map((p) => p.role + ':' + p.enc + ':' + p.foes.length), layout: w.halls ? w.stones.length + ' stones' : '' }; });
  console.log(JSON.stringify(info));
  for (const spot of SPOTS) {
  if (process.env.THEMES) await page.evaluate((list) => {
    const w = window.__ember.scene().world, m = w.halls;
    const rooms = m.rooms.map((r, i) => ({ ...r, theme: list[i] || r.theme }));
    w.halls = { ...m, rooms }; const hv = window.__ember.scene().halls; if (hv) { hv.floorDrawn = false; hv.grates = null; }
  }, process.env.THEMES.split(','));
  if (process.env.SHAPES) await page.evaluate(() => {
    const w = window.__ember.scene().world, m = w.halls;
    const rect = (cx, cy, hw, hh) => [cx - hw, cy - hh, cx + hw, cy - hh, cx + hw, cy + hh, cx - hw, cy + hh];
    const circ = (cx, cy, r, n = 40) => { const o = []; for (let k = 0; k < n; k++) { const a = k / n * 2 * Math.PI; o.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } return o; };
    const cross = (cx, cy, half, arm) => { const a = arm / 2, h = half; return [cx - a, cy - h, cx + a, cy - h, cx + a, cy - a, cx + h, cy - a, cx + h, cy + a, cx + a, cy + a, cx + a, cy + h, cx - a, cy + h, cx - a, cy + a, cx - h, cy + a, cx - h, cy - a, cx - a, cy - a]; };
    const twin = (cx, cy, r, gap) => { const o = []; const d = r + gap / 2 - 40; const n = 28;
      // Two circles side by side east-west, joined by a 300-wide neck: trace the east circle, then the west.
      const hy = 150; const aE = Math.asin(hy / r);
      for (let k = 0; k <= n; k++) { const a = Math.PI + aE + (2 * Math.PI - 2 * aE) * k / n; o.push(cx + d + Math.cos(a) * r, cy - Math.sin(a) * r); }
      for (let k = 0; k <= n; k++) { const a = aE + (2 * Math.PI - 2 * aE) * k / n; o.push(cx - d + Math.cos(a) * r, cy - Math.sin(a) * r); }
      return o; };
    const rooms = m.rooms.map((r) => ({ ...r }));
    const R = (i, shape, edge) => { rooms[i].shape = shape; rooms[i].edge = edge; };
    const r1 = rooms[1]; R(1, 'hall', [rect(r1.x, r1.y, 250, 430)]);
    const r3 = rooms[3]; R(3, 'ring', [circ(r3.x, r3.y, 520, 48), circ(r3.x, r3.y + 60, 160, 24)]);
    const r5 = rooms[5]; R(5, 'cross', [cross(r5.x, r5.y, 450, 300)]);
    const r4 = rooms[4]; R(4, 'twin', [twin(r4.x, r4.y, 300, 300)]);
    w.halls = { ...m, rooms }; const hv = window.__ember.scene().halls; if (hv) { hv.floorDrawn = false; hv.grates = null; }
  });
  for (const _ of []) {}
    await page.evaluate((spot) => {
      const s = window.__ember.scene(); const w = s.world; const p = w.player; const m = w.halls; s.autopilot = false;
      const r = m.rooms[+spot.slice(1)];
      p.x = p.px = r.x; p.y = p.py = r.y + r.r * 0.3;
      for (const e of w.enemies) e.alive = false;
      s.warp = 0;
    }, spot);
    await page.waitForTimeout(2500);
    const st = await page.evaluate(() => window.__ember.scene().hd2d?.stats() ?? {});
    await page.screenshot({ path: path.join(out, spot + '.png') });
    console.log(spot, JSON.stringify({ calls: st.calls, tris: st.triangles }));
  }
  console.log(errs.join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
