// CP3 opening PR 1 check (docs/design/opening.md): a fresh save opens on the wake screen and taps
// into the Kiln with no hub; a save that has delved opens on the hub. 390x844 phone, fake backend.
// node tools/wakecheck.cjs [outDir]   (after npm run build)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'docs/art/opening-cp3');
fs.mkdirSync(out, { recursive: true });
const dist = path.resolve('dist');
const files = http.createServer((q, r) => {
  const p = path.join(dist, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  const f = p.endsWith(path.sep) || p === dist ? path.join(dist, 'index.html') : p;
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch();
  const page0 = async (hero) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if (hero) await ctx.addInitScript((h) => localStorage.setItem('horders.hero.v1', h), JSON.stringify(hero));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail('pageerror ' + e.message + ' ' + (e.stack||'').split('\n').slice(0,4).join(' | ')));
    // Fake backend, as tools/playdriver.cjs: the live Supabase project is never touched.
    await page.route('https://*.supabase.co/**', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
      if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
      if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json([]);
      if (u.pathname === '/rest/v1/hero_saves') return route.fulfill({ status: 201, body: '' });
      if (u.pathname.endsWith('/world_boss_status')) return json({ id: 1, name: 'Old Vorhulm', title: 'the Glutton', hp: 312000, max_hp: 500000, omen: 'warded', fighters: 41, my_damage: 0, unclaimed: [] });
      return json([], 200);
    });
    await page.goto(`http://127.0.0.1:${files.address().port}/?hd2d=0`);
    await page.waitForFunction(() => !!window.__ember);
    await page.waitForTimeout(800);
    return { page, ctx };
  };
  const vis = (page, sel) => page.evaluate((s) => !document.querySelector(s).hidden, sel);

  // 1. A fresh save.
  const { page, ctx } = await page0(null);
  if (!(await vis(page, '#wake'))) fail('fresh save: wake screen not showing');
  await page.screenshot({ path: `${out}/1-title.png` });
  await page.keyboard.press('Enter');
  if (await page.evaluate(() => !!window.__ember.scene()?.world)) fail('Enter on the wake screen started a delve');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/2-line1.png` });
  await page.touchscreen.tap(195, 500);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/3-line2.png` });
  const line2 = await page.textContent('#wake .wake-line');
  // Leave the last line to its own timer (4 s).
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  const w = await page.evaluate(() => { const w = window.__ember.scene().world; return { first: w.firstDelve, dungeon: w.dungeonId, tier: w.tier }; });
  if (await vis(page, '#wake')) fail('wake still showing in the run');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/4-opening.png` });
  console.log('fresh save:', JSON.stringify({ line2, ...w }));
  if (!w.first || w.dungeon !== 'kiln') fail('not the first-delve Kiln');
  await ctx.close();

  // 2. A save that has delved.
  const { page: p2 } = await page0({ version: 1, level: 3, xp: 0, passives: {}, embers: 0, inventory: [], equipped: {}, pity: 0, runs: 2, wins: 1, bestTime: 0, nextItemId: 1, maxTier: 2 });
  const hubOk = !(await vis(p2, '#wake')) && (await vis(p2, '#title'));
  console.log('played save opens on hub:', hubOk);
  if (!hubOk) fail('played save did not open on the hub');
  await browser.close();
  files.close();
  console.log(process.exitCode ? 'FAILED' : 'ALL PASS');
})();
