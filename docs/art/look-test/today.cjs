// Look test: today's look, for the blind pick. 15 s of a Bulwark fighting the first pack of a Kiln tier 1 run
// in the live 3D view at 390x844, played by the game's own bot, with the DOM HUD hidden (env HUD=1 keeps it). Phaser's loop is stopped and stepped by hand at
// 1/30 s per frame, so slow software GL still gives a smooth clip.
// Usage: npm run build && node docs/art/look-test/today.cjs <dist> <outDir> [fps]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const dist = path.resolve(process.argv[2] || 'dist'); const out = path.resolve(process.argv[3] || 'looktest-out');
const fps = +(process.argv[4] || 30); const SEC = 15;
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(f));
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&hd2d=1`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { cls: 'bulwark', dungeon: 'kiln', tier: 1, seed: 3, invulnerable: true }, hud: s.hud, onEnd: () => {} }); });
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 2, null, { timeout: 120000 });
  // Let the bot walk to the first pack, then start the clip when a live foe is close.
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => { const s = window.__ember.scene(), w = s.world, p = w.heroData(0).player;
    return w.enemies.some((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 170); }, null, { timeout: 240000, polling: 200 });
  // Hide the DOM HUD (bars, buttons, banners) so the blind pick compares only the look, like the other two clips.
  if (!process.env.HUD) await page.addStyleTag({ content: 'body *:not(canvas):not(:has(canvas)){visibility:hidden!important}' });
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 1; s.game.loop.sleep(); window.__lt = { T: performance.now() }; });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'looktoday-'));
  const n = Math.round(SEC * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((dt) => { const s = window.__ember.scene(); window.__lt.T += dt; s.game.step(window.__lt.T, dt); }, 1000 / fps);
    await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, '0')}.png`) });
  }
  const mp4 = path.join(out, 'today.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
  console.log('wrote', mp4, errs.length ? errs.join('\n') : 'no errors');
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close(); srv.close();
})();
