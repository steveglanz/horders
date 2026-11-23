// HD-2D test (?hd2d=1) phone check: the Kiln at 320x568 (portrait), the loading screen and the top HUD over the 3D room.
// Also checks the 3D view's project(x, y): your hero should land near the middle of the screen.
// Usage: npm run build && node tools/hd2dqa.cjs <outDir> [distDir]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const dist = process.argv[3] || 'dist';
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=9&god=1&hd2d=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForTimeout(20);
  const title = await page.evaluate(() => { const s = document.getElementById('hd2dLoad'); return s.hidden ? null : s.querySelector('.hl-title').textContent; });
  console.log('loading title:', title);
  if (title !== null) await page.screenshot({ path: path.join(out, 'p320-loading.png') });
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__ember.scene().world.time > 4, null, { timeout: 240000 });
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.waitForTimeout(1500);
  const proj = await page.evaluate(() => {
    const s = window.__ember.scene(); const w = s.world; const v = s.hd2d;
    if (!v || !v.project) return 'no project()';
    const h = w.heroes[0].player;
    return { hero: v.project(h.x, h.y), screen: [innerWidth, innerHeight], offscreenFoes: w.enemies.filter((e) => e.alive && (() => { const p = v.project(e.x, e.y); return !p || p.x < 0 || p.x > innerWidth || p.y < 0 || p.y > innerHeight; })()).length };
  });
  console.log('project:', JSON.stringify(proj));
  await page.screenshot({ path: path.join(out, 'p320-fight.png') });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})();
