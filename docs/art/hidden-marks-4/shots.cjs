// Part 4 hidden-in-3D marks: node shots.cjs <dist> <outDir>   env MODE=scatter|ladle|kiln|home|frost|brood|cave|snow NO3D=1
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
  const MODE = process.env.MODE || 'scatter';
  const DUN = { scatter: 'ashvents', ladle: 'crucible', kiln: 'kiln', home: 'hammerdeep', frost: 'coldmarrow', brood: 'hammerdeep', cave: 'hammerdeep', snow: 'hammerdeep' }[MODE];
  await page.evaluate(([dun]) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: dun, tier: ({ crucible: 9 })[dun] || 7, invulnerable: true, omens: [], party: [{ cls: 'lumen', name: 'Lumen (bot)' }], partySize: 2, fillBots: 1 }, hud: s.hud, onEnd: () => {} }); }, [DUN]);
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
  await page.evaluate(([mode]) => { const s = window.__ember.scene(); s.autopilot = false; s.warp = 0; const w = s.world;
    for (const e of w.enemies) e.alive = false;
    for (const t of w.telegraphs) t.alive = false;
    w.phase = 'fight';
    w.player.x = w.player.px = -60; w.player.y = w.player.py = 120;
    const al = w.heroData(1).player; al.x = al.px = 80; al.y = al.py = 100;
    const kind = { scatter: 'ysmeret', ladle: 'grandmotherSlag', kiln: 'kilnMother', home: 'ondrel', frost: 'nhevra' }[mode];
    if (kind) { const b = w.spawn(kind, 0, -150); w.bossIndex = b; w.bossSpawned = true; const e = w.enemies[b]; e.spawnedAt = w.time - 3; e.abilityT = 99; e.castId = null; window.__b = b; }
  }, [MODE]);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const snap = async (name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(out, MODE + '-' + name + '.png') }); console.log(MODE, name, JSON.stringify(await page.evaluate(() => { const v = window.__ember.scene().hd2d?.stats(); return v ? { calls: v.calls } : null; }))); };
  const cast = (id, f) => ev(([id, f]) => { const w = window.__ember.scene().world, e = w.enemies[window.__b]; e.castId = id; e.castDur = 3; e.castT = 3 * f; e.castName = id; }, [id, f]);
  if (MODE === 'scatter') {
    await ev(() => { const w = window.__ember.scene().world; const al = w.heroData(1).player; al.x = al.px = -60 + 0.85 * 80; al.y = al.py = 120; });
    await cast('scatter', 0.5); await snap('1-tied');
  } else if (MODE === 'ladle') {
    await ev(() => { window.__ember.scene().world.ladleTarget = 0; });
    await cast('ladlePour', 0.5); await snap('1-tipping');
    await cast('ladlePour', 0.9); await snap('2-pouring');
  } else if (MODE === 'kiln') {
    await cast('kilnDraw', 0.8); await snap('1-draw');
  } else if (MODE === 'home') {
    await ev(() => { const w = window.__ember.scene().world; w.bossVariant = 'home'; w.homeStage = 1; w.homeT = 1.2; w.homeX = 10; w.homeY = 10; });
    await snap('1-in-flight');
  } else if (MODE === 'frost') {
    await ev(() => { const w = window.__ember.scene().world; w.player.coal = 1; w.player.coalR = w.coalMaxR; const i = w.spawn('frostWarden', -70, 40); w.enemies[i].spawnedAt = w.time - 3; });
    await snap('1-warmed');
  } else if (MODE === 'brood') {
    await ev(() => { const w = window.__ember.scene().world; const i = w.spawn('ashwall', 20, 20); const e = w.enemies[i]; e.spawnedAt = w.time - 3; e.named = 0; e.affix = 3; e.hp = e.maxHp * 0.5; });
    await snap('1-egg-sacs');
  } else if (MODE === 'cave') {
    await ev(() => { const w = window.__ember.scene().world; w.arenaEvent = 'caveIn'; w.arenaEventStage = 1; w.arenaEventT = 0.44; });
    await snap('1-rocks-falling');
  } else if (MODE === 'snow') {
    await ev(() => { const w = window.__ember.scene().world; w.arenaEvent = 'coldSnap'; w.arenaEventStage = 1; w.arenaEventT = 1; });
    await snap('1-snow');
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
