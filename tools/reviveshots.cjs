// Screenshots the G6 boss revive look (#173): a pick-up counting down from 9 s with the party
// chip showing the one revive, then a downed hero after the pick-up is spent (grey broken
// ring, struck-through cross, "Revive used this boss" chip). Sets the state directly. No network.
// Usage: npm run build && node tools/reviveshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const party = [{ cls: 'lumen', name: 'Lumen 6' }, { cls: 'emberwright', name: 'Emberwright 6' }, { cls: 'duskblade', name: 'Duskblade 6' }];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const shot of ['reviving', 'used']) {
    await page.evaluate((party) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 7, cls: 'bulwark', dungeon: 'hammerdeep', route: ['ondrel'], tier: 6, invulnerable: true, heroName: 'Bulwark 6', party }, hud: s.hud, onEnd: () => {} }); }, party);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; const ok = w.bossUp && w.time > 6; if (ok) s.warp = 0; return ok; }, null, { timeout: 90000, polling: 20 }).catch(() => errs.push('timeout ' + shot));
    await page.evaluate((shot) => {
      const s = window.__ember.scene(); const w = s.world; const p = w.player;
      const q = w.heroData(1).player; // the Lumen goes down beside the tank
      q.hp = 0; q.x = p.x + 70; q.y = p.y + 40; q.px = q.x; q.py = q.y;
      if (shot === 'reviving') { q.reviveT = w.reviveSeconds * 0.45; p.x = q.x - 22; p.y = q.y - 10; p.px = p.x; p.py = p.y; }
      else { w.bossRevives = 1; q.reviveT = 0; }
      s.warp = 0.02; // let a few frames draw without the sim moving on
    }, shot);
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__ember.scene().warp = 0; });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(out, `${tag}-revive-${shot}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
