// Screenshots the P2 season track sheet (level 16, two glows and a title worn) and the hero card's worn title.
// Usage: npm run build && node tools/seasonshots.cjs <outDir> [s7|s8]
// (s7: the Long Hunger on Mon 2 Aug 2027, s8: the Cracked Plate on Mon 13 Sep 2027, with that season's glows and title,
// instead of today's season)
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const S = process.argv.includes('s7') ? { now: Date.UTC(2027, 7, 2, 12), glows: ['gulletRed', 'crawRose'], title: 'Delver of the Long Hunger', sfx: '-s7' }
  : process.argv.includes('s8') ? { now: Date.UTC(2027, 8, 13, 12), glows: ['cinderViolet', 'crackCyan'], title: 'Delver of the Cracked Plate', sfx: '-s8' }
  : { now: 0, glows: ['tideSilver', 'hollowViolet'], title: 'Delver of the Hollow Tide', sfx: '' };
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 800 } }], ['phone', { ...devices['iPhone 13'] }], ['se', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    if (S.now) await ctx.addInitScript((now) => { const real = Date.now; const t0 = real(); Date.now = () => now + (real() - t0); }, S.now);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate((S) => {
      const h = window.__ember.hero();
      const week = Math.floor(Date.now() / (7 * 864e5));
      h.runs = Math.max(h.runs, 5);
      h.season = { id: Math.floor((week - 2968) / 6), marks: 500 * 16 + 230, firstWinDay: Math.floor(Date.now() / 864e5) };
      h.glows = S.glows;
      h.titles = ['the Unquenched', S.title];
      h.wear = { title: S.title, glow: S.glows[1] };
      document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
    }, S);
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-prep="season"]')?.click());
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-season${S.sfx}.png`) });
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-season-hero${S.sfx}.png`) });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(tag, 'errors:', errs.length ? errs : 'none', 'horizontal scroll:', wide);
    await ctx.close();
  }
  await b.close(); srv.close();
})();
