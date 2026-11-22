// Screenshots the kill effect as a strip: the fight is frozen, three Cinderhounds around the hero are "killed" through the
// scene's own death effect, and frames are taken 0, 80, 160 and 260 ms later. The sim stays frozen, the effects run.
// With `loot`, it fires the loot pick-up effect instead: three bags (common, rare, epic tints) fly into the hero.
// Usage: npm run build && node tools/killshots.cjs <outDir> [phone|p360] [loot]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
const phone = process.argv.includes('phone') || p360;
const loot = process.argv.includes('loot');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { cls: 'bulwark', dungeon: 'kiln', route: ['spitters'], tier: 2, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
const SCENES = [{ name: 'kill', route: ['pack'] }];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = p360 ? 'p360' : phone ? 'phone' : 'desk';
  const ctx = await b.newContext(p360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=9&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => { document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click(); });
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="delve"]')?.click());
  await page.waitForTimeout(300);
  const card = null;
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, { ...OPTS, seed: 1, route: sc.route });
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = ''; });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => window.__ember.scene().world.phase === 'fight', null, { timeout: 30000, polling: 30 });
    await page.waitForFunction(() => window.__ember.scene().world.time > 3, null, { timeout: 30000, polling: 30 });
    await page.evaluate(() => {
      const s = window.__ember.scene(); s.warp = 0; s.autopilot = false;
      const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden';
    });
    await page.waitForTimeout(400);
    if (!loot) await page.evaluate(() => {
      const s = window.__ember.scene(); const p = s.world.player;
      for (const [dx, dy] of [[-90, -40], [80, -60], [20, 90]]) s.death('cinderhound', p.x + dx, p.y + dy);
    }, null);
    if (loot) await page.evaluate(() => {
      const s = window.__ember.scene(); const p = s.world.player;
      [[-70, -30, 0xb8b8b8], [70, -40, 0x4f8fff], [30, 70, 0xb36bff]].forEach(([dx, dy, c]) => s.lootFly(p.x + dx, p.y + dy, c));
    });
    let t0 = Date.now();
    for (const ms of [0, 80, 160, 260]) {
      const wait = ms - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(out, `${tag}-${loot ? 'loot' : 'kill'}-${String(ms).padStart(3, '0')}.png`) });
    }
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
