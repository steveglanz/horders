// Kill-heavy effects check: the 600-foe stress scene (iPhone 13, 4x CPU throttle) with 30 kill effects
// a second and a Rare drop every second played on top. Reports fps, game code ms and live particles.
// Usage: npm run build && node tools/killperf.cjs dist <auto|saver|full>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.join(process.argv[2], 'index.html')); const GFX = process.argv[3];
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (let run = 0; run < 2; run++) {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    await ctx.addInitScript((g) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: g })), GFX);
    const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    await page.goto(`http://127.0.0.1:${srv.address().port}/?stress=1&seed=3`);
    await page.waitForFunction(() => window.__ember.scene() && window.__ember.scene().world.aliveEnemies >= 550, null, { timeout: 30000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    // Play 30 kill effects a second (the 'kill' event's death + burst) on foes on screen, plus a Rare drop every second.
    await page.evaluate(() => { const s = window.__ember.scene(); let t = 0; setInterval(() => { const v = s.cameras.main.worldView; const es = s.world.enemies.filter((e) => e.alive && v.contains(e.x, e.y)); for (let k = 0; k < 3 && es.length; k++) { const e = es[(Math.random() * es.length) | 0]; s.death(e.kind, e.x, e.y); s.burst(e.x, e.y, 4); } if (++t % 10 === 0) { const p = s.world.player; s.dropFlourish(p.x + 40, p.y, 'rare'); } }, 100); });
    const k0 = await page.evaluate(() => { const s = window.__ember.scene(); window.__live = []; setInterval(() => window.__live.push(s.fx.filter((f) => f.life > 0).length + s.smoke.filter((f) => f.life > 0).length), 100); return s.world.kills; });
    await page.waitForTimeout(12000);
    const r = await page.evaluate(() => { const s = window.__ember.scene(); const f = s.fps(); return { fps: f.avg.toFixed(1), p95ms: f.p95ms.toFixed(1), gameCodeMs: s.workMs().toFixed(2), lowFx: s.lowFx, kills: s.world.kills, liveFx: (window.__live.reduce((a, b) => a + b, 0) / window.__live.length).toFixed(1) }; });
    r.kills -= k0;
    console.log(path.basename(process.argv[2]), GFX, JSON.stringify(r));
    await ctx.close();
  }
  await b.close(); srv.close();
})();
