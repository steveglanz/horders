// Screenshots the P4 Collection: the hero card's button and the book sheet, part-filled, on desktop and phone.
// Usage: npm run build && node tools/bookshots.cjs <outDir>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 800 } }], ['phone', { ...devices['iPhone 13'] }], ['se', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const h = window.__ember.hero();
      h.runs = Math.max(h.runs, 5);
      h.collection = ['set:kilnbreaker:head', 'set:kilnbreaker:hands', 'set:kilnbreaker:trinket', 'set:tidewalker:hands', 'mythic:giantsBane', 'mythic:phoenixFeather', 'mythic:bankedHeart', 'fx:bankedFlame'];
      h.collectionPaid = ['set:kilnbreaker'];
      document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-book-button.png`) });
    await page.evaluate(() => document.querySelector('[data-book]')?.click());
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-book.png`) });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(tag, 'errors:', errs.length ? errs : 'none', 'horizontal scroll:', wide);
    await ctx.close();
  }
  await b.close(); srv.close();
})();
