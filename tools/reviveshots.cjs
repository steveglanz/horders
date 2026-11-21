// Screenshots the G6 revive visuals: a downed ally waiting (the "+" marker), an ally being
// revived (tether, filling ring, party frame meter), the pick-up flash, and your own hero down.
// One page, no network: the scene restarts straight into a party fight and the sim is frozen.
// Usage: npm run build && node tools/reviveshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1`);
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await page.evaluate(() => {
    const s = window.__ember.scene();
    s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: 'kiln', route: ['wardens', 'kilnMother'], tier: 2, invulnerable: true, heroName: 'Bulwark 6', party: [{ cls: 'lumen', name: 'Lumen 6' }, { cls: 'emberwright', name: 'Emberwright 6' }] }, hud: s.hud, onEnd: () => {} });
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 3; });
  await page.waitForFunction(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.time > 8; }, null, { timeout: 60000, polling: 50 });
  // Lay the party out by hand: Lumen down to the hero's right, Emberwright further off.
  const pose = (reviveT, onTop, meDown) => page.evaluate(([reviveT, onTop, meDown]) => {
    const s = window.__ember.scene(); s.warp = 0;
    const w = s.world;
    const me = w.heroData(0).player; const lu = w.heroData(1).player; const em = w.heroData(2).player;
    const place = (p, x, y) => { p.x = p.px = x; p.y = p.py = y; };
    place(me, w.player.x, w.player.y);
    for (const e of w.enemies) if (e.alive && Math.hypot(e.x - me.x, e.y - me.y) < 200) { e.x += 260; e.px = e.x; }
    lu.hp = 0; lu.reviveT = reviveT;
    place(lu, me.x + (onTop ? 18 : 120), me.y + (onTop ? 10 : 30));
    place(em, me.x - 130, me.y + 60);
    if (meDown) { me.hp = 0; me.reviveT = reviveT; lu.hp = lu.maxHp; lu.reviveT = 0; place(lu, me.x + 20, me.y + 12); }
    else me.hp = me.maxHp;
  }, [reviveT, onTop, meDown]);
  await pose(0, false, false);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${tag}-revive-1-down.png`) });
  await pose(1.8, true, false);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${tag}-revive-2-reviving.png`) });
  // Let it finish: run the sim for a moment and catch the flash.
  await pose(2.85, true, false);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = false; s.warp = 1; });
  await page.waitForFunction(() => window.__ember.scene().world.heroData(1).player.hp > 0, null, { timeout: 5000, polling: 10 }).catch(() => errs.push('no revive'));
  await page.waitForTimeout(90);
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.screenshot({ path: path.join(out, `${tag}-revive-3-flash.png`) });
  await pose(1.2, true, true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${tag}-revive-4-me-down.png`) });
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
