// Oskel's Rivets and Stamp in 3D: node shots.cjs <dist> <outDir>   env NO3D=1 LAND=1
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
  await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: 'pressworks', tier: 10, invulnerable: true, omens: [] }, hud: s.hud, onEnd: () => {} }); });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = false; s.warp = 0; const w = s.world;
    for (const e of w.enemies) e.alive = false;
    for (const t of w.telegraphs) t.alive = false;
    w.player.x = w.player.px = 0; w.player.y = w.player.py = 110;
    const b = w.spawn('oskel', 0, -90); w.bossIndex = b; w.bossSpawned = true; w.phase = 'fight'; window.__b = b; w.enemies[b].spawnedAt = w.time - 2; });
  const set = (rivetF, stampF) => page.evaluate(([rf, sf]) => { const w = window.__ember.scene().world; const e = w.enemies[window.__b];
    for (const t of w.telegraphs) t.alive = false;
    if (rf >= 0) for (const [x, y] of [[0, 110], [-150, 40], [140, 60]]) { w.addTelegraph('circle', x, y, 60, 0, 0, 1.6, 30, 'hit', -1); const t = w.telegraphs.filter((q) => q.alive).pop(); t.t = rf * t.dur; }
    if (sf >= 0) { e.castId = 'stamp'; e.castName = 'Stamp'; e.castDur = 2; e.castT = sf * 2; } else { e.castId = null; }
    return w.telegraphs.filter((t) => t.alive).length; }, [rivetF, stampF]);
  const snap = async (name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(out, name + '.png') }); console.log(name, JSON.stringify(await page.evaluate(() => { const v = window.__ember.scene().hd2d?.stats(); return v ? { calls: v.calls, tri: v.triangles } : null; }))); };
  await set(-1, -1); await snap('0-none');
  await set(0.45, -1); await snap('1-rivets-falling');
  await set(0.88, -1); await snap('2-rivets-landing');
  await set(-1, 0.4); await snap('3-stamp-falling');
  await set(-1, 0.9); await snap('4-stamp-landing');
  console.log(errs.join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
