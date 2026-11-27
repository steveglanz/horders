// Camera rule check (vision v2 CP2): how tall your hero shows at a phone size, in a Halls room and in a corridor.
// Usage: npm run build && node tools/heroheight.cjs [distDir] [outDir]   (W=390 H=844 by default; DESK=1 for 1280x720;
// HERO=tools/heroes/hero-t4.json plays a Kiln run instead of the first-ever tutorial delve)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = process.argv[2] || 'dist';
const out = process.argv[3];
if (out) fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const vp = process.env.DESK ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: +(process.env.W || 390), height: +(process.env.H || 844) }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  const ctx = await b.newContext(vp);
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  if (process.env.HERO) await ctx.addInitScript((h) => localStorage.setItem('horders.hero.v1', h), fs.readFileSync(process.env.HERO, 'utf8'));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${process.env.SEED || 9}&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  // The opening banner, while it shows.
  await page.waitForFunction(() => window.__ember.scene()?.world?.time > 0.8 && window.__ember.scene().hd2d, null, { timeout: 120000 });
  if (out) await page.screenshot({ path: path.join(out, 'start.png') });
  await page.waitForFunction(() => window.__ember.scene()?.world?.time > 2, null, { timeout: 120000 });
  const read = (label) => page.evaluate((label) => {
    const s = window.__ember.scene(), w = s.world, v = s.hd2d;
    return { label, heroPx: v.stats().heroPx, zoomK: +(s.halls?.zoomK ?? 1).toFixed(2), screen: [innerWidth, innerHeight] };
  }, label);
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.waitForTimeout(1500);
  console.log(JSON.stringify(await read('room')));
  if (out) await page.screenshot({ path: path.join(out, 'room.png') });
  // Into the first corridor: halfway along it.
  const moved = await page.evaluate(() => {
    const s = window.__ember.scene(), w = s.world, m = w.halls; if (!m || !m.corridors.length) return false;
    const c = m.corridors[0], a = m.rooms[c.a], bb = m.rooms[c.b], p = w.player;
    p.x = p.px = (a.x + bb.x) / 2; p.y = p.py = (a.y + bb.y) / 2; s.warp = 1; return true;
  });
  if (moved) { await page.waitForTimeout(2500); await page.evaluate(() => { window.__ember.scene().warp = 0; }); await page.waitForTimeout(800); console.log(JSON.stringify(await read('corridor'))); if (out) await page.screenshot({ path: path.join(out, 'corridor.png') }); }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})();
