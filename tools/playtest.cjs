// Loads the built game, plays it with keyboard input, captures screenshots and errors.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=5&debug=1');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tools/shots/1-title.png' });
  await page.click('#startBtn');
  const keys = ['d', 's', 'a', 'w'];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.down(keys[i % 4]);
    await page.waitForTimeout(700);
    await page.keyboard.up(keys[i % 4]);
    if (await page.isVisible('#draft')) {
      if (i === 4) await page.screenshot({ path: 'tools/shots/3-draft.png' });
      await page.keyboard.press('1');
    }
  }
  await page.screenshot({ path: 'tools/shots/2-run.png' });
  const state = await page.evaluate(() => { const s = window.__ember.scene(); return s ? { t: s.world.time.toFixed(1), lvl: s.world.player.level, kills: s.world.kills, hp: s.world.player.hp, enemies: s.world.aliveEnemies, state: s.world.state, fps: s.fps() } : null; });
  console.log(JSON.stringify(state));
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
