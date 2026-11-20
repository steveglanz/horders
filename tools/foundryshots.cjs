// Screenshots the Drowned Foundry (gates, Maelra's vents and Temper, rising water)
// and the Lumen and Bulwark in play. Usage: npm run build && node tools/foundryshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
const url = 'file://' + path.resolve('dist/index.html') + '?seed=7&god=1';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const errors = [];
  const open = async (cls, dungeon) => {
    const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 4); localStorage.setItem('horders.hero.v1', JSON.stringify(h)); });
    await page.goto(url);
    await page.waitForTimeout(300);
    await page.click(`[data-cls="${cls}"]`).catch(() => {});
    if (dungeon) await page.click(`[data-d="${dungeon}"]`, { timeout: 5000 }).catch((e) => errors.push('no dungeon button: ' + e.message));
    await page.click('#startBtn');
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; });
    return { page, ctx };
  };
  const shoot = async (page, label, cond, hold = false, ms = 150000) => {
    await page.evaluate(() => { window.__ember.scene().warp = 10; });
    const ok = await page.waitForFunction(cond, null, { timeout: ms }).then(() => true).catch(() => { errors.push('timeout ' + label); return false; });
    // hold: stop the autopilot so it doesn't walk straight through (gates).
    await page.evaluate((h) => { const s = window.__ember.scene(); s.warp = 1; if (h) s.autopilot = false; }, hold);
    await page.waitForTimeout(500);
    if (ok) await page.screenshot({ path: path.join(out, `${tag}-${label}.png`) });
    if (hold) await page.evaluate(() => { window.__ember.scene().autopilot = true; });
  };
  {
    const { page, ctx } = await open('emberwright', 'foundry');
    await page.evaluate(() => { window.__ember.scene().autoPick = true; });
    await shoot(page, 'f-gates', () => { const w = window.__ember.scene().world; return w.phase === 'choose'; }, true);
    await shoot(page, 'f-elite', () => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && ['glassWarden', 'emberTwin', 'sluiceCrawler'].includes(e.kind) && w.time - e.spawnedAt > 3); });
    await shoot(page, 'f-maelra', () => { const w = window.__ember.scene().world; return w.vents.length > 0 && w.temper >= 2; });
    await shoot(page, 'f-water', () => { const w = window.__ember.scene().world; return w.arenaR < 470; });
    await ctx.close();
  }
  for (const cls of ['lumen', 'bulwark']) {
    const { page, ctx } = await open(cls);
    await shoot(page, `c-${cls}`, () => { const w = window.__ember.scene().world; return w.time > 20 && w.enemies.some((e) => e.alive); });
    await ctx.close();
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
