// Oskel v2 phone fixes (flip arrows under the heroes, red edge arrow to the crush line, bolder chevrons): node shots.cjs <dist> <outDir>   env NO3D=1 LAND=1
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
  await set(1, Math.PI / 2, -1, 300, -300); await snap('0-stage1-off-centre');
  // Heroes away from the middle, as in QA's phone check (436 from the centre).
  await set(2, Math.PI / 2, -1, 300, -300); await snap('1-belt-off-centre');
  await set(2, Math.PI / 2, 1.0, 300, -300); await snap('2-flip-off-centre');
  await set(2, 0, -1, -380, 120); await snap('3-crush-line-off-screen');
  await set(3, Math.PI * 0.75, -1, 0, 110); await page.evaluate(() => { const s = window.__ember.scene(); s.handleEvents([{ type: 'phase', phase: 3 }]); }); await page.waitForTimeout(300); console.log('banner', await page.evaluate(() => document.getElementById('bannerTitle').textContent + ' | ' + document.getElementById('banner').className + ' | stage ' + window.__ember.scene().world.osStage)); await snap('4-full-speed-line');
  console.log(errs.join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
