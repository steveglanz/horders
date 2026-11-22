// Screenshots the Cinder Colossus's Plate Shift (Phase 12 W3): the scene restarts into his fight in the Smeltery, sets the
// Plate Shift version, drops him into phase 2 and shoots twice: late in the cast (`cast`: the band rattles and a ghost
// band grows where it will slide) and settled (`after`: the plate on its new side). In between it logs the drawn plate
// turn for half a second after the cast lands, to show the band sliding round (too quick to catch in a screenshot). The sim pauses for each shot (the render runs on).
// Usage: npm run build && node tools/shiftshots.cjs <outDir> [p360]
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
    s.scene.restart({ opts: { seed: 5, dungeon: 'smeltery', tier: 10, invulnerable: true, cls: 'bulwark', route: ['colossus'], heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] }, hud: s.hud, onEnd: () => {} });
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => window.__ember.scene().world.bossIndex >= 0, null, { timeout: 60000, polling: 30 }).catch(() => errs.push('timeout boss'));
  await page.evaluate(() => { const w = window.__ember.scene().world; w.bossVariant = 'shift'; const e = w.enemies[w.bossIndex]; e.hp = e.maxHp * 0.58; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const e = s.world.enemies[s.world.bossIndex]; const ok = e && e.castId === 'plateShift' && e.castT / e.castDur > 0.7; if (ok) s.warp = 0; return ok; }, null, { timeout: 60000, polling: 16 }).catch(() => errs.push('timeout cast'));
  await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${tag}-cast.png`) });
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const e = s.world.enemies[s.world.bossIndex]; const ok = e && e.castId !== 'plateShift'; if (ok) s.warp = 0; return ok; }, null, { timeout: 10000, polling: 4 }).catch(() => errs.push('timeout land'));
  // The drawn plate's turn over the first half second after it lands (it eases to World.colPlate).
  const slide = await page.evaluate(async () => { const s = window.__ember.scene(); const v = []; const t0 = performance.now(); while (performance.now() - t0 < 500) { v.push([Math.round(performance.now() - t0), +(s.plateShown ?? 0).toFixed(2)]); await new Promise((r) => setTimeout(r, 60)); } return v; });
  console.log('plate as drawn [ms, rad]:', JSON.stringify(slide));
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `${tag}-after.png`) });
  console.log(tag, JSON.stringify(await page.evaluate(() => (() => { const w = window.__ember.scene().world; return [w.bossPhase, +w.colPlate.toFixed(2), +w.colFacing.toFixed(2)]; })())), errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
