// Raid trash cost, four heroes: node shots.cjs <dist> <outDir>   env SEEDS=4 (one seed a run), RT=0 for trash off
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${process.env.SEED || 8}&god=1${process.env.NO3D ? '' : '&hd2d=1'}`);
  await page.waitForTimeout(600);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0 && window.__ember.scene().hd2d, null, { timeout: 120000 });
  for (const seed of (process.env.SEEDS || '1,2,3').split(',').map(Number)) {
    await page.evaluate(([seed, RT]) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed, cls: 'emberwright', dungeon: 'crucible', tier: 8, invulnerable: true, halls: true, hallsBeta: true, raidTrash: RT, party: [{ cls: 'bulwark' }, { cls: 'lumen' }, { cls: 'duskblade' }], partySize: 4, fillBots: 3 }, hud: s.hud, onEnd: () => {} }); }, [seed, process.env.RT !== '0']);
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 5, null, { timeout: 300000 });
    const packs = await page.evaluate(() => window.__ember.scene().world.halls.packs.map((p, k) => ({ k, enc: p.enc, role: p.role, n: p.foes.length, room: p.room })));
    console.log(JSON.stringify({ heroes: await page.evaluate(() => window.__ember.scene().world.heroes.length), packs }));
    for (const pk of packs) {
      const n = await page.evaluate((k) => {
        const s = window.__ember.scene(), w = s.world, m = w.halls, p = m.packs[k];
        s.autopilot = true; s.warp = 0;
        for (const e of w.enemies) e.alive = false;
        for (const t of w.telegraphs) t.alive = false;
        for (const q of m.packs) if (q !== p && q.state === 'awake') q.state = 'cleared';
        p.state = 'asleep';
        w.player.x = w.player.px = p.x; w.player.y = w.player.py = p.y + 150;
        for (let h = 1; h < w.heroes.length; h++) { const q = w.heroData(h).player; q.x = q.px = p.x + (h - 2) * 60; q.y = q.py = p.y + 190; }
        w.hallsWake(k);
        for (const e of w.enemies) if (e.alive) e.spawnedAt = w.time - 3;
        return w.enemies.filter((e) => e.alive).length;
      }, pk.k);
      await page.evaluate(() => { window.__ember.scene().warp = 1; });
      await page.waitForTimeout(4000);
      await page.evaluate(() => { window.__ember.scene().warp = 0; });
      await page.waitForTimeout(1200);
      const st = await page.evaluate(() => { const w = window.__ember.scene().world; return { calls: window.__ember.scene().hd2d?.stats().calls, alive: w.enemies.filter((e) => e.alive).length }; });
      const name = `s${seed}-p${pk.k}-${pk.role}-${pk.enc}`;
      await page.screenshot({ path: path.join(out, name + '.png') });
      console.log(name, 'foes', n, JSON.stringify(st));
    }
  }
  console.log(errs.join(' | ') || 'no errors');
  await b.close(); srv.close();
})();
