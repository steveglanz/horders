// Checks the online features against a fake backend, and the offline fallback.
// Usage: node tools/cloudcheck.cjs <outDir> [offline]
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'tools/shots';
const offline = process.argv[3] === 'offline';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; const calls = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  let boss = { id: 1, name: 'Grandmother Slag', title: 'Mother of Kilns', hp: 488000, max_hp: 500000, fighters: 3, my_damage: 0,
    unclaimed: [{ boss_id: 0, name: 'Old Ashmaw', damage: 9000, max_hp: 500000 }] };
  let saved = null;
  await page.route('https://gadnkjsxpnchmvsjgnum.supabase.co/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    calls.push(req.method() + ' ' + u.pathname);
    if (offline) return route.abort('internetdisconnected');
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
    if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json(saved ? [{ hero: saved }] : []);
    if (u.pathname === '/rest/v1/hero_saves') { saved = JSON.parse(req.postData()).hero; return route.fulfill({ status: 201, body: '' }); }
    if (u.pathname.endsWith('/world_boss_status')) return json(boss);
    if (u.pathname.endsWith('/strike_world_boss')) {
      const { p_damage } = JSON.parse(req.postData()); const d = Math.min(p_damage, 60000);
      boss = { ...boss, hp: boss.hp - d, my_damage: boss.my_damage + d };
      return json({ ok: true, name: boss.name, dealt: d, hp: boss.hp, max_hp: boss.max_hp, defeated: false });
    }
    if (u.pathname.endsWith('/claim_world_boss_reward')) { boss = { ...boss, unclaimed: [] }; return json({ ok: true, damage: 9000, name: 'Old Ashmaw' }); }
    return json({}, 404);
  });
  const tag = offline ? 'offline' : 'online';
  await page.goto('file://' + path.resolve('dist/index.html') + '?seed=4&god=1');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${tag}-0-title.png`) });
  const panel0 = await page.textContent('#worldBoss');
  let claimNote = '', epic = false;
  if (!offline) {
    await page.click('[data-claim]');
    await page.waitForTimeout(800);
    claimNote = await page.textContent('#worldBoss');
    epic = await page.evaluate(() => window.__ember.hero().inventory.some((i) => i.rarity === 'epic' || i.rarity === 'mythic'));
  }
  await page.click('#startBtn');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 12; });
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    if (await page.evaluate(() => window.__ember.scene().world.state === 'ended')) break;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${tag}-1-end.png`) });
  const endBoss = await page.textContent('#endBoss');
  await page.click('#menuBtn');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${tag}-2-menu.png`) });
  console.log(JSON.stringify({ tag, panel0, claimNote, epic, endBoss, panel1: await page.textContent('#worldBoss'),
    saveNote: await page.textContent('#saveNote'), savedRuns: saved && saved.runs, calls: [...new Set(calls)], errors }, null, 1));
  await browser.close();
})();
