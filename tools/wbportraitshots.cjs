// Screenshots the hub's world boss card (X2) with each boss's portrait, against a fake backend, plus one mid-flash
// after its health drops. Usage: npm run build && node tools/wbportraitshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const BOSSES = [['slag', 'Grandmother Slag', 'Mother of Kilns'], ['colossus', 'The Cinder Colossus', 'Walking Forge'], ['vorhulm', 'Old Vorhulm', 'Eater of Embers'], ['regent', 'The Furnace Regent', 'Lord of the Deep Bellows']];
(async () => {
  const b = await chromium.launch();
  const tag = phone ? 'phone' : 'desk';
  const errs = [];
  for (const [id, name, title] of BOSSES) {
    const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const boss = { id: 1, name, title, hp: 312000, max_hp: 500000, omen: 'warded', fighters: 41, my_damage: 18400, unclaimed: [] };
    await ctx.route('https://*.supabase.co/**', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      const json = (v, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v) });
      if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
      if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json([]);
      if (u.pathname === '/rest/v1/hero_saves') return route.fulfill({ status: 201, body: '' });
      if (u.pathname.endsWith('/world_boss_status')) return json(boss);
      return json({}, 404);
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3`);
    await page.waitForTimeout(1200);
    if (phone) await page.evaluate(() => document.querySelector('[data-tab="group"]')?.click());
    await page.waitForTimeout(300);
    const card = await page.$('#worldBoss');
    if (!card || !(await card.isVisible())) { errs.push('no card ' + id); await ctx.close(); continue; }
    await card.scrollIntoViewIfNeeded();
    const has = await page.evaluate(() => !!document.querySelector('#worldBoss .wb-art'));
    if (!has) errs.push('no portrait ' + id);
    await card.screenshot({ path: path.join(out, `${tag}-wb-${id}.png`) });
    if (id === 'slag') {
      // A strike lands: the health drops and the card re-renders; shoot early in the flash.
      await page.evaluate(() => { const h = window.__ember.hub(); h.boss = { ...h.boss, hp: h.boss.hp - 4000 }; h.renderBoss(); });
      await page.waitForTimeout(60);
      await card.screenshot({ path: path.join(out, `${tag}-wb-slag-hit.png`) });
      const hit = await page.evaluate(() => document.querySelector('#worldBoss .wb-art')?.classList.contains('hit'));
      if (!hit) errs.push('no hit flash');
    }
    await ctx.close();
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
