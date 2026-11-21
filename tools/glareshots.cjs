// Screenshots the Glarewell: the first fight, pillars and shadow wedges, and the Lensmother.
// Usage: npm run build && node tools/glareshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
const url = 'file://' + path.resolve('dist/index.html') + '?seed=7&god=1';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const errors = [];
  const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://*.supabase.co/**', (r) => r.abort());
  await page.goto(url);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 7); localStorage.setItem('horders.hero.v1', JSON.stringify(h)); });
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.click('[data-d="glarewell"]', { timeout: 5000 });
  await page.click('#startBtn');
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; });
  const shoot = async (label, cond, ms = 200000) => {
    await page.evaluate(() => { window.__ember.scene().warp = 10; });
    await page.waitForFunction(cond, null, { timeout: ms, polling: 100 }).catch(() => errors.push('timeout ' + label));
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `${tag}-glare-${label}.png`) });
  };
  await shoot('1-fight', () => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.time > 5 && w.enemies.filter((e) => e.alive).length >= 3; });
  await shoot('2-boss', () => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && e.kind === 'lensmother' && w.time - e.spawnedAt > 3); });
  await shoot('3-boss-glare', () => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && e.kind === 'lensmother' && e.castId === 'glare' && e.castT > 1); }, 90000);
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
