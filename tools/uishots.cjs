// Screenshots the menus (hub, delve setup, bags, end of run) against a fake world-boss backend.
// Plays one god-mode autopilot run first so the hero has real loot.
// Usage: npm run build && node tools/uishots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv[3] === 'phone';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = phone ? await browser.newContext({ ...devices['iPhone 13'] }) : await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  let boss = { id: 1, name: 'Grandmother Slag', title: 'Mother of Kilns', hp: 312000, max_hp: 500000, omen: 'warded', fighters: 41, my_damage: 18400, unclaimed: [] };
  await page.route('https://*.supabase.co/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
    if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json([]);
    if (u.pathname === '/rest/v1/hero_saves') return route.fulfill({ status: 201, body: '' });
    if (u.pathname.endsWith('/world_boss_status')) return json(boss);
    if (u.pathname.endsWith('/strike_world_boss')) {
      const d = Math.min(JSON.parse(req.postData()).p_damage, 60000);
      boss = { ...boss, hp: boss.hp - d, my_damage: boss.my_damage + d };
      return json({ ok: true, name: boss.name, dealt: d, hp: boss.hp, max_hp: boss.max_hp, defeated: false });
    }
    return json({}, 404);
  });
  const tag = phone ? 'phone' : 'desk';
  const shot = (n) => page.screenshot({ path: path.join(out, `${tag}-${n}.png`) });
  const scrollOverlay = (id, to) => page.evaluate(([id, to]) => { const o = document.getElementById(id); o.scrollTop = to === 'end' ? o.scrollHeight : to; }, [id, to]);
  const url = 'file://' + path.resolve('dist/index.html') + '?seed=4&god=1';
  await page.goto(url);
  await page.waitForTimeout(800);
  // Unlock the Foundry, Omens and the bounty, so the delve setup shows everything.
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 4); h.embers = 640; localStorage.setItem('horders.hero.v1', JSON.stringify(h)); });
  await page.goto(url);
  await page.waitForTimeout(1200);
  await shot('0-title-fresh');
  await page.click('#startBtn');
  await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 12; });
  const t0 = Date.now();
  while (Date.now() - t0 < 240000 && await page.evaluate(() => document.getElementById('end').hidden)) await page.waitForTimeout(250);
  await page.waitForTimeout(1500);
  await shot('1-end');
  await scrollOverlay('end', 'end');
  await page.waitForTimeout(200);
  await shot('1-end-bottom');
  await page.click('#menuBtn');
  await page.waitForTimeout(800);
  await shot('2-hub');
  await scrollOverlay('title', 'end');
  await page.waitForTimeout(200);
  await shot('2-hub-bottom');
  await scrollOverlay('title', 0);
  await page.evaluate(() => document.getElementById('bagBtn').click()); // hidden on phones, where the Bags tab opens it
  await page.waitForTimeout(300);
  await shot('3-bag');
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
