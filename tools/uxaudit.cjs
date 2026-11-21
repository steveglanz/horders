// Phone UX audit: screenshots every menu and in-run screen at four phone viewports
// (375x667 and 390x844, portrait and landscape) with a mid-game hero, against a fake backend.
//
//   npm run build && node tools/uxaudit.cjs <outDir> [se|13|se-land|13-land ...]
//
// Shots per viewport: hub (first screen and the whole scroll), hub with gear/talents open,
// delve setup, co-op box, bags, in-run HUD, talent draft, pause, boss fight and end screen.
// Each viewport also writes <tag>-metrics.json: how tall the hub scroll is in screens, and
// which buttons are under 44px.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');

const out = process.argv[2] || 'tools/shots/ux';
const want = new Set(process.argv.slice(3));
fs.mkdirSync(out, { recursive: true });
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const VIEWS = {
  se: { width: 375, height: 667 },
  13: { width: 390, height: 844 },
  'se-land': { width: 667, height: 375 },
  '13-land': { width: 844, height: 390 },
};
const HERO = fs.readFileSync(path.resolve('tools/heroes/hero-t6.json'), 'utf8');

function serve() {
  const html = fs.readFileSync(path.resolve('dist/index.html'));
  return http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
}

async function fakeBackend(page) {
  const boss = { id: 1, name: 'Grandmother Slag', title: 'Mother of Kilns', hp: 312000, max_hp: 500000, omen: 'warded', fighters: 41, my_damage: 18400, unclaimed: [] };
  await page.route('https://*.supabase.co/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
    if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json([]);
    if (u.pathname === '/rest/v1/hero_saves') return route.fulfill({ status: 201, body: '' });
    if (u.pathname.endsWith('/world_boss_status')) return json(boss);
    if (u.pathname.endsWith('/strike_world_boss')) return json({ ok: true, name: boss.name, dealt: 4000, hp: boss.hp, max_hp: boss.max_hp, defeated: false });
    return json({}, 404);
  });
}

/** Buttons under 44px tall or wide among the visible ones, and how many screens the hub scrolls. */
async function metrics(page, overlay) {
  return page.evaluate((overlay) => {
    const o = document.getElementById(overlay);
    const small = [];
    for (const b of document.querySelectorAll('button, summary, [role=button], input, select')) {
      const r = b.getBoundingClientRect();
      if (!r.width || !r.height || b.closest('[hidden]')) continue;
      if (r.height < 44 || r.width < 44) small.push(`${(b.id ? '#' + b.id : b.className || b.tagName).toString().slice(0, 30)} "${(b.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return { screens: o ? +(o.scrollHeight / innerHeight).toFixed(2) : 0, scrollHeight: o?.scrollHeight ?? 0, small };
  }, overlay);
}

/** Screenshot the whole scroll of an overlay by growing the viewport to its height. */
async function fullShot(page, overlay, file, vp) {
  const h = await page.evaluate((id) => document.getElementById(id).scrollHeight, overlay);
  await page.setViewportSize({ width: vp.width, height: Math.min(h, 6000) });
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, type: 'jpeg', quality: 70 });
  await page.setViewportSize(vp);
  await page.waitForTimeout(250);
}

async function run(browser, tag) {
  const vp = VIEWS[tag];
  const srv = serve();
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript((hero) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('horders.hero.v1', hero); sessionStorage.setItem('seeded', '1'); } }, HERO);
  const page = await ctx.newPage();
  await fakeBackend(page);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${tag}-${n}.jpg`), type: 'jpeg', quality: 72 });
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1&localparty=1`);
  await page.waitForTimeout(1500);
  const report = { viewport: vp };

  await shot('01-hub');
  report.hub = await metrics(page, 'title');
  await fullShot(page, 'title', path.join(out, `${tag}-02-hub-full.jpg`), vp);
  const kit = await page.$('details.kit summary');
  if (kit && !(await page.evaluate(() => document.querySelector('details.kit').open))) {
    await kit.click();
    await page.waitForTimeout(200);
    await shot('03-hub-kit-open');
    await kit.click();
  }
  await page.evaluate(() => document.querySelector('.hub-delve')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(150);
  await shot('04-delve-setup');
  await page.evaluate(() => document.querySelector('.pots')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(150);
  await shot('05-potions');
  await page.evaluate(() => document.getElementById('coop')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(150);
  await shot('06-coop');
  await page.evaluate(() => { document.getElementById('title').scrollTop = 0; });

  await page.click('#bagBtn');
  await page.waitForTimeout(300);
  await shot('07-bags');
  report.bags = await metrics(page, 'bag');
  await page.click('#bagClose');
  await page.waitForTimeout(200);

  // A run: the HUD mid-fight, then a draft with auto-pick off.
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 20000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = false; s.warp = 3; });
  await page.waitForFunction(() => { const w = window.__ember.scene().world; return w.time > 6 && w.enemies.some((e) => e.alive); }, null, { timeout: 60000 }).catch(() => errs.push('no fight'));
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.waitForTimeout(250);
  await shot('08-hud');
  report.hud = await metrics(page, 'hud');
  await page.evaluate(() => { window.__ember.scene().warp = 4; });
  await page.waitForFunction(() => !document.getElementById('draft').hidden, null, { timeout: 120000 }).catch(() => errs.push('no draft'));
  await page.waitForTimeout(300);
  await shot('09-draft');
  report.draft = await metrics(page, 'draft');
  await page.evaluate(() => { const s = window.__ember.scene(); s.autoPick = true; });
  await page.waitForFunction(() => document.getElementById('draft').hidden, null, { timeout: 20000 }).catch(() => {});
  await page.click('#pauseBtn').catch(() => errs.push('no pause button'));
  await page.waitForTimeout(300);
  await shot('10-pause');
  await page.click('#resumeBtn').catch(() => {});

  // Boss: restart straight into the Kiln Mother.
  await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 7, invulnerable: true, cls: 'emberwright', dungeon: 'kiln', route: ['kilnMother'], tier: 6 }, hud: s.hud, onEnd: s.onEnd }); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  await page.waitForFunction(() => { const w = window.__ember.scene().world; const b = w.enemies.find((e) => e.alive && e.kind === 'kilnMother'); if (b && w.time - b.spawnedAt > 6) { window.__ember.scene().warp = 0; return true; } return false; }, null, { timeout: 60000, polling: 50 }).catch(() => errs.push('no boss'));
  await page.waitForTimeout(250);
  await shot('11-boss');

  // End screen: let it finish at speed.
  await page.evaluate(() => { const s = window.__ember.scene(); s.world.player.invulnerable = false; s.warp = 12; });
  await page.waitForFunction(() => !document.getElementById('end').hidden, null, { timeout: 180000 }).catch(() => errs.push('no end'));
  await page.waitForTimeout(1200);
  await shot('12-end');
  report.end = await metrics(page, 'end');
  await fullShot(page, 'end', path.join(out, `${tag}-13-end-full.jpg`), vp);

  report.errors = errs;
  fs.writeFileSync(path.join(out, `${tag}-metrics.json`), JSON.stringify(report, null, 1));
  console.log(tag, `hub ${report.hub.screens} screens`, errs.length ? errs.join('; ') : 'no errors');
  await ctx.close(); srv.close();
}

(async () => {
  const browser = await chromium.launch({ args: GL });
  for (const tag of Object.keys(VIEWS)) if (!want.size || want.has(tag)) await run(browser, tag);
  await browser.close();
})();
