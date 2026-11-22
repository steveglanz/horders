// Grandmother Slag's hit flash in the raid (the Crucible, party of four): samples for 8 s of fight how often she is
// mid-flash (World enemy .flash > 0), then shoots her twice at a 360 px phone: frozen mid-flash (`hit`) and between
// hits (`calm`). A raid hits her nearly all the time, so whatever the flash looks like is how she looks most of the fight.
// Usage: npm run build && node tools/slagflashshots.cjs <outDir>
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { seed: 8, cls: 'bulwark', dungeon: 'crucible', route: ['grandmotherSlag'], tier: 8, invulnerable: true, heroName: 'Bulwark 8', party: [{ cls: 'lumen', name: 'Lumen 8' }, { cls: 'emberwright', name: 'Emberwright 8' }, { cls: 'duskblade', name: 'Duskblade 8' }] };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=8&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'grandmotherSlag'), null, { timeout: 30000, polling: 30 });
  await page.waitForFunction(() => window.__ember.scene().world.time > 12, null, { timeout: 30000, polling: 50 });
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  // How often is she mid-flash? Sampled by sim tick for 8 s of fight.
  const frac = await page.evaluate(async () => {
    const s = window.__ember.scene(); const w = s.world; const t0 = w.time; let n = 0, f = 0, last = -1;
    while (w.time - t0 < 8) { if (w.tick !== last) { last = w.tick; const e = w.enemies.find((o) => o.alive && o.kind === 'grandmotherSlag'); if (e) { n++; if (e.flash > 0) f++; } } await new Promise((r) => setTimeout(r, 5)); }
    return { ticks: n, flashing: f };
  });
  console.log('mid-flash:', frac.flashing, 'of', frac.ticks, 'ticks', `(${Math.round((100 * frac.flashing) / frac.ticks)}%)`);
  const shoot = async (want, name) => {
    await page.waitForFunction((want) => { const s = window.__ember.scene(); const e = s.world.enemies.find((o) => o.alive && o.kind === 'grandmotherSlag'); const ok = e && (e.flash > 0) === want; if (ok) { s.warp = 0; const p = s.world.player; p.x = p.px = e.x; p.y = p.py = e.y + 150; } return ok; }, want, { timeout: 20000, polling: 4 }).catch(() => errs.push('timeout ' + name));
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `p360-${name}.png`) });
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
  };
  await shoot(true, 'hit');
  await shoot(false, 'calm');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
