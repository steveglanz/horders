// Foe contrast on every floor: a Halls fight in 3D at 320x568 with the first awake pack drawn close round the hero.
// Usage: npm run build && node shots.cjs <dist> <outDir> <dungeon> [tier]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.resolve(process.argv[2] || 'dist'); const out = process.argv[3] || 'shots';
const dungeon = process.argv[4] || 'crucible'; const tier = Number(process.argv[5] || 2);
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(f));
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1&hd2d=1`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate(({ dungeon, tier }) => { const s = window.__ember.scene(); const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); s.scene.restart({ opts: { cls: 'bulwark', dungeon, tier, invulnerable: true, seed: 3, halls: true, hallsBeta: true, raidTrash: true }, hud: s.hud, onEnd: () => {} }); }, { dungeon, tier });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 120000 });
  console.log(await page.evaluate(() => { const w = window.__ember.scene().world; return JSON.stringify({ dungeon: w.dungeonId, halls: !!w.halls, alive: w.enemies.filter((e) => e.alive).length, packs: w.halls?.packs?.length }); }));
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  // Walk the hero to the first pack with foes (role A), so it wakes.
  await page.evaluate(() => { const w = window.__ember.scene().world, p = w.heroData(0).player; const k = w.halls.packs.find((q) => q.role === 'A') || w.halls.packs[0]; p.x = p.px = k.x; p.y = p.py = k.y + 90; });
  await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  // Put the pack in a ring round the hero, close enough to fill the phone screen, then let a moment play.
  await page.evaluate(() => { const s = window.__ember.scene(), w = s.world, p = w.heroData(0).player; s.warp = 1;
    w.enemies.filter((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 400).slice(0, 5).forEach((e, i, a) => { const ang = -Math.PI / 2 + (i - (a.length - 1) / 2) * 1.1; e.x = e.px = p.x + Math.cos(ang) * 85; e.y = e.py = p.y + Math.sin(ang) * 85; }); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, `${dungeon}.png`) });
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
