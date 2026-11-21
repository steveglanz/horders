// Screenshots the Ashvents: Ysmeret, Twin Vents (one covered, one empty), Scatter Embers
// rings (a stacked pair turns red) and the Bellow Slam wind-up. One page, no network:
// the scene restarts straight into Ysmeret with a party of four.
// Usage: npm run build && node tools/ashshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await page.evaluate(() => {
    const s = window.__ember.scene();
    s.scene.restart({ opts: { seed: 5, cls: 'bulwark', dungeon: 'ashvents', route: ['ysmeret'], tier: 7, invulnerable: true, heroName: 'Bulwark 7', party: [{ cls: 'lumen', name: 'Lumen 7' }, { cls: 'emberwright', name: 'Emberwright 7' }, { cls: 'duskblade', name: 'Duskblade 7' }] }, hud: s.hud, onEnd: () => {} });
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  // Freeze inside the predicate, so the wind-up can't finish between the check and the shot.
  const until = async (label, fn, arg) => {
    await page.evaluate(() => { window.__ember.scene().warp = 3; });
    await page.waitForFunction(fn, arg, { timeout: 120000, polling: 30 }).catch(() => errs.push('timeout ' + label));
    await page.evaluate(() => { window.__ember.scene().warp = 0; });
  };
  const shot = async (label) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, `${tag}-ash-${label}.png`) }); };
  // Twin Vents: catch them open, then park every hero in the first vent so the second shows empty.
  await until('vents', () => { const s = window.__ember.scene(); const w = s.world; const v = w.telegraphs.filter((t) => t.alive && t.kind === 'soak' && t.owner === -2); const ok = v.length === 2 && v[0].t / v[0].dur > 0.35; if (ok) s.warp = 0; return ok; });
  await page.evaluate(() => {
    const w = window.__ember.scene().world;
    const v = w.telegraphs.filter((t) => t.alive && t.kind === 'soak' && t.owner === -2);
    const lu = w.heroData(1).player; lu.x = lu.px = v[0].x; lu.y = lu.py = v[0].y;
    for (const k of [2, 3]) { const q = w.heroData(k).player; if (Math.hypot(q.x - v[1].x, q.y - v[1].y) < v[1].r + 4) { q.x = q.px = q.x + 140; } }
  });
  await shot('1-vents');
  await until('scatter', () => { const s = window.__ember.scene(); const w = s.world; const ok = w.enemies.some((e) => e.alive && e.kind === 'ysmeret' && e.castId === 'scatter' && e.castT / e.castDur > 0.5); if (ok) s.warp = 0; return ok; });
  // Stack two heroes so their rings overlap and turn red.
  await page.evaluate(() => {
    const w = window.__ember.scene().world;
    const a = w.heroData(2).player; const b2 = w.heroData(3).player;
    b2.x = b2.px = a.x + 50; b2.y = b2.py = a.y + 10;
  });
  await shot('2-scatter');
  await until('bellow', () => { const s = window.__ember.scene(); const w = s.world; const ok = w.enemies.some((e) => e.alive && e.kind === 'ysmeret' && e.castId === 'bellowSlam' && e.castT / e.castDur > 0.55); if (ok) s.warp = 0; return ok; });
  await shot('3-bellow');
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
