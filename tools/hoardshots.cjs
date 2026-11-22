// Screenshots raid 2 (the Hoard, Old Coalmouth) with a party of four: Gorge being cast (interrupt blue), a Swallow
// with the Craw up (the swallowed hero inside him), and Ember Feast's spilled embers after he has eaten a few. His
// health is set by hand to reach each phase; the sim is frozen at the moment. Also the hub card.
// Usage: npm run build && node tools/hoardshots.cjs <outDir> [phone|p360]  (p360: the 360 px wide phone of the Y9 readability pass)
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
const phone = process.argv.includes('phone') || p360;
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { seed: 9, cls: 'bulwark', dungeon: 'hoard', route: ['coalmouth'], tier: 9, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
const SCENES = [
  { name: '1-gorge', until: 'gorge' },
  { name: '2-swallow', hp: 0.55, until: 'craw' },
  { name: '3-embers', hp: 0.2, fed: 3, until: 'embers' },
];
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
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 10); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => { document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click(); });
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="delve"]')?.click());
  await page.waitForTimeout(300);
  const card = await page.$('.dg[data-d="hoard"]');
  if (card && await card.isVisible()) { await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: path.join(out, `${tag}-hoard-0-card.png`) }); } else errs.push('no hoard card');
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'coalmouth'), null, { timeout: 30000, polling: 30 });
    await page.evaluate((sc) => {
      const w = window.__ember.scene().world;
      const e = w.enemies.find((o) => o.alive && o.kind === 'coalmouth');
      if (sc.hp) e.hp = e.maxHp * sc.hp;
      if (sc.fed) w.coalFed = sc.fed;
    }, sc);
    // The predicate freezes the scene itself the moment it holds (a frame can run 0.25 s x warp of sim).
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world;
      let ok;
      if (sc.until === 'gorge') ok = w.enemies.some((e) => e.alive && e.kind === 'coalmouth' && e.castId === 'coalGorge');
      else if (sc.until === 'craw') ok = w.enemies.some((e) => e.alive && e.kind === 'craw') && w.time > 1;
      else ok = w.coalEmbers.length >= 4 && w.coalEmbers.some((m) => m.t < 4);
      return ok && !(s.warp = 0);
    }, sc, { timeout: 100000, polling: 'raf' }).catch(() => errs.push('timeout ' + sc.name));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-hoard-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
