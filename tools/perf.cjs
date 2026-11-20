// Stress test: 600 enemies, measure frame rate with and without CPU throttling.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const throttle of [1, 4]) {
    for (const [tag, vp, dsf] of [['phone 390x844', { width: 390, height: 844 }, 1], ['phone 390x844 @2x', { width: 390, height: 844 }, 2], ['desktop 1280x720', { width: 1280, height: 720 }, 1]]) {
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: dsf });
      const cdp = await page.context().newCDPSession(page);
      await page.goto('file://' + path.resolve('dist/index.html') + '?stress=1&seed=3');
      await page.waitForFunction(() => window.__ember.scene() && window.__ember.scene().world.aliveEnemies >= 550, null, { timeout: 30000 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
      await page.waitForTimeout(12000); // fill the 240-frame window after throttling
      const r = await page.evaluate(() => { const s = window.__ember.scene(); const f = s.fps(); let onScreen = 0; const v = s.cameras.main.worldView; for (const e of s.world.enemies) if (e.alive && v.contains(e.x, e.y)) onScreen++; return { fps: f.avg.toFixed(1), p95ms: f.p95ms.toFixed(1), gameCodeMs: s.workMs().toFixed(2), enemies: s.world.aliveEnemies, onScreen }; });
      console.log(`${tag}, CPU throttle ${throttle}x: ${JSON.stringify(r)}`);
      if (throttle === 1 && tag.startsWith('phone')) await page.screenshot({ path: 'tools/shots/stress-phone.png' });
      await page.close();
    }
  }
  await browser.close();
})();
