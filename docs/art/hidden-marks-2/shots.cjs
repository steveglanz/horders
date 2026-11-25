// Revive, vent and Anvilfall marks in 3D: node shots.cjs <dist> <outDir>   env NO3D=1 LAND=1
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
  const MODE = process.env.MODE || 'revive';
  const DUN = { revive: 'hammerdeep', vents: 'ashvents', anvil: 'hammerdeep', flue: 'flue', smeltery: 'smeltery', hoard: 'hoard' }[MODE];
  await page.evaluate(([dun]) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: dun, tier: ({ flue: 11, smeltery: 10, hoard: 9 })[dun] || 7, invulnerable: true, omens: [], party: [{ cls: 'lumen', name: 'Lumen (bot)' }], partySize: 2, fillBots: 1 }, hud: s.hud, onEnd: () => {} }); }, [DUN]);
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
  await page.evaluate(([mode]) => { const s = window.__ember.scene(); s.autopilot = false; s.warp = 0; const w = s.world;
    for (const e of w.enemies) e.alive = false;
    for (const t of w.telegraphs) t.alive = false;
    w.phase = 'fight';
    w.player.x = w.player.px = -60; w.player.y = w.player.py = 120;
    const al = w.heroData(1).player; al.x = al.px = 80; al.y = al.py = 100;
    const kind = { vents: 'ysmeret', flue: 'regent', smeltery: 'colossus', hoard: 'vorhulm' }[mode] || 'ondrel';
    const b = w.spawn(kind, 0, -150); w.bossIndex = b; w.bossSpawned = true; window.__b = b; const e = w.enemies[b]; e.spawnedAt = w.time - 3; e.abilityT = 99; e.castId = null;
  }, [MODE]);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const snap = async (name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(out, MODE + '-' + name + '.png') }); console.log(MODE, name, JSON.stringify(await page.evaluate(() => { const v = window.__ember.scene().hd2d?.stats(); return v ? { calls: v.calls, tri: v.triangles } : null; }))); };
  await snap('0-base');
  if (MODE === 'revive') {
    await ev(() => { const w = window.__ember.scene().world; const al = w.heroData(1).player; al.hp = 0; al.reviveT = 0; w.bossRevives = 0; });
    await snap('1-down-calling');
    await ev(() => { const w = window.__ember.scene().world; const al = w.heroData(1).player; w.player.x = w.player.px = al.x - 38; w.player.y = w.player.py = al.y + 4; al.reviveT = w.reviveSeconds * 0.55; });
    await snap('2-reviving');
    await ev(() => { const w = window.__ember.scene().world; const al = w.heroData(1).player; al.reviveT = 0; w.bossRevives = 99; w.player.x = w.player.px = -60; w.player.y = w.player.py = 120; });
    await snap('3-no-revive');
  } else if (MODE === 'vents') {
    await ev(() => { const w = window.__ember.scene().world; for (const [x, y] of [[-60, 120], [150, 40]]) w.addTelegraph('circle', x, y, 70, 0, 0, 6, 40, 'soak', -2); for (const t of w.telegraphs) if (t.alive) t.t = 2.5; });
    await snap('1-one-covered-one-empty');
  } else if (MODE === 'flue') {
    await ev(() => { const w = window.__ember.scene().world; w.regentDecree = [{ hero: 0, t: 5, passes: 0, held: 0 }]; w.heroData(1).player.spentT = 3; });
    await snap('1-decree-and-spent');
    await ev(() => { const w = window.__ember.scene().world; w.regentDecree[0].t = 1.5; });
    await snap('2-decree-late');
  } else if (MODE === 'smeltery') {
    await ev(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__b]; e.castId = 'wheel'; e.castName = 'Wheel'; e.castDur = 3; e.castT = 1.5; });
    await snap('1-wheel');
    await ev(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__b]; e.castId = null; w.bossPhase = 3; });
    await snap('2-meltdown');
  } else if (MODE === 'hoard') {
    await ev(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__b]; e.castId = 'coalGorge'; e.castName = 'Coal Gorge'; e.castDur = 3; e.castT = 1.5; });
    await snap('1-coal-gorge');
    await ev(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__b]; e.castId = null; const c = w.spawn('craw', e.x + 60, e.y + 40); w.enemies[c].spawnedAt = w.time - 3; const al = w.heroData(1).player; al.swallowT = 4; al.x = al.px = e.x; al.y = al.py = e.y + 10; });
    await snap('2-craw-swallowed');
  } else {
    await ev(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__b]; e.castId = 'anvilfall'; e.castName = 'Anvilfall'; e.castDur = 2.5; e.castT = 1.0; });
    await snap('1-anvil-falling');
    await ev(() => { const w = window.__ember.scene().world; const e = w.enemies[window.__b]; e.castT = 2.3; });
    await snap('2-anvil-landing');
  }
  console.log(errs.join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
