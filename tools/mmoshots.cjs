// Plays a run on autopilot at key moments and screenshots the MMO features.
// Usage: node tools/mmoshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const tag = phone ? 'phone' : 'desk';
  const shot = (n) => page.screenshot({ path: path.join(out, `${tag}-${n}.png`) });
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=4');
  await page.waitForTimeout(800);
  await shot('0-title');
  await page.click('#startBtn');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; });
  // Run until a condition, at high warp, then slow to real time for a screenshot.
  const until = async (fn, label, maxMs = 120000) => {
    await page.evaluate(() => { window.__ember.scene().warp = 12; });
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const ok = await page.evaluate(fn);
      if (ok) break;
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    await page.waitForTimeout(350);
    await shot(label);
  };
  await until(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.time > 8; }, '1-fight1');
  await page.evaluate(() => { window.__ember.scene().autoPick = false; });
  await until(() => window.__ember.scene().world.state === 'draft', '2-draft');
  await page.evaluate(() => { const s = window.__ember.scene(); s.autoPick = true; });
  await until(() => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && e.castId && e.interruptible && e.castT > 0.5); }, '3-interrupt-cast');
  await until(() => { const w = window.__ember.scene().world; return w.phase === 'intro' && w.encounter >= 3; }, '4-between');
  await until(() => { const w = window.__ember.scene().world; return w.bossSpawned && w.bossIndex >= 0 && w.enemies[w.bossIndex].castId === 'cataclysm' && w.enemies[w.bossIndex].castT > 1; }, '5-cataclysm', 60000);
  await until(() => { const w = window.__ember.scene().world; return w.telegraphs.some((t) => t.alive && t.kind === 'soak') || w.state === 'ended'; }, '6-soak', 60000);
  await until(() => !document.getElementById('end').hidden, '7-end', 90000);
  const st = await page.evaluate(() => { const w = window.__ember.scene().world; return { t: w.time.toFixed(0), victory: w.victory, route: w.route, cleared: w.encounter, drops: w.runDrops.length, equipped: w.runEquipped.length }; });
  console.log(JSON.stringify(st));
  await page.click('#menuBtn');
  await page.waitForTimeout(300);
  await shot('8-hub');
  await page.evaluate(() => document.getElementById('bagBtn').click()); // hidden on phones, where the Bags tab opens it
  await page.waitForTimeout(300);
  await shot('9-bag');
  const saved = await page.evaluate(() => localStorage.getItem('horders.hero.v1')?.length ?? 0);
  console.log('saved bytes', saved);
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
