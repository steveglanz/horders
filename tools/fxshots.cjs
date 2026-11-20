// Screenshots the art at its busiest: a horde, an elite with hit effects, the boss,
// and the Duskblade. Usage: npm run build && node tools/fxshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const errors = [];
  const run = async (cls, shots) => {
    const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((c) => { localStorage.setItem('horders.fx.cls', c); }, cls);
    await page.goto('file://' + path.resolve('dist/index.html') + '?seed=5&god=1');
    if (cls !== 'emberwright') await page.click(`[data-cls="${cls}"]`).catch(() => {});
    await page.click('#startBtn');
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; });
    for (const [label, cond] of shots) {
      await page.evaluate(() => { window.__ember.scene().warp = 10; });
      await page.waitForFunction(cond, null, { timeout: 150000 }).catch(() => errors.push('timeout ' + label));
      await page.evaluate(() => { window.__ember.scene().warp = 1; });
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(out, `${tag}-${label}.png`) });
    }
    await ctx.close();
  };
  await run('emberwright', [
    ['fx-elite', () => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && e.def.rank !== 'normal' && e.hp < e.maxHp * 0.7); }],
    ['fx-boss', () => { const w = window.__ember.scene().world; return w.bossIndex >= 0 && w.enemies[w.bossIndex].alive && w.time - w.enemies[w.bossIndex].spawnedAt > 6; }],
  ]);
  await run('duskblade', [
    ['fx-duskblade', () => { const w = window.__ember.scene().world; return w.time > 25 && w.enemies.some((e) => e.alive); }],
  ]);
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
