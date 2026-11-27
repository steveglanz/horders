// Flat debug view check (vision v2 CP2, redteam point 7): the game's own bot plays one whole delve in the browser
// in ?flat=1 (client/flatart.ts) and, for comparison, in the 2D look (?hd2d=0) and optionally 3D. Prints game seconds
// per wall second, whether the 3D look loaded, whether the end screen came up, and page errors; saves screenshots.
// Usage: npm run build && node tools/flatcheck.cjs [outDir]
//   MODES=flat,2d (default; add 3d to compare) HERO=tools/heroes/hero-t4.json (Kiln run) SEED=9 WARP=4 MAX=240 (wall s)
//   W=390 H=844 (phone) or DESK=1 (1280x720)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2];
if (out) fs.mkdirSync(out, { recursive: true });
const dist = 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  if (p === '/hd2d.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(fs.readFileSync(path.join(dist, 'hd2d.js'))); }
  if (p !== '/' && p !== '/index.html') { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(fs.readFileSync(path.join(dist, 'index.html')));
}).listen(0);
const MODES = (process.env.MODES || 'flat,2d').split(',');
const QUERY = { flat: 'flat=1', '2d': 'hd2d=0', '3d': 'hd2d=1' };
const HERO = process.env.HERO ?? 'tools/heroes/hero-t4.json';
const WARP = +(process.env.WARP || 4);
const MAX = +(process.env.MAX || 240);

async function play(b, mode) {
  const vp = process.env.DESK ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  const ctx = await b.newContext(vp);
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  if (HERO) await ctx.addInitScript((h) => localStorage.setItem('horders.hero.v1', h), fs.readFileSync(HERO, 'utf8'));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const tLoad = Date.now();
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${process.env.SEED || 9}&${QUERY[mode]}`);
  await page.waitForFunction(() => !!document.getElementById('startBtn'), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember?.scene()?.world?.time > 0, null, { timeout: 180000 });
  const loadS = (Date.now() - tLoad) / 1000;
  await page.evaluate((wp) => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = wp; }, WARP);
  const t0 = Date.now();
  const g0 = await page.evaluate(() => window.__ember.scene().world.time);
  let shot = 0, ended = false, game = g0;
  while ((Date.now() - t0) / 1000 < MAX) {
    await page.waitForTimeout(3000);
    const st = await page.evaluate(() => ({ end: !document.getElementById('end').hidden, t: window.__ember.scene()?.world?.time ?? 0 }));
    game = Math.max(game, st.t);
    if (out && shot < 3 && (Date.now() - t0) / 1000 > 8 + shot * 25) await page.screenshot({ path: path.join(out, `${mode}-${++shot}.png`) });
    if (st.end) { ended = true; break; }
  }
  const wall = (Date.now() - t0) / 1000;
  const info = await page.evaluate(() => ({
    hd2d: !!window.__ember.scene()?.hd2d,
    badge: !!document.getElementById('flatBadge'),
    title: document.getElementById('endTitle')?.textContent ?? '',
  }));
  if (out && ended) await page.screenshot({ path: path.join(out, `${mode}-end.png`) });
  console.log(JSON.stringify({ mode, loadS: +loadS.toFixed(1), gameS: +(game - g0).toFixed(1), wallS: +wall.toFixed(1), gamePerWall: +((game - g0) / wall).toFixed(2), warp: WARP, ended, endTitle: info.title, look3d: info.hd2d, badge: info.badge, errors: errs.slice(0, 5) }));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const m of MODES) await play(b, m);
  await b.close(); srv.close();
})();
