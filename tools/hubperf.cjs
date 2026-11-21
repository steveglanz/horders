// What the hub costs while it sits idle: main-thread busy time over 8 s, measured on an iPhone 13
// viewport (swiftshader GL) at first load and again after backing out of a run.
// Usage: npm run build && node tools/hubperf.cjs dist [auto|saver]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve(process.argv[2] || 'dist', 'index.html')); const GFX = process.argv[3] || 'auto';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const metric = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
async function sample(page, cdp, label) {
  await page.waitForTimeout(1500);
  // Count the page's own animation frames too: a sleeping game loop leaves only the CSS ones.
  await page.evaluate(() => { window.__raf = 0; const f = () => { window.__raf++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const a = await metric(cdp);
  await page.waitForTimeout(8000);
  const b = await metric(cdp);
  const busy = (k) => ((b[k] - a[k]) / 8 * 100).toFixed(1);
  console.log(GFX, label, JSON.stringify({ taskPct: busy('TaskDuration'), scriptPct: busy('ScriptDuration'), stylePct: busy('RecalcStyleDuration'), layoutPct: busy('LayoutDuration') }));
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((g) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: g })), GFX);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await sample(page, cdp, 'first-load');
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 30, null, { timeout: 15000 });
  // Back out the way a player does: pause, then quit to the hub.
  await page.evaluate(() => { document.getElementById('quitBtn').click(); });
  await page.waitForFunction(() => !document.getElementById('title').hidden, null, { timeout: 5000 });
  await sample(page, cdp, 'after-run');
  // And the game must still start cleanly from a sleeping loop.
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 30, null, { timeout: 15000 });
  console.log(GFX, 'restart ok', errs.length ? errs.join('\n') : 'no errors');
  await ctx.close(); await b.close(); srv.close();
})();
