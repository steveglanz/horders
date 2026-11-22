// Screenshots Ondrel's Ironload (Phase 12 W2): the scene restarts into Ondrel with a party of four, runs until the fight
// is a few seconds in, freezes, then marks a hero and holds the countdown: the Lumen (an ally) early and late, then your own hero.
// Usage: npm run build && node tools/ironshots.cjs <outDir> [p360]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
const ROUTES = {
  kiln: { route: ['kilnMother'], tier: 3 },
  foundry: { route: ['maelra'], tier: 5 },
  hammerdeep: { route: ['ondrel'], tier: 4 },
  ashvents: { route: ['ysmeret'], tier: 7 },
  crucible: { route: ['grandmotherSlag'], tier: 8 },
  hoard: { route: ['vorhulm'], tier: 9 },
  flue: { route: ['regent'], tier: 11 },
};
const dungeon = 'hammerdeep';
if (!dungeon) { console.error('name a dungeon: ' + Object.keys(ROUTES).join(' ')); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const OPTS = { cls: 'bulwark', dungeon, ...ROUTES[dungeon], seed: 3, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
(async () => {
  const b = await chromium.launch({ args: process.env.GLARGS ? process.env.GLARGS.split(' ') : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = p360 ? 'p360' : 'desk';
  const ctx = await b.newContext(p360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=9&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => { document.querySelector('[data-cls="bulwark"]').click(); });
  if (p360) await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; return w.phase === 'fight' && w.time > 5 && !(s.warp = 0); }, null, { timeout: 60000, polling: 'raf' })
    .catch(() => errs.push('timeout waiting for the fight'));
  await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
  await page.waitForTimeout(400);
  for (const [name, t, k] of [['1-early', 3.6, 1], ['2-late', 0.8, 1], ['3-on-me', 1.6, 0]]) {
    await page.evaluate(([t, k]) => { const w = window.__ember.scene().world; w.bossVariant = 'load'; w.loadHero = k; w.loadT = t; }, [t, k]);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-iron-${name}.png`) });
  }
  const st = await page.evaluate(() => { const w = window.__ember.scene().world; return w.time.toFixed(2) + ' ' + w.enemies.filter((e) => e.alive).map((e) => e.kind + ':' + (e.castId || '-') + ':' + (e.castT ?? 0).toFixed(2)).join(','); });
  console.log(st);
  console.log(tag, dungeon, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
