// Screenshots the Pressworks: Oskel, the Downstroke plate (covered, empty, and with a Pressed hero on it), the Rivets,
// the Stamp on the tank, and Pressed marks over heroes; plus the hub's dungeon card. One page, no network: the scene
// restarts straight into Oskel with a bot party and freezes at each moment.
// Usage: npm run build && node tools/pressshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots'; fs.mkdirSync(out, { recursive: true });
const phone = process.argv.includes('phone');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const errs = [];
  const A = await ctx.newPage(); A.on('pageerror', (e) => errs.push(e.message));
  await A.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1`);
  await A.waitForTimeout(600);
  // The hub card.
  await A.evaluate(() => { const h = window.__ember.hero(); h.maxTier = 10; h.runs = 3; document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click(); });
  await A.waitForTimeout(200);
  const card = A.locator('.dg[data-d="pressworks"]');
  await card.evaluate((e) => e.scrollIntoView({ block: 'center' })); await A.waitForTimeout(200);
  await card.screenshot({ path: path.join(out, `${tag}-pw-card.png`) });
  await A.evaluate(() => document.getElementById('startBtn').click());
  await A.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await A.evaluate(() => {
    const s = window.__ember.scene();
    s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: 'pressworks', route: ['oskel'], tier: 10, invulnerable: true, heroName: 'Bulwark', party: [{ cls: 'lumen', name: 'Lumen' }, { cls: 'duskblade', name: 'Duskblade' }] }, hud: s.hud, onEnd: () => {} });
  });
  await A.waitForTimeout(600);
  await A.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 4; });
  const shot = async (label) => { await A.waitForTimeout(150); await A.screenshot({ path: path.join(out, `${tag}-pw-${label}.png`) }); };
  const freeze = () => A.evaluate(() => { window.__ember.scene().warp = 0; });
  const go = () => A.evaluate(() => { window.__ember.scene().warp = 1; });
  // The predicates freeze the scene themselves the moment they match: software GL draws few frames, and each frame can run
  // a quarter second of fight, so freezing a round trip later would miss a 1.6 s Rivets fuse.
  // Downstroke, late in its fuse: as it falls (the bots stand where they like), then with a Pressed hero moved onto it.
  await A.waitForFunction(() => window.__ember.scene().world.telegraphs.some((t) => t.alive && t.owner === -3 && t.t / t.dur > 0.55), null, { timeout: 120000, polling: 30 }).catch(() => errs.push('timeout downstroke'));
  await freeze(); await shot('1-downstroke');
  await A.evaluate(() => {
    const w = window.__ember.scene().world; const t = w.telegraphs.find((t) => t.alive && t.owner === -3);
    for (let k = 0; k < w.heroes.length; k++) { const q = w.heroData(k).player; q.x = q.px = t.x + (k - 1) * 30 + (k === 0 ? 200 : 0); q.y = q.py = t.y + 10; }
    w.heroData(2).player.pressedT = 12;
  });
  await shot('2-downstroke-pressed');
  await A.evaluate(() => { const w = window.__ember.scene().world; for (let k = 0; k < w.heroes.length; k++) w.heroData(k).player.pressedT = 0; });
  await go();
  await A.waitForFunction(() => window.__ember.scene().world.telegraphs.some((t) => t.alive && t.owner === -1 && t.t / t.dur > 0.4) && !(window.__ember.scene().warp = 0), null, { timeout: 120000, polling: 30 }).catch(() => errs.push('timeout rivets'));
  await freeze(); await shot('3-rivets');
  await go();
  await A.waitForFunction(() => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && e.kind === 'oskel' && e.castId === 'stamp' && e.castT / e.castDur > 0.45) && !(window.__ember.scene().warp = 0); }, null, { timeout: 120000, polling: 30 }).catch(() => errs.push('timeout stamp'));
  await freeze();
  await A.evaluate(() => { const w = window.__ember.scene().world; w.heroData(1).player.pressedT = 15; w.heroData(2).player.pressedT = 6; });
  await shot('4-stamp-pressed-marks');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
