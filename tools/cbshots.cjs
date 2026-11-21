// Colour-blind check: one frozen scene with every kind of telegraph (attack circle and cone,
// soak, bloom) beside the newer friendly effects that sit on the floor (a burn zone, Slag Pit,
// Lightwell, Rallying Cry, slowed foes), in the standard and colour-blind palettes.
// tools/cbsim.py then renders each shot as seen with deuteranopia, protanopia and tritanopia.
// Usage: npm run build && node tools/cbshots.cjs <outDir> [phone] && python3 tools/cbsim.py <outDir>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  for (const pal of ['standard', 'colorblind']) {
    await page.addInitScript((p) => { try { localStorage.setItem('horders.display.v1', JSON.stringify({ palette: p })); } catch {} }, pal);
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=4&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
    await page.evaluate(() => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 4, cls: 'slagbinder', dungeon: 'kiln', tier: 3, invulnerable: true, party: [{ cls: 'slagbinder' }, { cls: 'lumen' }] }, hud: s.hud, onEnd: () => {} });
    });
    await page.waitForTimeout(800);
    await page.waitForFunction(() => window.__ember.scene()?.world?.phase === 'fight', null, { timeout: 30000 });
    await page.evaluate(() => {
      const s = window.__ember.scene(); s.warp = 0;
      const w = s.world; const p = w.player; const t = w.time;
      const foes = w.enemies.filter((e) => e.alive);
      // Hostile telegraphs, one of each.
      w.addTelegraph('circle', p.x - 170, p.y - 60, 80, 0, 0, 10, 0, 'hit');
      w.addTelegraph('cone', p.x + 40, p.y - 40, 190, -0.5, 1.1, 10, 0, 'hit');
      w.addTelegraph('circle', p.x - 40, p.y + 170, 65, 0, 0, 10, 0, 'soak');
      w.addTelegraph('circle', p.x + 190, p.y + 150, 60, 0, 0, 10, 0, 'bloom');
      for (const tg of w.telegraphs) if (tg.alive) tg.t = tg.dur * 0.5;
      // Friendly floor effects: a Slag Pit with slowed foes in it, a Lightwell, Rallying Cry on the party.
      p.pitUntil = t + 5; p.pitX = p.x + 170; p.pitY = p.y - 120;
      foes.slice(0, 3).forEach((e, i) => { e.x = p.pitX + (i - 1) * 40; e.y = p.pitY + (i % 2) * 20; e.slowUntil = t + 4; e.slowMult = 0.4; });
      const a = w.heroData(1).player; a.wellUntil = t + 6; a.wellX = p.x - 190; a.wellY = p.y + 110;
      for (let k = 0; k < w.heroes.length; k++) w.heroData(k).player.cryUntil = t + 5;
      // A friendly burn patch (Emberwright Blink and Flame Wave leave these).
      w.zones.find((z) => !z.alive) && Object.assign(w.zones.find((z) => !z.alive), { alive: true, x: p.x + 60, y: p.y + 70, r: 44, dps: 1, life: 3, maxLife: 3, tickT: 0, owner: 0 });
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-cb-${pal}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
