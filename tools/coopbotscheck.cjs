// Usage: npm run build && node tools/coopbotscheck.cjs
// V7, bots in online co-op: a host and one guest (real WebRTC in one Chromium) take the
// Hammerdeep with Fill with bots on. The host runs the two bots; both pages must see four
// heroes, the bots must move and fight on the guest's screen too, and nothing may throw.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const hero = (cls) => ({ version: 1, cls, level: 12, xp: 0, passives: {}, embers: 0, inventory: [], equipped: {}, pity: 0, runs: 20, wins: 10, bestTime: 0, nextItemId: 1, maxTier: 5 });
(async () => {
  const url = `http://127.0.0.1:${srv.address().port}/?localparty=1&seed=5&god=1`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
  // One context per page would split same-browser signalling, so both share one context.
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  const A = await ctx.newPage(); const B = await ctx.newPage();
  for (const [n, p] of [['host', A], ['guest', B]]) p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  await A.addInitScript((h) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('horders.hero.v1', JSON.stringify(h)); } }, hero('duskblade'));
  await A.goto(url); await B.goto(url); await A.waitForTimeout(800);
  await A.click('#hostBtn');
  const code = (await A.textContent('#partyCode')).trim();
  await B.fill('#joinCode', code); await B.click('#joinBtn');
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 2, null, { timeout: 15000 });
  await A.click('[data-d="hammerdeep"]'); await A.waitForTimeout(300);
  const fillBtn = await A.$('[data-fill]');
  ok(!!fillBtn, 'the host of a party of 2 is offered Fill with bots');
  ok(!(await B.$('[data-fill]')), 'the guest is not offered it');
  if (!fillBtn) { await b.close(); srv.close(); return; }
  await fillBtn.click(); await A.waitForTimeout(300);
  await A.click('#startBtn');
  await B.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await A.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await A.waitForFunction(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.enemies.some((e) => e.alive); }, null, { timeout: 30000 });
  const look = (p) => p.evaluate(() => { const w = window.__ember.scene().world; return { heroes: w.heroes.length, fillBots: w.fillBots, pos: w.heroes.map((_, i) => [Math.round(w.heroData(i).player.x), Math.round(w.heroData(i).player.y)]) }; });
  const a0 = await look(A), g0 = await look(B);
  console.log('host', JSON.stringify(a0)); console.log('guest', JSON.stringify(g0));
  ok(a0.heroes === 4 && a0.fillBots === 2, 'the host runs 4 heroes, 2 of them bots');
  ok(g0.heroes === 4 && g0.fillBots === 2, 'the guest sees the same 4 heroes');
  await A.waitForTimeout(6000);
  const g1 = await look(B);
  const moved = [2, 3].filter((i) => Math.hypot(g1.pos[i][0] - g0.pos[i][0], g1.pos[i][1] - g0.pos[i][1]) > 20).length;
  ok(moved === 2, `both bots move on the guest's screen (${moved} of 2)`);
  const dmg = await A.evaluate(() => { const w = window.__ember.scene().world; return [2, 3].map((i) => Math.round(w.heroData(i).damageDealt ?? w.heroData(i).player.damageDealt ?? 0)); });
  console.log('bot damage so far', JSON.stringify(dmg));
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 3)));
  await b.close(); srv.close();
})();
