// The hub backdrop on a phone and a desktop, at two moments of the furnace's breath.
// Usage: npm run build && node tools/hubshots.cjs <outDir> <prefix> [saver]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'docs/art/hub'; const pre = process.argv[3] || 'after'; const saver = process.argv[4] === 'saver';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const SIZES = { phone: { ...devices['iPhone 13'], deviceScaleFactor: 2 }, desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, size] of Object.entries(SIZES)) {
    const ctx = await b.newContext(size);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    if (saver) await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'saver' })));
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7`);
    // Pin every backdrop animation to a moment, so the two frames show the breath's low and high.
    for (const [i, at] of [[1, 0.15], [2, 0.6]]) {
      await page.evaluate((at) => document.querySelectorAll('.backdrop, .backdrop *').forEach((el) => el.getAnimations().forEach((a) => { a.pause(); const d = a.effect.getComputedTiming().duration; a.currentTime = (Number(a.effect.getComputedTiming().delay) || 0) * -1 + d * at; })), at);
      await page.waitForTimeout(150);
      const h = tag === 'phone' ? 420 : 520;
      await page.screenshot({ path: path.join(out, `${pre}-${tag}-${i}${saver ? '-saver' : ''}.png`), clip: { x: 0, y: 0, width: size.viewport.width, height: h } });
    }
    console.log(tag, errs.length ? errs.join('\n') : 'no errors');
    await ctx.close();
  }
  await b.close(); srv.close();
})();
