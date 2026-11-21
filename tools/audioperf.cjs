// Audio CPU check on a simulated slow phone (Chromium CPU throttled 6x):
// the long main-thread tasks while sounds warm up after the first tap, and
// while a delve starts. Usage: npm run build && node tools/audioperf.cjs [dist/index.html]
const { chromium } = require('playwright');
const path = require('path');
const file = process.argv[2] || 'dist/index.html';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await page.goto('file://' + path.resolve(file) + '?seed=3&god=1');
  await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.evaluate(() => {
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask' });
  });
  const take = () => page.evaluate(() => { const l = window.__long; window.__long = []; return { count: l.length, max: Math.round(Math.max(0, ...l)), sum: Math.round(l.reduce((a, b) => a + b, 0)) }; });
  await page.tap('.logo');
  await page.waitForTimeout(12000);
  const warm = await take();
  console.log('hub after first tap (12 s):', JSON.stringify(warm));
  await page.tap('#startBtn');
  await page.waitForTimeout(6000);
  console.log('delve start (6 s):', JSON.stringify(await take()));
  await browser.close();
})();
