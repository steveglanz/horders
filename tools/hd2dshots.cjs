// HD-2D look test (?hd2d=1): the Flue with a party of four, drawn by the 3D view (dist/hd2d.js), next to the same
// moments in 2D. Presses Delve the real way, so the 3D file loads behind the loading screen first.
// Moments: Ash Fall in phase 2 (his health set to 60% by hand), and a fresh Decree in phase 1. The sim is frozen at each moment.
// Usage: npm run build && node tools/hd2dshots.cjs <outDir> [p360|land|desk] [2d]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p360', 'land', 'desk'].find((s) => process.argv.includes(s)) || 'p360';
const flat = process.argv.includes('2d');
fs.mkdirSync(out, { recursive: true });
// Serves dist/ as a deploy would: index.html and hd2d.js side by side.
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = p === '/hd2d.js' ? 'dist/hd2d.js' : 'dist/index.html';
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const OPTS = { seed: 9, cls: 'bulwark', dungeon: 'flue', route: ['regent'], tier: 11, invulnerable: true, heroName: 'Bulwark 9', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'emberwright', name: 'Emberwright 9' }, { cls: 'duskblade', name: 'Duskblade 9' }] };
const VIEW = { p360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, land: { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1280, height: 720 } } };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(VIEW[size]);
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errs.push(`console ${m.type()}: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=9&god=1${flat ? '' : '&hd2d=1'}`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  if (!flat) {
    await page.waitForTimeout(20);
    const shown = await page.evaluate(() => !document.getElementById('hd2dLoad').hidden);
    if (shown) await page.screenshot({ path: path.join(out, `${size}-0-loading.png`) });
    console.log('loading screen shown:', shown);
  }
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 30000 });
  const tag = `${size}-${flat ? '2d' : '3d'}`;
  for (const until of ['ashfall', 'decree']) {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, OPTS);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'regent'), null, { timeout: 60000, polling: 30 });
    if (until === 'ashfall') await page.evaluate(() => { const w = window.__ember.scene().world; w.bossVariant = 'ash'; const e = w.enemies.find((o) => o.alive && o.kind === 'regent'); e.hp = e.maxHp * 0.6; });
    await page.waitForFunction((until) => {
      const s = window.__ember.scene(); const w = s.world;
      const e = w.enemies.find((o) => o.alive && o.kind === 'regent');
      let ok = false;
      if (e && until === 'ashfall') ok = w.bossPhase >= 2 && w.telegraphs.some((t) => t.alive && t.t > t.dur * 0.4);
      else if (e) ok = w.regentDecree.some((d) => d.passes === 0 && d.held > 0.5);
      return ok && !(s.warp = 0);
    }, until, { timeout: 120000, polling: 'raf' }).catch(() => errs.push('timeout ' + until));
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, `${tag}-${until}.png`) });
  }
  const stats = await page.evaluate(() => window.__ember.scene().hd2d?.stats() ?? null);
  console.log(tag, 'stats', JSON.stringify(stats));
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
