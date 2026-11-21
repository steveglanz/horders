// Screenshots the raid (the Crucible, Grandmother Slag) with a party of four: Slaglings in
// phase 1, a Ladle Pour about to land, The Pour's molten lanes, the gold Crucible Vents, and
// Last Ember. Her health is set by hand to reach each phase quickly; the sim is frozen mid-cast.
// Usage: npm run build && node tools/raidshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { seed: 8, cls: 'bulwark', dungeon: 'crucible', route: ['grandmotherSlag'], tier: 8, invulnerable: true, heroName: 'Bulwark 8', party: [{ cls: 'lumen', name: 'Lumen 8' }, { cls: 'emberwright', name: 'Emberwright 8' }, { cls: 'duskblade', name: 'Duskblade 8' }] };
const SCENES = [
  { name: '1-slaglings', until: 'adds' },
  { name: '2-ladle', cast: 'ladlePour', at: 0.85 },
  { name: '3-pour', hp: 0.6, cast: 'pour', at: 0.6 },
  { name: '4-vents', hp: 0.3, until: 'vents' },
  { name: '5-lastember', hp: 0.5, cast: 'lastEmber', at: 0.5, late: true },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=8&god=1`);
  await page.waitForTimeout(600);
  // The hub card.
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 9); });
  // Switching class away and back re-renders the hub (the buttons may sit on another phone tab).
  await page.evaluate(() => { document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click(); });
  const card = await page.$('.dg[data-d="crucible"]');
  if (card && await card.isVisible()) { await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: path.join(out, `${tag}-raid-0-card.png`) }); } else if (!phone) errs.push('no crucible card');
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'grandmotherSlag'), null, { timeout: 30000, polling: 30 });
    await page.evaluate((sc) => {
      const w = window.__ember.scene().world;
      const e = w.enemies.find((o) => o.alive && o.kind === 'grandmotherSlag');
      if (sc.hp) e.hp = e.maxHp * sc.hp;
      if (sc.late) e.spawnedAt = w.time - 418;
    }, sc);
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world;
      let ok;
      if (sc.until === 'adds') ok = w.enemies.filter((e) => e.alive && e.kind === 'slagling').length >= 4 && w.time > 13;
      else if (sc.until === 'vents') ok = w.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -2 && t.t / t.dur > 0.4);
      else ok = w.enemies.some((e) => e.alive && e.kind === 'grandmotherSlag' && e.castId === sc.cast && e.castT / e.castDur > sc.at);
      if (ok) s.warp = 0;
      return ok;
    }, sc, { timeout: 100000, polling: 30 }).catch(() => errs.push('timeout ' + sc.name));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-raid-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
