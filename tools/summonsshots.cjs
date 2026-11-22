// Screenshots the Furnace Regent's Summons (Phase 12 W3, court version): the scene restarts into his fight in the Flue, sets
// the court version, drops him into phase 2 and waits for a Summons, then moves the player outside the circle (so the arrow
// toward him shows) and shoots mid-warn (`mid`) and late (`late`). The sim pauses for each shot (the render runs on).
// Usage: npm run build && node tools/summonsshots.cjs <outDir> [p360]
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
    s.scene.restart({ opts: { seed: 5, dungeon: 'flue', tier: 11, invulnerable: true, cls: 'emberwright', route: ['regent'], heroName: 'Emberwright 9', party: [{ cls: 'bulwark', name: 'Bulwark 9' }, { cls: 'lumen', name: 'Lumen 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] }, hud: s.hud, onEnd: () => {} });
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => window.__ember.scene().world.bossIndex >= 0, null, { timeout: 60000, polling: 30 }).catch(() => errs.push('timeout boss'));
  await page.evaluate(() => { const w = window.__ember.scene().world; w.bossVariant = 'court'; const e = w.enemies[w.bossIndex]; e.hp = e.maxHp * 0.5; w.ashT = Math.min(w.ashT, 1); });
  const stopAt = async (frac, name) => {
    await page.waitForFunction((f) => { const s = window.__ember.scene(); const w = s.world; const ok = w.summonsT > 0 && 1 - w.summonsT / 2.5 >= f; if (ok) { s.warp = 0; const e = w.enemies[w.bossIndex]; const p = w.player; p.x = p.px = e.x + 230; p.y = p.py = e.y + 90; } return ok; }, frac, { timeout: 60000, polling: 8 }).catch(() => errs.push('timeout ' + name));
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-${name}.png`) });
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
  };
  await stopAt(0.35, 'mid');
  await stopAt(0.8, 'late');
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
