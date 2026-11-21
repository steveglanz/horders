// Screenshots the Wrackline: rafts drifting, the Ebb's warning and pull, a Barge Hauler's Haul,
// Shoal Lurkers circling a raft, and Hessa's Sink on a raft.
// One page, no network: the scene restarts straight into each fight and freezes at the moment.
// Usage: npm run build && node tools/wrackshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);

const SCENES = [
  { name: '1-rafts', opts: { cls: 'emberwright', route: ['lurkers'] }, until: 'fight' },
  { name: '2-ebb-warn', opts: { cls: 'duskblade', route: ['wardenShoal'] }, until: 'warn' },
  { name: '3-ebb-pull', opts: { cls: 'emberwright', route: ['wardenShoal'] }, until: 'pull' },
  { name: '4-haul', opts: { cls: 'bulwark', route: ['haulers'] }, kind: 'bargeHauler', cast: 'haul', at: 0.6 },
  { name: '5-sink', opts: { cls: 'lumen', route: ['hessa'] }, kind: 'hessa', cast: 'sink', at: 0.6 },
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
      s.scene.restart({ opts: { seed: 5, dungeon: 'wrackline', tier: 13, invulnerable: true, ...o }, hud: s.hud, onEnd: () => {} });
    }, sc.opts);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world;
      let ok = false;
      if (sc.until === 'fight') ok = w.phase === 'fight' && w.time > 4;
      else if (sc.until === 'warn') ok = w.phase === 'fight' && w.ebbWarnT > 0 && w.ebbWarnT < 1.5;
      else if (sc.until === 'pull') ok = w.phase === 'fight' && w.ebbT > 0 && w.ebbT < 2.5;
      else ok = w.enemies.some((e) => e.alive && e.kind === sc.kind && e.castId === sc.cast && e.castT / e.castDur > sc.at);
      if (ok) s.warp = 0;
      return ok;
    }, sc, { timeout: 120000, polling: 30 }).catch(() => errs.push('timeout ' + sc.name));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-wrack-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
