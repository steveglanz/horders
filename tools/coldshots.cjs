// Screenshots the Coldmarrow visuals: the Hearthcoal light, a Frost Warden cracking in it,
// Frost Lace, Nhevra's Snuff and Long Night wind-ups, and Chill creeping in once a coal is out.
// One page, no network: the scene restarts straight into each fight and freezes mid-cast.
// Usage: npm run build && node tools/coldshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);

const SCENES = [
  // A Frost Warden inside the hero's light.
  { name: '1-warden', opts: { cls: 'emberwright', route: ['frostwardens'] }, until: 'warden' },
  { name: '2-lace', opts: { cls: 'bulwark', route: ['weaver'] }, kind: 'hoarfrostWeaver', cast: 'frostLace', at: 0.5 },
  { name: '3-snuff', opts: { cls: 'duskblade', route: ['nhevra'] }, kind: 'nhevra', cast: 'snuff', at: 0.5 },
  { name: '4-longnight', opts: { cls: 'lumen', route: ['nhevra'] }, kind: 'nhevra', cast: 'longNight', at: 0.6 },
  // The coal out and Chill at 3 of 5, then frozen.
  { name: '5-chill', opts: { cls: 'emberwright', route: ['rimepack'] }, chill: 3 },
  { name: '6-frozen', opts: { cls: 'emberwright', route: ['rimepack'] }, chill: 5 },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 5, dungeon: 'coldmarrow', tier: 10, invulnerable: true, ...o }, hud: s.hud, onEnd: () => {} });
    }, sc.opts);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world; const p = w.player;
      let ok = false;
      if (sc.until === 'warden') ok = w.phase === 'fight' && w.time > 4 && w.enemies.some((e) => e.alive && e.kind === 'frostWarden' && Math.hypot(e.x - p.x, e.y - p.y) < (p.coalR ?? 0) + e.def.radius - 10);
      else if (sc.chill !== undefined) ok = w.phase === 'fight' && w.time > 5;
      else ok = w.enemies.some((e) => e.alive && e.kind === sc.kind && e.castId === sc.cast && e.castT / e.castDur > sc.at);
      if (ok) s.warp = 0;
      return ok;
    }, sc, { timeout: 120000, polling: 30 }).catch(() => errs.push('timeout ' + sc.name));
    if (sc.chill !== undefined) await page.evaluate((c) => { const p = window.__ember.scene().world.player; p.coal = 0; p.coalR = 70; p.chill = c; }, sc.chill);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-cold-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
