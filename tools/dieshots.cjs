// Screenshots Oskel's Die Cut (Phase 12 W2): the scene restarts into Oskel, runs until the fight is a few seconds in,
// freezes, then lays a Die Cut (the half-floor cone through him, as the sim does) and holds it early and late in its fuse.
// Usage: npm run build && node tools/dieshots.cjs <outDir> [p360]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = p360 ? 'p360' : 'desk';
  const ctx = await b.newContext(p360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await page.evaluate(() => {
    const s = window.__ember.scene();
    s.scene.restart({ opts: { seed: 5, dungeon: 'pressworks', tier: 10, invulnerable: true, cls: 'bulwark', route: ['oskel'], heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] }, hud: s.hud, onEnd: () => {} });
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; const ok = w.phase === 'fight' && w.bossIndex >= 0 && w.time > 5; if (ok) s.warp = 0; return ok; }, null, { timeout: 120000, polling: 30 }).catch(() => errs.push('timeout fight'));
  await page.evaluate(() => { const w = window.__ember.scene().world; const e = w.enemies[w.bossIndex]; w.bossVariant = 'cut'; w.addTelegraph('cone', e.x, e.y, 1120, Math.PI * 0.75, Math.PI, 2.4, 45, 'hit', -1); const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
  for (const [name, u] of [['1-early', 0.2], ['2-late', 0.85]]) {
    await page.evaluate((u) => { const w = window.__ember.scene().world; const t = w.telegraphs.find((q) => q.alive && q.shape === 'cone' && q.arc >= 3.14); if (t) t.t = t.dur * u; }, u);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-diecut-${name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
