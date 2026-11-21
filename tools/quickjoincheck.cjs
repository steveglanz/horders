// Usage: npm run build && node tools/quickjoincheck.cjs [screenshot dir]
// Quick join in one Chromium (same-browser lobby and signalling):
// 1) A and B press Quick join together with nothing open: they end up in ONE party.
// 2) C presses Quick join and lands in that party.
// 3) An open party started by Host a party + the checkbox is found too; an unticked one is not.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const dir = process.argv[2] || 'tools/shots';
(async () => {
  const url = `http://127.0.0.1:${srv.address().port}/?localparty=1&seed=5`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 900 } });
  const errs = [];
  const page = async (n) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(n + ': ' + e.message)); await p.goto(url); return p; };
  const [A, B, C] = [await page('A'), await page('B'), await page('C')];
  await A.waitForTimeout(800);
  const heroes = (p) => p.$$eval('#coop li', (l) => l.map((x) => x.textContent));
  const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };

  await Promise.all([A.click('#quickBtn'), B.click('#quickBtn')]);
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 2, null, { timeout: 20000 }).catch(() => {});
  const a = await heroes(A), bb = await heroes(B);
  console.log('A sees', a, '| B sees', bb);
  ok(a.length === 2 && bb.length === 2, 'two simultaneous quick joins end in one party');

  await C.click('[data-cls="bulwark"]');
  await C.click('#quickBtn');
  await C.waitForFunction(() => document.querySelectorAll('#coop li').length === 3, null, { timeout: 20000 }).catch(() => {});
  console.log('C sees', await heroes(C), '| note:', await C.textContent('#coop'));
  ok((await heroes(C)).length === 3, 'a third quick join fills the open party');
  await C.screenshot({ path: dir + '/quickjoin-guest.png' });
  const host = (await A.$('#partyCode')) ? A : B;
  await host.screenshot({ path: dir + '/quickjoin-host.png' });

  // Hosted parties: closed by default, found once ticked open.
  for (const p of [A, B, C]) if (await p.$('#leaveBtn')) await p.click('#leaveBtn');
  await A.waitForTimeout(500);
  await A.click('#hostBtn');
  await B.click('#quickBtn');
  await B.waitForFunction(() => /yours is open/.test(document.getElementById('coop').textContent), null, { timeout: 20000 }).catch(() => {});
  ok(/yours is open/.test(await B.textContent('#coop')), 'a party without Open to anyone is not quick-joined');
  await B.click('#leaveBtn');
  await A.check('#openBox');
  await A.waitForTimeout(300);
  await B.click('#quickBtn');
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 2, null, { timeout: 20000 }).catch(() => {});
  ok((await heroes(A)).length === 2, 'ticking Open to anyone lets Quick join find the party');

  // Starting a delve takes the party out of the lobby.
  await A.click('#startBtn');
  await A.waitForTimeout(1500);
  await C.click('#quickBtn');
  await C.waitForFunction(() => /yours is open/.test(document.getElementById('coop').textContent), null, { timeout: 20000 }).catch(() => {});
  ok(/yours is open/.test(await C.textContent('#coop')), 'a party mid-delve is not offered');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); srv.close();
})();
