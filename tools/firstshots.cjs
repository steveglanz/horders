// Screenshots L1's first delve: the opening coach banner on a brand-new hero, and the Brute's Quench lesson.
// Usage: npm run build && node tools/firstshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
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
  // A fresh browser: no save, so this is the hero's first delve.
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5`);
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  const info = await page.evaluate(() => { const w = window.__ember.scene().world; return { first: w.firstDelve, route: w.route, cls: w.cls }; });
  console.log(JSON.stringify(info));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/${tag}-first-1-pack.jpg`, quality: 80 });
  // The Brute fight with the first delve on: the Quench coach line.
  await page.evaluate(() => {
    const s = window.__ember.scene();
    s.scene.restart({ opts: { seed: 5, dungeon: 'kiln', tier: 1, firstDelve: true, cls: 'duskblade', route: ['brute'] }, hud: s.hud, onEnd: () => {} });
  });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/${tag}-first-2-brute.jpg`, quality: 80 });
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors');
  await b.close(); srv.close();
})();
