// Screenshots the juice: a boss death moment (three frames) and an Epic loot drop.
// Usage: npm run build && node tools/juiceshots.cjs <outDir> [phone]
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
  await page.waitForTimeout(400);
  await page.click('#startBtn');
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 10; });
  // An Epic drop next to the hero, once the first fight is going.
  await page.waitForFunction(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.time > 4; }, null, { timeout: 60000, polling: 100 });
  await page.evaluate(() => {
    const s = window.__ember.scene(); s.warp = 1; s.autopilot = false;
    const w = s.world; w.events.length = 0; w.dropLoot(w.player.x + 70, w.player.y + 10, 'epic'); s.handleEvents(w.events.slice());
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(out, `${tag}-drop-1.png`) });
  await page.waitForTimeout(260);
  await page.screenshot({ path: path.join(out, `${tag}-drop-2.png`) });
  // The boss: fast-forward to it, leave it a sliver of health, then watch it fall at normal speed.
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 10; });
  await page.waitForFunction(() => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && e.def.rank === 'boss' && w.time - e.spawnedAt > 3); }, null, { timeout: 240000, polling: 100 }).catch(() => errors.push('timeout boss'));
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 1; const b = s.world.enemies.find((e) => e.alive && e.def.rank === 'boss'); b.hp = 1; });
  await page.waitForFunction(() => !window.__ember.scene().world.enemies.some((e) => e.alive && e.def.rank === 'boss'), null, { timeout: 30000, polling: 16 }).catch(() => errors.push('timeout kill'));
  for (const [k, ms] of [[1, 120], [2, 300], [3, 450]]) {
    await page.waitForTimeout(ms);
    await page.screenshot({ path: path.join(out, `${tag}-boss-${k}.png`) });
  }
  const endShown = await page.evaluate(() => !document.getElementById('end').hidden);
  console.log('end screen already showing at ~0.9 s:', endShown);
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
