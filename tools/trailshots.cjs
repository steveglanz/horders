// Screenshots the season trails behind a moving hero: Bellows Sparks at stages 1, 2 and 3
// (stage 3 just after a dash), and all four seasons' trails at stage 2. No network.
// Usage: npm run build && node tools/trailshots.cjs <outDir> [saver]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots'; const saver = process.argv.includes('saver');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const SHOTS = [
  { name: 'bellows-1', id: 'bellowsSparks', stage: 1, cls: 'emberwright' },
  { name: 'bellows-2', id: 'bellowsSparks', stage: 2, cls: 'emberwright' },
  { name: 'bellows-3-dash', id: 'bellowsSparks', stage: 3, cls: 'duskblade', dash: true },
  { name: 'salt-2', id: 'saltMist', stage: 2, cls: 'lumen' },
  { name: 'rime-2', id: 'rimeDust', stage: 2, cls: 'bulwark' },
  { name: 'slag-2', id: 'slagDrips', stage: 2, cls: 'slagbinder' },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  if (saver) await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'saver' })));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sh of SHOTS) {
    await page.evaluate((sh) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 7, cls: sh.cls, dungeon: 'kiln', tier: 3, invulnerable: true }, hud: s.hud, onEnd: () => {}, trail: { id: sh.id, stage: sh.stage } });
    }, sh);
    await page.waitForTimeout(600);
    await page.evaluate((sh) => {
      const s = window.__ember.scene();
      // The dash shot lets the bot fight until it dashes, then freezes the scene 120 ms later (a software-GL
      // screenshot takes longer than the motes live); the others walk the hero up-right with W and D.
      s.autopilot = !!sh.dash; s.autoPick = true;
      window.__dashAt = 0;
      if (sh.dash) { const orig = s.trailDash.bind(s); s.trailDash = (...a) => { orig(...a); if (s.trail && Math.hypot(a[2] - s.world.player.x, a[3] - s.world.player.y) <= 4) { window.__dashAt = performance.now(); window.__dashLen = Math.round(Math.hypot(a[2] - a[0], a[3] - a[1])); s.trailDash = orig; setTimeout(() => s.scene.pause(), 120); } }; }
    }, sh);
    if (sh.dash) {
      await page.waitForFunction(() => window.__dashAt && performance.now() - window.__dashAt > 90, null, { timeout: 60000, polling: 30 }).catch(() => errs.push(`${sh.name}: no dash`));
    } else {
      // Walk up-right for 1.4 s, so the trail runs down-left behind the hero.
      await page.keyboard.down('d'); await page.keyboard.down('w');
      await page.waitForTimeout(1400);
    }
    await page.screenshot({ path: path.join(out, `trail-${sh.name}${saver ? '-saver' : ''}.png`), clip: { x: 440, y: 230, width: 400, height: 260 } });
    if (!sh.dash) { await page.keyboard.up('d'); await page.keyboard.up('w'); }
    else console.log(sh.name, await page.evaluate(() => ({ dashLen: window.__dashLen, liveMotes: window.__ember.scene().trailFx.filter((f) => f.life > 0).length })));
    if (sh.dash) await page.evaluate(() => window.__ember.scene().scene.resume());
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
