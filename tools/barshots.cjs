// Screenshots the action bar for each class mid-fight. Usage: node tools/barshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://*.supabase.co/**', (r) => r.abort());
  for (const cls of ['emberwright', 'duskblade', 'bulwark', 'lumen']) {
    await page.goto('file://' + path.resolve('dist/index.html') + '?seed=4&god=1');
    await page.waitForTimeout(600);
    await page.click(`[data-cls="${cls}"]`);
    await page.click('#startBtn');
    await page.waitForTimeout(300);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 8; });
    const t0 = Date.now();
    while (Date.now() - t0 < 60000 && !(await page.evaluate(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.time > 6; }))) await page.waitForTimeout(100);
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    await page.waitForTimeout(400);
    const box = await page.locator('#actionbar').boundingBox();
    await page.screenshot({ path: path.join(out, `${phone ? 'phone' : 'desk'}-bar-${cls}.png`), clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 } });
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
