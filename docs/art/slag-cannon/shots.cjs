// Slagbinder cannon: the hero in a Kiln fight at 320x568 (3D and 2D), caught at the shot (recoil pose and tracer),
// a 4x close-up of the hero, the 2D sprite sheet, and the Recoil (E) icon.
// Usage: npm run build && node docs/art/slag-cannon/shots.cjs <dist> <outDir> [look]   (look: 3d or 2d, default 3d)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.resolve(process.argv[2] || 'dist'); const out = process.argv[3] || 'shots';
const look = process.argv[4] || '3d';
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
  await ctx.addInitScript((g) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full', look: g })), look);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1${look === '2d' ? '' : '&hd2d=1'}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { cls: 'slagbinder', dungeon: 'kiln', route: ['wardens'], tier: 2, invulnerable: true, seed: 3 }, hud: s.hud, onEnd: () => {} }); });
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 2, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive), null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  // Hold the foes in a line to the hero's right, so the shot pierces through them across the screen.
  await page.evaluate(() => { const s = window.__ember.scene(), w = s.world;
    setInterval(() => { const p = w.heroData(0).player;
      w.enemies.filter((e) => e.alive).forEach((e, i) => { e.x = e.px = p.x + 150 + i * 45; e.y = e.py = p.y + (i % 2 ? 14 : -14); }); }, 5); });
  // Catch the frame just after a shot: wait for the cannon timer to reset (volleyT jumps up).
  const atShot = async (name, delay) => {
    await page.evaluate(() => new Promise((res) => { const s = window.__ember.scene(); let last = s.world.heroData(0).player.volleyT;
      const id = setInterval(() => { const v = s.world.heroData(0).player.volleyT; if (v > last + 0.05) { clearInterval(id); res(); } last = v; }, 5); }));
    await page.waitForTimeout(delay);
    await page.screenshot({ path: path.join(out, `${look}-${name}.png`) });
    const c = await page.evaluate(() => { const s = window.__ember.scene(), p = s.world.heroData(0).player; const q = s.hd2d?.project(p.x, p.y);
      if (q) return q; const cam = s.cameras.main; return { x: (p.x - cam.worldView.x) * cam.zoom, y: (p.y - cam.worldView.y) * cam.zoom }; });
    await page.screenshot({ path: path.join(out, `${look}-${name}-close.png`), clip: { x: Math.max(0, c.x - 50), y: Math.max(0, c.y - 80), width: 100, height: 100 } });
  };
  // Screenshots are slow in a software-GL browser, so in 3D (whose tracer runs on sim time) the sim is slowed to a
  // tenth while catching the shot. The 2D effects layer fades in real time, so 2D runs at full speed.
  const slow = look === '3d' ? 10 : 1;
  await page.evaluate((w) => { window.__ember.scene().warp = w; }, 1 / slow);
  await atShot('shot', 40 * slow);
  await atShot('trail', 150 * slow);
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  if (look === '3d') {
    const sheet = await page.evaluate(() => { const tm = window.__ember.scene().textures; return tm.exists('slagbinder') ? tm.get('slagbinder').getSourceImage().toDataURL() : null; });
    const src = fs.readFileSync(path.resolve(__dirname, '../../../client/icons.ts'), 'utf8');
    const m = src.match(/slagbinder: \[\s*\/\/[^\n]*\n\s*'[^']*',\s*\/\/[^\n]*\n\s*'([^']*)'/);
    const p2 = await b.newPage({ viewport: { width: 700, height: 200 } });
    await p2.setContent(`<body style="margin:0;background:#18100e;color:#d9c3b0;font:12px system-ui;padding:12px;display:flex;gap:24px;align-items:center">
      ${sheet ? `<div><img src="${sheet}" style="height:150px"><br>2D sprite (4 frames)</div>` : ''}
      <div style="text-align:center"><svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#ff9b4a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${m ? m[1] : ''}"/></svg><br>Recoil (E)</div></body>`);
    await p2.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
