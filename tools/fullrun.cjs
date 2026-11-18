// Plays a full run with the autopilot at high speed and screenshots key moments.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const vp = process.argv[2] === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: process.argv[2] === 'phone' });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=1' + (process.argv[3] === 'god' ? '&god=1' : ''));
  await page.waitForTimeout(500);
  await page.click('#startBtn');
  await page.waitForTimeout(300);
  const tag = process.argv[2] || 'desk';
  const st = () => page.evaluate(() => { const s = window.__ember.scene(); const w = s.world; return { t: w.time, state: w.state, lvl: w.player.level, hp: w.player.hp, boss: w.bossSpawned, tele: w.telegraphs.filter(t => t.alive).length }; });
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 10; });
  const shots = [[100, 'mid'], [250, 'elite'], [490, 'boss']];
  for (const [t, name] of shots) {
    while ((await st()).t < t && (await st()).state !== 'ended') await page.waitForTimeout(200);
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    if (name === 'boss') { for (let k = 0; k < 40 && (await st()).tele === 0; k++) await page.waitForTimeout(150); }
    else await page.waitForTimeout(600);
    await page.screenshot({ path: `tools/shots/${tag}-${name}.png` });
    console.log(name, JSON.stringify(await st()));
    if (name === 'mid') {
      await page.evaluate(() => { window.__ember.scene().autoPick = false; });
      for (let k = 0; k < 60 && !(await page.isVisible('#draft')); k++) await page.waitForTimeout(250);
      await page.screenshot({ path: `tools/shots/${tag}-draft.png` });
      await page.evaluate(() => { window.__ember.scene().autoPick = true; });
      await page.keyboard.press('1');
    }
    await page.evaluate(() => { window.__ember.scene().warp = 10; });
  }
  for (let k = 0; k < 600 && (await st()).state !== 'ended'; k++) await page.waitForTimeout(200);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `tools/shots/${tag}-end.png` });
  console.log('end', JSON.stringify(await st()));
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
