// Screenshots Grandmother Slag's Brimming (Phase 12 W3): the scene restarts into her fight in the Crucible, sets the
// Brimming version, drops her into phase 2 and shoots twice: just after the islands rise (`rise`) and while the first
// island is sinking (`sink`). For the first shot the hero is put on the middle island so the camera frames the islands. The sim pauses for each shot (the render runs on).
// Usage: npm run build && node tools/brimshots.cjs <outDir> [p360]
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
    s.scene.restart({ opts: { seed: 5, dungeon: 'hoard', tier: 9, invulnerable: true, cls: 'bulwark', route: ['vorhulm'], heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] }, hud: s.hud, onEnd: () => {} });
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => window.__ember.scene().world.bossIndex >= 0, null, { timeout: 60000, polling: 30 }).catch(() => errs.push('timeout boss'));
  await page.evaluate(() => { const w = window.__ember.scene().world; w.bossVariant = 'bank'; const e = w.enemies[w.bossIndex]; e.hp = e.maxHp * 0.24; });
  const coals = () => window.__ember.scene().world.telegraphs.filter((t) => t.alive && t.kind === 'soak' && t.owner === -4);
  await page.waitForFunction((src) => { const s = window.__ember.scene(); const c = eval(src)(); const ok = c.length > 0 && c[0].t / c[0].dur > 0.55; if (ok) { s.warp = 0; const p = s.world.player; p.x = p.px = c[0].x; p.y = p.py = c[0].y; } return ok; }, coals.toString(), { timeout: 60000, polling: 30 }).catch(() => errs.push('timeout coals'));
  await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${tag}-fuse.png`) });
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction((src) => { const s = window.__ember.scene(); const ok = eval(src)().length === 0; if (ok) s.warp = 0; return ok; }, coals.toString(), { timeout: 30000, polling: 16 }).catch(() => errs.push('timeout land'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, `${tag}-land.png`) });
  console.log(tag, JSON.stringify(await page.evaluate(() => window.__ember.scene().world.bossPhase)), errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
