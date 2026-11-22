// Screenshots raid 4 (the Flue, the Furnace Regent) with a party of four: the Regent in phase 1, a fresh Decree
// (seal over the holder's head, countdown ring, Scorch ring round them), a late Decree just after a pass (the
// passer wears the cracked Spent seal; its last 3 s are set by hand, since bots pass at once), and Abdication (phase 3). His health is set by hand to reach each phase;
// the sim is frozen at the moment. Also the hub card.
// Usage: npm run build && node tools/flueshots.cjs <outDir> [phone|p360]  (p360: the 360 px wide phone)
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
const phone = process.argv.includes('phone') || p360;
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { seed: 9, cls: 'bulwark', dungeon: 'flue', route: ['regent'], tier: 11, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
const SCENES = [
  { name: '1-regent', until: 'regent' },
  { name: '2-decree', until: 'decree' },
  { name: '3-spent', until: 'spent' },
  { name: '4-abdicate', hp: 0.2, until: 'abdicate' },
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
  const card = await page.$('.dg[data-d="flue"]');
  if (card && await card.isVisible()) { await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: path.join(out, `${tag}-flue-0-card.png`) }); } else errs.push('no flue card');
  if (phone) await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = ''; });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'regent'), null, { timeout: 30000, polling: 30 });
    await page.evaluate((sc) => {
      const w = window.__ember.scene().world;
      const e = w.enemies.find((o) => o.alive && o.kind === 'regent');
      if (sc.hp) e.hp = e.maxHp * sc.hp;
    }, sc);
    // The predicate freezes the scene itself the moment it holds (a frame can run 0.25 s x warp of sim).
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world;
      let ok;
      const e = w.enemies.find((o) => o.alive && o.kind === 'regent');
      if (!e) ok = false;
      else if (sc.until === 'regent') ok = w.time > 7 && !e.castId && w.regentDecree.length === 0 && Math.hypot(e.x - w.player.x, e.y - w.player.y) < 260;
      else if (sc.until === 'decree') ok = w.regentDecree.some((d) => d.passes === 0 && d.held > 0.5);
      else if (sc.until === 'spent') ok = w.regentDecree.some((d) => d.passes > 0) && w.heroes.some((_, k) => (w.heroData(k).player.spentT ?? 0) > 2);
      else ok = w.bossPhase >= 3 && w.time > 7 && Math.hypot(e.x - w.player.x, e.y - w.player.y) < 260;
      // Bots pass on a Decree a second after it lands, so slow down once one is out, to catch the moment after a pass.
      if (sc.until === 'spent' && w.regentDecree.length && s.warp > 1) s.warp = 1;
      // Bots pass a Decree the moment they can, so its last 3 s (red, pulsing ring) are set by hand for the shot.
      if (ok && sc.until === 'spent') w.regentDecree.forEach((d) => { d.t = 2.2; });
      return ok && !(s.warp = 0);
    }, sc, { timeout: 100000, polling: 'raf' }).catch(() => errs.push('timeout ' + sc.name));
    // Between hits, and with the fight banner out of the way, so the shot shows him and the floor marks.
    await page.evaluate(() => { window.__ember.scene().world.enemies.forEach((e) => { e.flash = -1; }); const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-flue-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
