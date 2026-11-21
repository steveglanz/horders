// Usage: npm run build && node tools/twodelves.cjs
// Back-to-back delves in one session: play a run to its end with the autopilot,
// go back to the menu, start a second delve, and check it runs with no page errors.
// Then the same with "Delve again" from the end screen.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=4`);
  await page.waitForFunction(() => !!window.__ember); await page.waitForTimeout(800);
  const play = async (label) => {
    await page.waitForFunction(() => window.__ember.scene()?.world?.state === 'running', null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 10; });
    const t0 = await page.evaluate(() => window.__ember.scene().world.tick);
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => { const w = window.__ember.scene().world; return { tick: w.tick, state: w.state }; });
    console.log(label, JSON.stringify(r), 'advanced', r.tick - t0, 'ticks');
    return r.tick > t0;
  };
  const end = () => page.evaluate(() => { const w = window.__ember.scene().world; for (const h of w.heroes) h.player.hp = 0; });
  const ok = (c, m) => {
    console.log(c ? 'ok  ' : 'FAIL', m);
    if (!c) { console.log('page errors so far:', JSON.stringify(errs.slice(0, 3))); process.exitCode = 1; }
    return c;
  };
  await page.click('#startBtn');
  ok(await play('delve 1'), 'first delve runs');
  await end();
  await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
  await page.click('#menuBtn');
  await page.waitForSelector('#startBtn', { state: 'visible' });
  await page.click('#startBtn');
  if (!ok(await play('delve 2 (from the menu)'), 'second delve from the menu runs')) { await b.close(); srv.close(); return; }
  await end();
  await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
  await page.click('#againBtn');
  ok(await play('delve 3 (Delve again)'), 'third delve from Delve again runs');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
  await b.close(); srv.close();
})();
