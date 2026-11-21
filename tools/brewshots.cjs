// Screenshots the R8 brewing look: a potion brewed in the hub flares and boils over, then simmers.
// Desktop shows the potion cards inline; phones open them from the Potion chip.
// Usage: npm run build && node tools/brewshots.cjs <outDir>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const h = window.__ember.hero();
      h.runs = Math.max(h.runs, 3); h.embers = 900; h.potion = undefined;
      document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
    });
    await page.waitForTimeout(300);
    // Phones: open the Potion sheet from its chip.
    await page.evaluate(() => { const c = document.querySelector('.prep-chip[data-prep="potion"]'); if (c && c.offsetParent) c.click(); });
    await page.waitForTimeout(400);
    const pots = () => page.evaluate(() => {
      const els = [...document.querySelectorAll('.pots')].filter((e) => e.offsetParent);
      const el = els[els.length - 1]; if (!el) return null;
      el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 40), width: Math.min(r.width + 20, innerWidth), height: r.height + 60 };
    });
    let clip = await pots();
    if (!clip) { errs.push('no potion cards'); await ctx.close(); continue; }
    await page.screenshot({ path: path.join(out, `${tag}-brew-0-before.png`), clip });
    await page.evaluate(() => { const els = [...document.querySelectorAll('.pots')].filter((e) => e.offsetParent); els[els.length - 1].querySelector('[data-potion]:not(:disabled)').click(); });
    await page.waitForTimeout(260);
    clip = await pots();
    await page.screenshot({ path: path.join(out, `${tag}-brew-1-pour.png`), clip });
    await page.waitForTimeout(1700);
    await page.screenshot({ path: path.join(out, `${tag}-brew-2-simmer.png`), clip });
    console.log(tag, errs.length ? errs : 'no errors');
    await ctx.close();
  }
  await b.close(); srv.close();
})();
