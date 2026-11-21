// Usage: npm run build && node tools/againcheck.cjs
// Three delves in a row in one page: "Delve again" from the end screen, then back through
// "Main menu" and Delve. Each restart reuses the same GameScene object, so a list of game
// objects that init() doesn't empty crashes the next create() (the #101 gate labels, fixed in
// #108). tests/scene-restart.test.ts guards the same thing in CI. Exits 1 on any failure.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/supabase\.co/, (r) => r.abort());
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5`);
  await page.waitForTimeout(500);
  let ok = true;
  for (const [n, how] of [[1, 'start'], [2, 'again'], [3, 'menu']]) {
    if (how === 'start') await page.click('#startBtn');
    else if (how === 'again') await page.click('#againBtn');
    else { await page.click('#menuBtn'); await page.waitForTimeout(300); await page.click('#startBtn'); }
    // Started means the sim is ticking past the intro, not just constructed.
    const started = await page.waitForFunction(() => { const w = window.__ember.scene()?.world; return w && w.state !== 'ended' && w.time > 1; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    console.log(`delve ${n} (${how}): ${started ? 'started' : 'NEVER STARTED'}`);
    if (!started) { ok = false; break; }
    // End it fast: the hero falls, and the end screen comes up.
    await page.evaluate(() => { const s = window.__ember.scene(); s.autoPick = true; s.warp = 10; s.world.player.hp = 0; });
    if (!await page.waitForSelector('#end:not([hidden])', { timeout: 30000 }).then(() => true).catch(() => false)) { console.log(`delve ${n}: no end screen`); ok = false; break; }
    await page.waitForTimeout(400);
  }
  if (errs.length) { console.log('page errors:', errs); ok = false; }
  console.log(ok ? 'PASS' : 'FAIL');
  await b.close(); srv.close();
  process.exit(ok ? 0 : 1);
})();
