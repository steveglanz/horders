const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, vp] of [['phone', { width: 390, height: 844 }], ['desk', { width: 1280, height: 720 }]]) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto('file://' + path.resolve('dist/index.html') + '?seed=2&god=1');
    await page.click('#startBtn');
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 10; });
    await page.waitForFunction(() => window.__ember.scene().world.time > 60, null, { timeout: 60000 });
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `tools/shots/q-${tag}.png` });
    await page.close();
  }
  await browser.close();
})();
