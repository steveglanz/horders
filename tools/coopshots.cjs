// Screenshots co-op visuals: the lobby (no party, host with three heroes, guest) and
// the run as seen by a guest (party frames, ally tags and rings, off-screen arrows).
// Three pages in one Chromium share a local party (?localparty=1).
// Usage: npm run build && node tools/coopshots.cjs <outDir> [phone] [lobby]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
const lobbyOnly = process.argv.includes('lobby');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const url = `http://127.0.0.1:${srv.address().port}/?localparty=1&seed=5`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const errs = [];
  const [A, B, C] = [await ctx.newPage(), await ctx.newPage(), await ctx.newPage()];
  for (const [n, p] of [['A', A], ['B', B], ['C', C]]) p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  for (const p of [A, B, C]) await p.goto(url);
  await A.waitForTimeout(800);
  const coopShot = async (p, name) => {
    await p.$eval('#coop', (el) => el.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(150);
    await (await p.$('#coop')).screenshot({ path: path.join(out, `${tag}-lobby-${name}.png`) });
  };
  await coopShot(A, '1-alone');
  await B.click('[data-cls="bulwark"]');
  await C.click('[data-cls="lumen"]');
  await A.click('#hostBtn');
  const code = (await A.textContent('#partyCode')).trim();
  for (const p of [B, C]) { await p.fill('#joinCode', code); await p.click('#joinBtn'); }
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 3, null, { timeout: 15000 }).catch(() => errs.push('link timeout'));
  await coopShot(A, '2-host');
  await coopShot(B, '3-guest');
  if (!lobbyOnly) {
    await A.click('#startBtn');
    await B.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
    await A.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    for (const p of [B, C]) await p.evaluate(() => { const s = window.__ember.scene(); s.autoPick = true; });
    await A.waitForFunction(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.time > 6; }, null, { timeout: 60000 });
    await A.evaluate(() => { window.__ember.scene().warp = 1; });
    // The guest walks away from the host so one ally falls off screen.
    await B.keyboard.down('d'); await B.waitForTimeout(1800); await B.keyboard.up('d');
    // Knock the Lumen down, and park the host far from the guest so the guest sees an off-screen arrow.
    await A.evaluate(() => {
      const s = window.__ember.scene(); s.autopilot = false; const w = s.world;
      w.heroData(2).player.hp = 0;
      const g = w.heroData(1).player; const h = w.heroData(0).player;
      h.x = h.px = g.x - 420; h.y = h.py = g.y + 260;
    });
    await B.waitForTimeout(400);
    await B.screenshot({ path: path.join(out, `${tag}-run-guest.png`) });
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
