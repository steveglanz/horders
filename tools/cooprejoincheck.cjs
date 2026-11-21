// Usage: npm run build && node tools/cooprejoincheck.cjs [--host-gone]
// --host-gone: instead, the host's page just closes; the guest retries, gives up (about 35 s) and keeps the delve's credit.
// The host runs ?god=1 so the party can't wipe while the guest is away.
// A guest whose link to the host drops mid-delve reconnects and gets their own hero back;
// a host who closes the party on purpose ends it at once (no retries).
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
  await A.goto(url + '&god=1'); await B.goto(url); await A.waitForTimeout(800);
  await B.click('[data-cls="bulwark"]');
  await A.click('#hostBtn');
  const code = (await A.textContent('#partyCode')).trim();
  await B.fill('#joinCode', code); await B.click('#joinBtn');
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 2, null, { timeout: 15000 });
  await A.click('#startBtn');
  await B.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await A.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 4; });
  // Play a little: the guest takes the first card whenever a draft is up.
  for (let k = 0; k < 120; k++) {
    if (await B.isVisible('#draft') && await B.$('#cards .card')) await B.click('#cards .card');
    const w = await A.evaluate(() => { const w = window.__ember.scene().world; return { tick: w.tick, state: w.state, phase: w.phase }; });
    if (w.tick > 1500 && w.state === 'running' && w.phase === 'fight') break;
    await B.waitForTimeout(400);
  }
  const before = await A.evaluate(() => { const w = window.__ember.scene().world; return { tick: w.tick, lvl: w.hero(1).player.level, cls: w.hero(1).cls }; });
  const oldId = await B.evaluate(() => window.__ember.coop().party.id);

  if (process.argv.includes('--host-gone')) {
    const runsBefore = await B.evaluate(() => window.__ember.hero().runs);
    await A.close();
    const t0 = Date.now();
    const gaveUp = await B.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 45000 }).then(() => true, () => false);
    ok(gaveUp, `the guest gave up and is back at the menu after ${Date.now() - t0} ms`);
    ok(await B.evaluate(() => document.querySelector('#coop .cnote')?.textContent) === 'Lost the connection to the party.', 'the party box says the connection was lost');
    ok(await B.evaluate(() => window.__ember.hero().runs) === runsBefore + 1, 'the delve so far is credited to the guest');
    ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
    await b.close(); srv.close();
    process.exit(bad ? 1 : 0);
  }

  // Cut the guest's link (as a phone losing signal would): its data channels close, nobody says goodbye.
  await B.evaluate(() => { for (const l of window.__ember.coop().party.links.values()) { l.rel.close(); l.fast.close(); } });
  await B.waitForFunction(() => document.getElementById('banner')?.textContent.includes('Reconnecting'), null, { timeout: 5000 }).then(() => ok(true, 'the guest sees "Reconnecting"'), () => ok(false, 'the guest sees "Reconnecting"'));
  ok(await B.evaluate(() => document.getElementById('title').hidden), 'the guest stays in the delve while reconnecting');

  const t0 = Date.now();
  const back = await B.waitForFunction((id) => { const c = window.__ember.coop(); return c && c.party.id !== id && c.me > 0 && window.__ember.scene()?.world?.tick > 0 ? c.me : 0; }, oldId, { timeout: 30000 }).then((h) => h.jsonValue(), () => 0);
  ok(back === 1, `the guest rejoined as hero ${back} in ${Date.now() - t0} ms`);
  await B.waitForTimeout(1500);
  const after = await A.evaluate(() => { const w = window.__ember.scene().world; return { tick: w.tick, lvl: w.hero(1).player.level, cls: w.hero(1).cls, state: w.state, heroes: w.heroes.length }; });
  const g = await B.evaluate(() => { const w = window.__ember.scene().world; return { tick: w.tick, lvl: w.player.level, cls: w.cls, me: w.acting }; });
  console.log('host', JSON.stringify(after), '| guest', JSON.stringify(g));
  ok(after.tick > before.tick && after.state !== 'ended', 'the host kept the delve running');
  ok(after.heroes === 2 && after.cls === 'bulwark' && after.lvl >= before.lvl, "the host's hero 1 is still the guest's Bulwark, level kept");
  ok(g.cls === 'bulwark' && g.lvl === after.lvl && Math.abs(g.tick - after.tick) < 200, "the guest's mirror caught up with the host's delve");
  // The rejoined guest steers hero 1 again.
  await A.evaluate(() => { window.__ember.scene().warp = 1; });
  const x0 = await A.evaluate(() => window.__ember.scene().world.hero(1).player.x);
  await B.bringToFront(); await B.keyboard.down('d'); await B.waitForTimeout(1500); await B.keyboard.up('d');
  const x1 = await A.evaluate(() => window.__ember.scene().world.hero(1).player.x);
  ok(x1 - x0 > 20, `the guest's input moves hero 1 on the host again (${Math.round(x0)} -> ${Math.round(x1)})`);

  // The host leaves on purpose: the guest goes to the menu at once, with no retries.
  await A.evaluate(() => window.__ember.coop().close());
  const ended = await B.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 5000 }).then(() => true, () => false);
  ok(ended, 'when the host closes the party, the guest is back at the menu within 5 s');
  ok(await B.evaluate(() => window.__ember.coop() === null), 'and no rejoin is attempted');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); srv.close();
  process.exit(bad ? 1 : 0);
})();
