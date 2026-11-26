// Menacing bosses: a 3D fight at 320x568 with a batch of bosses spawned in a ring round the hero.
// KINDS=a,b picks the kinds (part 1: colossus,ondrel,oskel,hessa); R=<px> and SPREAD=<radians> size the ring.
// Prints the draw calls.
// Usage: npm run build && node docs/art/menacing-bosses/shots.cjs <dist> <outDir> [dungeon] [tag]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.resolve(process.argv[2] || 'dist'); const out = process.argv[3] || 'shots';
const dungeon = process.argv[4] || 'foundry'; const tag = process.argv[5] || 'after';
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
  await page.evaluate((dungeon) => { const s = window.__ember.scene(); s.scene.restart({ opts: { cls: 'bulwark', dungeon, tier: 2, invulnerable: true, seed: 3 }, hud: s.hud, onEnd: () => {} }); }, dungeon);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 2, null, { timeout: 120000 });
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForTimeout(1500);
  // Clear whatever is near, then ring the hero with this batch (spawn is private in TS but plain at runtime).
  const kindsArg = (process.env.KINDS || 'colossus,ondrel,oskel,hessa').split(',');
  const R = Number(process.env.R) || 150, SPREAD = Number(process.env.SPREAD) || 1.05;
  await page.evaluate(([kindsArg, R, SPREAD]) => { const s = window.__ember.scene(), w = s.world, p = w.heroData(0).player;
    w.enemies.forEach((e) => { if (e.alive) { e.x = e.px = p.x + 4000; e.y = e.py = p.y + 4000; } });
    const kinds = kindsArg;
    kinds.forEach((k, i) => { const ang = -Math.PI / 2 + (i - (kinds.length - 1) / 2) * SPREAD; w.spawn(k, p.x + Math.cos(ang) * R, p.y + Math.sin(ang) * R); }); }, [kindsArg, R, SPREAD]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${tag}-fight-${dungeon}.png`) });
  const calls = await page.evaluate(() => window.__ember.scene().hd2d?.stats()?.calls ?? null);
  console.log('draw calls', calls);
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
