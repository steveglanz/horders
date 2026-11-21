// Frame-rate check for the lasting ability effects: a 4-hero Hammerdeep party with every lasting
// effect forced on every 500 ms, iPhone 13 viewport, 4x CPU throttle, swiftshader (software GL).
// Usage: npm run build && node tools/fxperf.cjs dist <auto|saver|full>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve(process.argv[2], 'index.html')); const GFX = process.argv[3];
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const party = [{ cls: 'slagbinder' }, { cls: 'lumen' }, { cls: 'bulwark' }, { cls: 'duskblade' }];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const scen of ['on', 'on']) {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    await ctx.addInitScript((g) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: g })), GFX);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
    await page.evaluate((party) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 5, cls: 'slagbinder', dungeon: 'hammerdeep', tier: 6, invulnerable: true, alt: true, party }, hud: s.hud, onEnd: () => {} }); }, party);
    await page.waitForTimeout(800);
    await page.evaluate((scen) => {
      const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true;
      if (scen === 'on') setInterval(() => {
        const w = s.world; const t = w.time; const p = w.player;
        for (let k = 0; k < w.heroes.length; k++) { const q = w.heroData(k).player; q.cryUntil = t + 2; q.shellUntil = t + 2; q.plate = 30; q.plateAmt = 40; q.plateUntil = t + 2; q.plateBy = k === 1 ? -1 : 0; }
        p.wellUntil = t + 2; p.wellX = p.x - 60; p.wellY = p.y; const a = w.heroData(1).player; a.pitUntil = t + 2; a.pitX = p.x + 80; a.pitY = p.y;
        let n = 0; for (const e of w.enemies) if (e.alive && n++ < 40) { e.slowUntil = t + 2; e.slowMult = 0.4; e.brittleUntil = t + 2; }
      }, 500);
    }, scen);
    await page.waitForFunction(() => window.__ember.scene().world.phase === 'fight', null, { timeout: 30000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.waitForTimeout(12000);
    const r = await page.evaluate(() => { const s = window.__ember.scene(); const f = s.fps(); return { fps: f.avg.toFixed(1), p95ms: f.p95ms.toFixed(1), gameCodeMs: s.workMs().toFixed(2), lowFx: s.lowFx, enemies: s.world.aliveEnemies }; });
    console.log(process.argv[2].split('/').pop(), GFX, scen, JSON.stringify(r));
    await ctx.close();
  }
  await b.close(); srv.close();
})();
