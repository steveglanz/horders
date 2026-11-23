// Phase 14 X6: the hub's Heat chip with each Heat's own glyph, at 360 px, plus the Heat sheet it opens.
// Steps the clock a day at a time over the solo dungeons until all eight Heats have shown once.
// Usage: npm run build && node tools/heatchipshots.cjs <outDir>
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const SOLO = ['kiln', 'foundry', 'glarewell', 'coldmarrow', 'wrackline'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => { const real = Date.now.bind(Date); window.__dayShift = 0; Date.now = () => real() + window.__dayShift * 864e5; });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => { const h = window.__ember.hero(); h.runs = Math.max(h.runs, 12); h.maxTier = 13; document.querySelector('[data-tab="delve"]')?.click(); });
  await page.waitForTimeout(300);
  const seen = new Set();
  for (let day = 0; day < 30 && seen.size < 8; day++) {
    for (const d of SOLO) {
      await page.evaluate(([d, day]) => { window.__dayShift = day; document.querySelector(`.dg[data-d="${d}"]`)?.click(); }, [d, day]);
      await page.waitForTimeout(120);
      const chip = page.locator('.prep-chip[data-prep="heat"]').first();
      if (!(await chip.count()) || !(await chip.isVisible())) continue;
      const name = (await chip.getAttribute('aria-label')).replace("Today's Heat: ", '');
      if (seen.has(name)) continue;
      seen.add(name);
      await chip.screenshot({ path: path.join(out, `chip-${name.replace(/\s+/g, '')}.png`) });
      if (seen.size === 1) {
        await chip.click(); await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(out, `sheet-${name.replace(/\s+/g, '')}.png`) });
        await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelector('.sheet .close, [data-close]')?.click()); await page.waitForTimeout(250);
      }
    }
  }
  await page.evaluate(() => { window.__dayShift = 0; });
  await page.screenshot({ path: path.join(out, 'hub.png') });
  console.log('seen', [...seen].join(', '));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
