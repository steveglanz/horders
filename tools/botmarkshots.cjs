// Fill with bots art: the delve screen's Fill with bots chip (Hammerdeep, tier 6), then a bot-filled run's party
// frames and over-head names. Usage: npm run build && node tools/botmarkshots.cjs <outDir> [off]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['phone', { ...devices['iPhone 13'] }], ['desk', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
    await page.waitForTimeout(700);
    const C = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    await C('[data-cls="duskblade"]');
    await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 6); h.runs = 12; window.__ember.save?.(); });
    await C('[data-cls="emberwright"]'); await C('[data-cls="duskblade"]');
    await C('[data-d="hammerdeep"]');
    await page.waitForTimeout(200);
    if (process.argv[3] !== 'off') await C('[data-fill]');
    await page.waitForTimeout(300);
    const pr = page.locator('.partyroles'); await pr.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await pr.screenshot({ path: path.join(out, `${tag}-fill.png`) });
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 60, null, { timeout: 20000 });
    await page.evaluate(() => window.__ember.scene().scene.pause());
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-run.png`) });
    console.log(tag, errs.length ? errs : 'no errors');
    await ctx.close();
  }
  await b.close(); srv.close();
})();
