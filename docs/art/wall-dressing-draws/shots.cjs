// Wall chains and press frames in fewer draws: node shots.cjs <dist> <outDir>  (Pressworks, Oskel's arena, stage 1)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname; const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html'); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(fs.readFileSync(path.resolve(f))); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(process.env.LAND ? { viewport: { width: 568, height: 320 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((LOOK) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full', look: LOOK })), process.env.NO3D ? '2d' : '3d');
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1${process.env.NO3D ? '' : '&hd2d=1'}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction((no3d) => window.__ember.scene()?.world?.tick > 0 && (no3d || window.__ember.scene().hd2d), !!process.env.NO3D, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: 'pressworks', tier: 10, invulnerable: true, omens: [], oskelV2: true }, hud: s.hud, onEnd: () => {} }); });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = false; s.warp = 0; const w = s.world;
    for (const e of w.enemies) e.alive = false;
    for (const t of w.telegraphs) t.alive = false;
    w.player.x = w.player.px = 0; w.player.y = w.player.py = 110;
    const b = w.spawn('oskel', 0, -90); w.bossIndex = b; w.bossSpawned = true; w.phase = 'fight'; window.__b = b; w.enemies[b].spawnedAt = w.time - 2; });
  const set = (stage, dir, flipT, px, py) => page.evaluate(([st, d, ft, x, y]) => { const w = window.__ember.scene().world;
    w.osStage = st; w.osDir = d; w.osFlipT = ft; w.player.x = w.player.px = x; w.player.y = w.player.py = y; return w.arenaR; }, [stage, dir, flipT, px, py]);
  const snap = async (name) => { await page.waitForTimeout(+(process.env.WAIT || 1200)); await page.screenshot({ path: path.join(out, name + '.png') }); console.log(name, JSON.stringify(await page.evaluate(() => { const v = window.__ember.scene().hd2d?.stats(); return v ? { calls: v.calls, tri: v.triangles } : null; }))); };
  for (const [nm, x, y] of [['back-wall', 0, -430], ['rim-ne', 300, -300], ['rim-w', -420, -120], ['centre', 0, 110]]) { await set(1, Math.PI / 2, -1, x, y); await snap(nm); }
  console.log(errs.join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
