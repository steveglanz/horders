// Ysmeret v2 flame shots: node shots.cjs <dist> <outDir>   env NO3D=1 LAND=1
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1&ysmeretv2=1${process.env.NO3D ? '' : '&hd2d=1'}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction((no3d) => window.__ember.scene()?.world?.tick > 0 && (no3d || window.__ember.scene().hd2d), !!process.env.NO3D, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: 'ashvents', tier: 7, invulnerable: true, ysmeretV2: true, omens: [] }, hud: s.hud, onEnd: () => {} }); });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
  const ok = await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = false; s.warp = 0; const w = s.world;
    for (const e of w.enemies) e.alive = false;
    w.player.x = w.player.px = 0; w.player.y = w.player.py = 120;
    const b = w.spawn('ysmeret', 0, -40); w.bossIndex = b; w.bossSpawned = true; window.__b = b;
    w.ysStage = 1; w.bossPhase = 1; w.phase = 'fight';
    const e = w.enemies[b]; e.hp = e.maxHp * 0.501; e.castId = null;
    return w.ysmeretV2; });
  console.log('ysmeretV2', ok);
  const step = (sec, until) => page.evaluate(([sec, until]) => { const w = window.__ember.scene().world; const u = until ? new Function('w', 'return ' + until) : () => false; const end = w.time + sec; let n = 0;
    while (w.time < end && n++ < 4000) { for (const e of w.enemies) if (e.alive && e.kind !== 'ysmeret') e.alive = false; for (const e of w.enemies) if (e.alive) { e.castId = null; e.castT = 0; e.abilityT = 99; } w.ysBel0 = 99; for (const t of w.telegraphs) t.alive = false; if (w.state === 'draft') w.choose(0); else w.step({ x: 0, y: 0 }); if (u(w)) break; }
    const be = w.enemies[window.__b]; return JSON.stringify({ ph: w.phase, bi: w.bossIndex, b: window.__b, hp: be && (be.hp / be.maxHp).toFixed(3), al: be && be.alive, k: be && be.kind, t: w.time.toFixed(2), st: w.ysStage, f: [w.ysF0, w.ysF1], a: [w.ysAway0.toFixed(2), w.ysAway1.toFixed(2)], pool: Math.round(w.ysPool), at: [Math.round(w.ysAx0), Math.round(w.ysAy0), Math.round(w.ysAx1), Math.round(w.ysAy1)] }); }, [sec, until || '']);
  const snap = async (name) => { await page.waitForTimeout(1000); await page.screenshot({ path: path.join(out, name + '.png') }); console.log(name, JSON.stringify(await page.evaluate(() => { const v = window.__ember.scene().hd2d?.stats(); return v ? { calls: v.calls, tri: v.triangles } : null; }))); };
  // Hit her past 50%: she splits.
  await page.evaluate(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__b]; e.hp = e.maxHp * 0.49; });
  console.log(await step(0.5, 'w.ysStage === 2'));
  // Stand by flame 0 so it is covered and flame 1 is alone.
  const toF0 = () => page.evaluate(() => { const w = window.__ember.scene().world; const f = w.enemies[w.ysF0]; const o = w.enemies[w.ysF1]; const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy); w.player.x = w.player.px = f.x + dx / d * 70; w.player.y = w.player.py = f.y + dy / d * 70; });
  await toF0(); console.log(await step(0.6)); await snap('s2-split');
  await toF0(); console.log(await step(1.2, 'w.ysAway1 > 1.6')); await snap('s2-alone-half');
  await toF0(); console.log(await step(1.5, 'w.ysAway1 > 2.75')); await snap('s2-about-to-flare');
  console.log(await step(0.5, 'w.ysAway1 < 0.2'));
  await page.evaluate(() => new Promise((r) => setTimeout(r, 150)));
  await page.screenshot({ path: path.join(out, 's2-flare.png') });
  // Close up on the lone flame: stand just outside its ring (on the side toward the other flame).
  const nearF1 = () => page.evaluate(() => { const w = window.__ember.scene().world; const f = w.enemies[w.ysF1]; w.player.x = w.player.px = f.x - 175; w.player.y = w.player.py = f.y + 30; });
  await nearF1(); console.log(await step(1.6, 'w.ysAway1 > 1.5')); await snap('c-alone-half');
  await nearF1(); console.log(await step(1.5, 'w.ysAway1 > 2.8')); await snap('c-about-to-flare');
  // Let the game run itself through the flare, so its event reaches the scene's effects.
  await page.evaluate(() => { window.__ember.scene().warp = 1; });
  await page.waitForFunction(() => window.__ember.scene().world.ysAway1 < 0.25, null, { timeout: 20000 });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(out, 'c-flare.png') });
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.evaluate(() => { const w = window.__ember.scene().world; const f = w.enemies[w.ysF1]; w.player.x = w.player.px = f.x - 90; w.player.y = w.player.py = f.y + 30; });
  console.log(await step(0.3)); await snap('c-covered');
  console.log(errs.join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
