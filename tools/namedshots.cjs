// Screenshots the C2 named elite look: a Swift, a Warded and a nearly dead Vengeful named
// Cinder Brute, and the flash when one falls. The scene restarts into the Kiln's Brute fight
// and the first elite is promoted by hand (named title 9, "Tinderback").
// Usage: npm run build && node tools/namedshots.cjs <outDir> [phone]
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=4&god=1`);
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const [affix, name] of [[0, 'swift'], [1, 'warded'], [2, 'vengeful']]) {
    await page.evaluate(() => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 4, cls: 'emberwright', dungeon: 'kiln', route: ['brute', 'kilnMother'], tier: 3, invulnerable: true }, hud: s.hud, onEnd: () => {} });
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = false; s.warp = 2; });
    await page.waitForFunction(() => { const w = window.__ember.scene().world; return w.time > 2 && w.enemies.some((e) => e.alive && e.kind === 'cinderBrute'); }, null, { timeout: 30000, polling: 30 });
    await page.evaluate((affix) => {
      const w = window.__ember.scene().world;
      const e = w.enemies.find((o) => o.alive && o.kind === 'cinderBrute');
      e.named = 9; e.affix = affix;
      if (affix === 1) e.ward = e.maxHp * 0.35;
      if (affix === 2) e.hp = e.maxHp * 0.25;
      // Bring it into frame, walking in toward the hero.
      e.x = e.px = w.player.x + 170; e.y = e.py = w.player.y - 30;
      window.__t0 = w.time;
    }, affix);
    // Let it walk in slowly while the fight's intro banner fades, then freeze.
    await page.evaluate(() => { window.__ember.scene().warp = 0.12; });
    await page.waitForTimeout(3500);
    await page.evaluate(() => { window.__ember.scene().warp = 0; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, `${tag}-named-${name}.png`) });
  }
  // The fall: drop its health and run until it dies, then freeze on the flash.
  await page.evaluate(() => { const s = window.__ember.scene(); const e = s.world.enemies.find((o) => o.alive && o.kind === 'cinderBrute'); e.hp = 5; s.autopilot = true; s.warp = 1; });
  await page.waitForFunction(() => !window.__ember.scene().world.enemies.some((o) => o.alive && o.kind === 'cinderBrute'), null, { timeout: 15000, polling: 10 }).catch(() => errs.push('no kill'));
  await page.waitForTimeout(120);
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.screenshot({ path: path.join(out, `${tag}-named-kill.png`) });
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
