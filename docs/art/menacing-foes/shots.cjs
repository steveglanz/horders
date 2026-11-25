// Menacing foes: a Kiln fight in 3D at 320x568 with a pack drawn close, plus the sprite sheet at 4x.
// Usage: npm run build && node shots.cjs <dist> <outDir> [route]   (route defaults to wardens)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.resolve(process.argv[2] || 'dist'); const out = process.argv[3] || 'shots';
const route = process.argv[4] || 'wardens';
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
  await page.evaluate((route) => { const s = window.__ember.scene(); s.scene.restart({ opts: { cls: 'bulwark', dungeon: 'kiln', route: [route], tier: 2, invulnerable: true, seed: 3 }, hud: s.hud, onEnd: () => {} }); }, route);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 2, null, { timeout: 120000 });
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  // Put the pack in a ring round the hero, close enough to fill the phone screen, then let a moment play.
  await page.evaluate(() => { const s = window.__ember.scene(), w = s.world, p = w.heroData(0).player; s.warp = 1;
    w.enemies.filter((e) => e.alive).forEach((e, i, a) => { const ang = -Math.PI / 2 + (i - (a.length - 1) / 2) * 1.1; e.x = e.px = p.x + Math.cos(ang) * 85; e.y = e.py = p.y + Math.sin(ang) * 85; }); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, `fight-${route}.png`) });
  const keys = ['husk', 'ashling', 'cinderhound', 'slagling'];
  const sheet = await page.evaluate((keys) => { const tm = window.__ember.scene().textures; return keys.filter((k) => tm.exists(k)).map((k) => ({ k, src: tm.get(k).getSourceImage().toDataURL() })); }, keys);
  const p2 = await b.newPage({ viewport: { width: 900, height: 200 } });
  await p2.setContent(`<body style="margin:0;background:#18100e;color:#d9c3b0;font:12px system-ui;padding:12px;display:flex;flex-direction:column;gap:10px">${sheet.map((i) => `<div><img src="${i.src}" style="height:${i.k === 'husk' ? 220 : 140}px;image-rendering:auto"> ${i.k}</div>`).join('')}</body>`);
  await p2.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
