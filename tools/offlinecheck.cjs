// Usage: npm run build && node tools/offlinecheck.cjs
// L6 offline: with every request off the page's own host refused (no cloud, no
// leaderboard, no co-op relay), the game must still load, play a delve to its
// end, pay rewards, and keep the hero in local storage across a reload.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const refused = [];
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    refused.push(new URL(u).host); return route.abort('internetdisconnected');
  });
  await ctx.routeWebSocket(/.*/, (ws) => { refused.push('websocket ' + new URL(ws.url()).host); ws.close(); });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; return c; };
  await page.goto(`${origin}/?seed=4`);
  await page.waitForFunction(() => !!window.__ember); await page.waitForTimeout(800);
  ok(await page.isVisible('#startBtn'), 'title screen loads offline');
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.state === 'running', null, { timeout: 15000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 10; });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const w = window.__ember.scene().world; for (const h of w.heroes) h.player.hp = 0; });
  await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('horders.hero.v1') || 'null'));
  ok(saved && saved.runs === 1, 'the delve is saved locally (runs ' + (saved && saved.runs) + ')');
  await page.reload();
  await page.waitForFunction(() => !!window.__ember); await page.waitForTimeout(800);
  const again = await page.evaluate(() => JSON.parse(localStorage.getItem('horders.hero.v1') || 'null'));
  ok(again && again.runs === 1 && again.xp === saved.xp, 'the hero survives a reload offline');
  console.log('refused off-site requests:', JSON.stringify([...new Set(refused)]));
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
  await b.close(); srv.close();
})();
