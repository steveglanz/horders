// Readability pass (Y9): the first bosses players meet, at a 360 px wide phone. For each boss, one shot in the
// open fight and one while a telegraph is on the floor, solo Emberwright, frozen between hits with the banner
// hidden. Usage: npm run build && node tools/bossreadshots.cjs <outDir> [tag] [later]
// (later: Ondrel, Ysmeret, Nhevra, Hessa and Oskel instead of the first three; pile: Nhevra once 6 or more Snuffers
// crowd together on screen, the Snuffer Tide's pile of elite bars and names)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const tag = process.argv[3] && !['later', 'pile'].includes(process.argv[3]) ? process.argv[3] : 'p360';
const pile = process.argv.includes('pile');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const FIRST = [['kiln', 'kilnMother', 3], ['foundry', 'maelra', 5], ['glarewell', 'lensmother', 7]];
const LATER = [['hammerdeep', 'ondrel', 4], ['ashvents', 'ysmeret', 7], ['coldmarrow', 'nhevra', 10], ['wrackline', 'hessa', 13], ['pressworks', 'oskel', 10]];
const BOSSES = pile ? [['coldmarrow', 'nhevra', 10]] : process.argv.includes('later') ? LATER : FIRST;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const [dungeon, boss, tier] of BOSSES) {
    for (const when of pile ? ['pile'] : ['open', 'tele']) {
      await page.evaluate(({ dungeon, boss, tier }) => {
        const s = window.__ember.scene();
        const b = document.getElementById('banner'); if (b) b.style.visibility = '';
        s.scene.restart({ opts: { seed: 5, cls: 'emberwright', dungeon, route: [boss], tier, invulnerable: true }, hud: s.hud, onEnd: () => {} });
      }, { dungeon, boss, tier });
      await page.waitForTimeout(700);
      await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
      await page.waitForFunction(({ boss, when }) => {
        const s = window.__ember.scene(); const w = s.world;
        const e = w.enemies.find((o) => o.alive && o.kind === boss);
        if (!e || w.time - e.spawnedAt < 4) return false;
        const near = Math.hypot(e.x - w.player.x, e.y - w.player.y) < 300;
        const tele = w.telegraphs.some((t) => t.alive && t.t / t.dur > 0.4);
        if (when === 'pile') {
          const sn = w.enemies.filter((o) => o.alive && o.kind === 'snuffer' && Math.abs(o.x - w.player.x) < 150 && Math.abs(o.y - w.player.y) < 300);
          return sn.some((a) => sn.filter((o) => Math.hypot(o.x - a.x, o.y - a.y) < 110).length >= 6) && !(s.warp = 0);
        }
        return near && (when === 'tele' ? tele : !tele) && !(s.warp = 0);
      }, { boss, when }, { timeout: 90000, polling: 'raf' }).catch(() => errs.push(`timeout ${boss} ${when}`));
      await page.evaluate(() => { window.__ember.scene().world.enemies.forEach((e) => { e.flash = -1; }); const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `${tag}-${boss}-${when}.png`) });
    }
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
