// Screenshots verb-set pieces: the hero card's gear marker and the bag's set block.
// Plays one god-mode run for loot, then marks two worn pieces and one bag piece as Kilnbreaker.
// Usage: npm run build && node tools/setshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://*.supabase.co/**', (r) => r.abort());
  const tag = phone ? 'phone' : 'desk';
  const url = 'file://' + path.resolve('dist/index.html') + '?seed=4&god=1';
  await page.goto(url);
  await page.waitForTimeout(600);
  await page.click('#startBtn');
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 12; });
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && await page.evaluate(() => document.getElementById('end').hidden)) await page.waitForTimeout(250);
  await page.evaluate(() => {
    const h = window.__ember.hero();
    // Sets only roll on head, hands and trinket: wear head and hands, leave a trinket in the bag.
    const worn = new Set(Object.values(h.equipped));
    for (const slot of ['head', 'hands']) { const it = h.inventory.find((i) => i.id === h.equipped[slot]); if (it) it.set = 'kilnbreaker'; }
    const loose = h.inventory.find((it) => !worn.has(it.id) && it.slot === 'trinket') ?? h.inventory.find((it) => !worn.has(it.id));
    if (loose) loose.set = 'kilnbreaker';
    localStorage.setItem('horders.hero.v1', JSON.stringify(h));
  });
  await page.goto(url);
  await page.waitForTimeout(1000);
  await (await page.$('#heroCard')).screenshot({ path: path.join(out, `${tag}-sets-gear.png`) });
  await page.click('#bagBtn');
  await page.waitForTimeout(300);
  const items = await page.$$('#bagList .item');
  let k = 0;
  for (const el of items) {
    if (await el.$('.setb')) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(out, `${tag}-sets-item-${++k}.png`) }); }
    if (k >= 2) break;
  }
  console.log('set cards shot:', k, errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
