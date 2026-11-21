// Screenshots L1's first-time tips: the first red hit circle near the hero, and the first gold soak circle.
// Usage: npm run build && node tools/tipshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);

// Each scene drops its circle beside the hero (a slam's red, a soak's gold) so the shot doesn't wait on the AI.
const SCENES = [
  { name: 'tip-red', opts: { cls: 'emberwright', route: ['wardens'] }, until: 'red', kind: 'hit', dx: 40 },
  { name: 'tip-gold', opts: { cls: 'bulwark', route: ['kilnMother'] }, until: 'gold', kind: 'soak', dx: 160 },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  // A ?seed= run skips the first-delve coach; tips=1 still shows the first-time tips.
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1&tips=1`);
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 5, dungeon: 'kiln', tier: 1, invulnerable: true, ...o }, hud: s.hud, onEnd: () => {} });
    }, sc.opts);
    await page.waitForTimeout(700);
    await page.waitForFunction(() => window.__ember.scene().world.phase === 'fight', null, { timeout: 15000 });
    await page.evaluate((sc) => {
      const w = window.__ember.scene().world; const p = w.player;
      w.addTelegraph('circle', p.x + sc.dx, p.y, sc.kind === 'soak' ? 55 : 115, 0, 0, 4, 0, sc.kind, sc.kind === 'soak' ? -2 : -1);
    }, sc);
    await page.waitForFunction((u) => {
      const el = document.getElementById('coach');
      return !!el && !el.hidden && el.dataset.kind === 'tip' && el.textContent.toLowerCase().includes(u === 'red' ? 'red' : 'gold');
    }, sc.until, { timeout: 60000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${tag}-${sc.name}.jpg`, quality: 80 });
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors');
  await b.close(); srv.close();
})();
