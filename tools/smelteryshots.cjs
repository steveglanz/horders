// Screenshots raid 3 (the Smeltery, the Cinder Colossus) with a party of four: his plated front and hot back in
// phase 1, a Slag Sweep cone, a Wheel wind-up (phase 2) and Meltdown (phase 3) with its closing pulse ring. His
// health is set by hand to reach each phase; the sim is frozen at the moment. Also the hub card.
// Usage: npm run build && node tools/smelteryshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { seed: 9, cls: 'bulwark', dungeon: 'smeltery', route: ['colossus'], tier: 10, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
const SCENES = [
  { name: '1-plate', until: 'plate' },
  { name: '2-sweep', until: 'sweep' },
  { name: '3-wheel', hp: 0.55, until: 'wheel' },
  { name: '4-melt', hp: 0.25, until: 'melt' },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=9&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 11); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => { document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click(); });
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="delve"]')?.click());
  await page.waitForTimeout(300);
  const card = await page.$('.dg[data-d="smeltery"]');
  if (card && await card.isVisible()) { await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: path.join(out, `${tag}-smeltery-0-card.png`) }); } else errs.push('no smeltery card');
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = ''; });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'colossus'), null, { timeout: 30000, polling: 30 });
    await page.evaluate((sc) => {
      const w = window.__ember.scene().world;
      const e = w.enemies.find((o) => o.alive && o.kind === 'colossus');
      if (sc.hp) e.hp = e.maxHp * sc.hp;
    }, sc);
    // The predicate freezes the scene itself the moment it holds (a frame can run 0.25 s x warp of sim).
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world;
      let ok;
      const e = w.enemies.find((o) => o.alive && o.kind === 'colossus');
      if (!e) ok = false;
      else if (sc.until === 'plate') ok = w.time > 7 && !e.castId && Math.hypot(e.x - w.player.x, e.y - w.player.y) < 260;
      else if (sc.until === 'sweep') ok = e.castId === 'slagSweep' && e.castT > 0.6;
      else if (sc.until === 'wheel') ok = e.castId === 'wheel' && e.castT > 1;
      else ok = w.bossPhase >= 3 && s.meltAt >= 0 && w.time - s.meltAt > 1.8;
      return ok && !(s.warp = 0);
    }, sc, { timeout: 100000, polling: 'raf' }).catch(() => errs.push('timeout ' + sc.name));
    // Between hits, and with the fight banner out of the way, so the shot shows him and the floor marks.
    await page.evaluate(() => { window.__ember.scene().world.enemies.forEach((e) => { e.flash = -1; }); const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-smeltery-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
