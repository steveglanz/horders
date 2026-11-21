// Usage: npm run build && node tools/coopcheck.cjs [screenshot dir]
// Host and guest in one Chromium (same-browser signalling), real WebRTC between them.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const url = `http://127.0.0.1:${srv.address().port}/?localparty=1&seed=5`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  const errs = [];
  const A = await ctx.newPage(); const B = await ctx.newPage();
  for (const [n, p] of [['host', A], ['guest', B]]) p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  await A.goto(url); await B.goto(url); await A.waitForTimeout(800);
  // Make the guest a Bulwark so the two heroes differ.
  await B.click('[data-cls="bulwark"]');
  await A.click('#hostBtn');
  const code = (await A.textContent('#partyCode')).trim();
  await B.fill('#joinCode', code); await B.click('#joinBtn');
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 2, null, { timeout: 15000 });
  console.log('linked; host sees:', await A.$$eval('#coop li', (l) => l.map((x) => x.textContent)));
  console.log('guest sees:', await B.$$eval('#coop li', (l) => l.map((x) => x.textContent)), '| guest button:', await B.textContent('#startBtn'), await B.$eval('#startBtn', (x) => x.disabled));
  console.log('host button:', await A.textContent('#startBtn'));
  await A.click('#startBtn');
  await B.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await A.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 4; });
  await A.waitForFunction(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.enemies.some((e) => e.alive); }, null, { timeout: 30000 });
  await A.evaluate(() => { window.__ember.scene().warp = 1; });
  let seen = 0;
  for (let k = 0; k < 6 && !seen; k++) {
    await B.keyboard.press('e'); await B.waitForTimeout(150);
    seen = Number(await A.evaluate(() => window.__ember.scene().world.hero(1).player.cds[1].toFixed(2)));
    await B.waitForTimeout(350);
  }
  console.log('host sees guest Charge (E) cooldown:', seen, '| guest HUD reads', await B.evaluate(() => window.__ember.scene().world.player.cds[1].toFixed(2)));
  await A.evaluate(() => { window.__ember.scene().warp = 4; });
  await B.screenshot({ path: (process.argv[2] || 'tools/shots') + '/coop-guest-near.png' });
  const st = (p) => p.evaluate(() => { const w = window.__ember.scene().world; return { tick: w.tick, state: w.state, phase: w.phase, me: w.acting, cls: w.cls, hp: Math.round(w.player.hp), enemies: w.enemies.filter((e) => e.alive).length, heroes: w.heroes.length, lvl: w.player.level, choices: w.choices.length }; });
  let picks = 0; const t0 = Date.now();
  while (Date.now() - t0 < 70000) {
    // The guest walks right and picks the first card whenever one is offered.
    if (await B.isVisible('#draft') && await B.$('#cards .card')) { await B.click('#cards .card'); picks++; }
    await B.waitForTimeout(500);
    const a = await st(A);
    if (a.state === 'ended') break;
  }
  await B.keyboard.up('d');
  const a = await st(A), g = await st(B);
  console.log('host ', JSON.stringify(a));
  console.log('guest', JSON.stringify(g), 'picks', picks);
  const pos = await B.evaluate(() => { const w = window.__ember.scene().world; return [w.player.x, w.hero(0).player.x].map(Math.round); });
  const hpos = await A.evaluate(() => { const w = window.__ember.scene().world; return [w.hero(1).player.x, w.player.x].map(Math.round); });
  console.log('guest view [me x, host x]', pos, '| host view [guest x, host x]', hpos);
  await A.screenshot({ path: (process.argv[2] || 'tools/shots') + '/coop-host.png' }); await B.screenshot({ path: (process.argv[2] || 'tools/shots') + '/coop-guest.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.close();
})();
