// Usage: npm run build && node tools/cooppotioncheck.cjs
// Co-op potions: a guest who brews after joining has it used on their own hero in the host's delve.
// Host and guest in one Chromium (same-browser signalling), real WebRTC between them.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const url = `http://127.0.0.1:${srv.address().port}/?localparty=1&seed=5`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  const errs = [];
  const A = await ctx.newPage(); const B = await ctx.newPage();
  for (const [n, p] of [['host', A], ['guest', B]]) p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  await A.goto(url); await B.goto(url); await A.waitForTimeout(800);
  await B.click('[data-cls="bulwark"]');
  await A.click('#hostBtn');
  const code = (await A.textContent('#partyCode')).trim();
  await B.fill('#joinCode', code); await B.click('#joinBtn');
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 2, null, { timeout: 15000 });
  // The guest brews Kindling Brew only now, after joining (embers and one past delve so the hub offers potions).
  await B.evaluate(() => { const h = window.__ember.hero(); h.embers = 500; h.runs = 1; });
  await B.click('[data-cls="emberwright"]'); await B.click('[data-cls="bulwark"]');
  await B.evaluate(() => document.querySelector('[data-potion="kindling"]').click());
  ok(await B.evaluate(() => window.__ember.hero().potion) === 'kindling', 'the guest brewed Kindling Brew after joining');
  await A.waitForTimeout(1500);
  await A.click('#startBtn');
  await B.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  const host = await A.evaluate(() => { const w = window.__ember.scene().world; return { lead: w.hero(0).player.level, guest: w.hero(1).player.level, pending: w.hero(1).player.pendingLevels, cls: w.hero(1).cls }; });
  console.log('host sees', JSON.stringify(host));
  ok(host.cls === 'bulwark' && host.guest === 2 && host.pending >= 1, "the host's delve starts the guest's hero a level up with a pick waiting");
  ok(host.lead === 1, "the host's own hero is not given the guest's potion");
  ok(await B.evaluate(() => window.__ember.hero().potion) === undefined, "the guest's potion is used up by the delve");
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); srv.close();
  process.exit(bad ? 1 : 0);
})();
