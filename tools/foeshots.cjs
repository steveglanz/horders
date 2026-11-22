// Screenshots the Kiln's new foes (V1 sim, V5 art): Ember Spitters winding up a lob, an Ashbuck showing its lane, and
// the Kiln Mother's Kiln Draw tell (V3) mid-cast.
// Usage: npm run build && node tools/foeshots.cjs <outDir> [phone|p360]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
const phone = process.argv.includes('phone') || p360;
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { cls: 'bulwark', dungeon: 'kiln', route: ['spitters'], tier: 2, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
const SCENES = [
  { name: '1-spitters', route: ['spitters'], until: 'emberLob', kind: 'emberSpitter' },
  { name: '2-ashbucks', route: ['ashbucks'], until: 'charge', kind: 'ashbuck' },
  // V3's Kiln Draw: this run's Kiln Mother set to the 'draw' variant and dropped into phase 2.
  { name: '3-kilndraw', route: ['kilnMother'], until: 'kilnDraw', kind: 'kilnMother', draw: true },
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
    if (sc.draw) {
      await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'kilnMother'), null, { timeout: 30000, polling: 30 });
      await page.evaluate(() => { const w = window.__ember.scene().world; w.bossVariant = 'draw'; const e = w.enemies.find((o) => o.alive && o.kind === 'kilnMother'); e.hp = e.maxHp * 0.5; });
    }
    // The predicate freezes the scene itself the moment it holds (a frame can run 0.25 s x warp of sim).
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world;
      const ok = w.time > 2 && w.enemies.some((e) => e.alive && e.kind === sc.kind && e.castId === sc.until && e.castT > (sc.draw ? 0.6 : 0.3)) && (!sc.draw || w.telegraphs.some((t) => t.alive && t.r === 150));
      return ok && !(s.warp = 0);
    }, sc, { timeout: 100000, polling: 'raf' }).catch(async () => errs.push('timeout ' + sc.name ));
    // Between hits, and with the fight banner out of the way, so the shot shows him and the floor marks.
    await page.evaluate(() => { window.__ember.scene().world.enemies.forEach((e) => { e.flash = -1; }); const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-foes-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
