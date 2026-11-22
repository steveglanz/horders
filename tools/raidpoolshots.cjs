// The trash fights that design's wider raid pools bring into the Crucible and the Hoard (riftfall, glassSpitters,
// spitterBrute, wardens, spitters), at a 360 px phone with a party of four, a few seconds in (frozen, banner hidden, the player moved just below the foes so the camera frames them).
// Usage: npm run build && node tools/raidpoolshots.cjs <outDir> [dungeon=crucible|hoard]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const dungeon = process.argv[3] || 'crucible';
const ROUTES = ['riftfall', 'glassSpitters', 'spitterBrute', 'wardens', 'spitters'];
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=4&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const r of ROUTES) {
    await page.evaluate(([d, r]) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 4, dungeon: d, tier: 9, invulnerable: true, cls: 'emberwright', route: [r], heroName: 'Emberwright 9', party: [{ cls: 'bulwark', name: 'Bulwark 9' }, { cls: 'lumen', name: 'Lumen 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] }, hud: s.hud, onEnd: () => {} }); }, [dungeon, r]);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
    await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; const ok = w.time > 5 && w.enemies.some((e) => e.alive); if (ok) { s.warp = 0; const al = w.enemies.filter((e) => e.alive); const p = w.player; p.x = p.px = al.reduce((a, e) => a + e.x, 0) / al.length; p.y = p.py = al.reduce((a, e) => a + e.y, 0) / al.length + 110; } return ok; }, null, { timeout: 40000, polling: 20 }).catch(() => errs.push('timeout ' + r));
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `p360-${dungeon}-${r}.png`) });
    const kinds = await page.evaluate(() => window.__ember.scene().world.enemies.filter((e) => e.alive).map((e) => e.kind));
    console.log(r, JSON.stringify(kinds));
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
