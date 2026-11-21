// Screenshots the ability options (ALT_ABILITIES, level 8): each class's option glyph on the
// action bar, its cast, and what it leaves behind (Ember Ward, Hamstring's slow, Rallying Cry,
// Lightwell, Slag Pit). The bot casts options at its own pace, so the tool sets each option's
// state directly and plays the cast effect on top. No network.
// Usage: npm run build && node tools/altshots.cjs <outDir> [phone] [saver]
// 'saver' sets Graphics to Battery saver, which trims the effects' extra detail.
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
const saver = process.argv.includes('saver');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);

const SCENES = [
  { name: '1-emberward', cls: 'emberwright', opts: { dungeon: 'kiln', tier: 3 } },
  { name: '2-hamstring', cls: 'duskblade', opts: { dungeon: 'kiln', tier: 3 } },
  { name: '3-rallyingcry', cls: 'bulwark', opts: { dungeon: 'hammerdeep', tier: 4, party: [{ cls: 'bulwark' }, { cls: 'lumen' }, { cls: 'duskblade' }] } },
  { name: '4-lightwell', cls: 'lumen', opts: { dungeon: 'kiln', tier: 3 } },
  { name: '5-slagpit', cls: 'slagbinder', opts: { dungeon: 'kiln', tier: 3 } },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = (phone ? 'phone' : 'desk') + (saver ? '-saver' : '');
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  if (saver) await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'saver' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((sc) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 7, cls: sc.cls, alt: true, invulnerable: true, ...sc.opts }, hud: s.hud, onEnd: () => {} });
    }, sc);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
    const at = await page.waitForFunction(() => {
      const s = window.__ember.scene(); const w = s.world; const p = w.player;
      const near = w.enemies.filter((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 260);
      const ok = w.phase === 'fight' && w.time > 7 && near.length >= 2 && near.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 170);
      if (ok) s.warp = 0;
      return ok;
    }, null, { timeout: 120000, polling: 20 }).then(() => true).catch(() => { errs.push('timeout ' + sc.name); return false; });
    if (!at) continue;
    await page.evaluate((cls) => {
      const s = window.__ember.scene(); const w = s.world; const p = w.player; const t = w.time;
      const foes = w.enemies.filter((e) => e.alive).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      const f = foes[0];
      if (cls === 'emberwright') {
        p.plate = p.maxHp * 0.25; p.plateAmt = p.plate; p.plateUntil = t + 3; p.plateBy = -1;
        s.altCast(p.x, p.y, 40);
      } else if (cls === 'duskblade') {
        for (const e of foes) if (Math.hypot(e.x - f.x, e.y - f.y) <= 120) { e.slowUntil = t + 4; e.slowMult = 0.5; }
        s.altCast(f.x, f.y, 120);
      } else if (cls === 'bulwark') {
        for (let k = 0; k < w.heroes.length; k++) w.heroData(k).player.cryUntil = t + 5;
        s.altCast(p.x, p.y, 200);
      } else if (cls === 'lumen') {
        p.wellUntil = t + 6; p.wellX = p.x + 30; p.wellY = p.y + 10;
        s.altCast(p.wellX, p.wellY, 90);
      } else if (cls === 'slagbinder') {
        p.pitUntil = t + 5; p.pitX = f.x; p.pitY = f.y;
        for (const e of foes) if (Math.hypot(e.x - f.x, e.y - f.y) <= 80) { e.slowUntil = t + 1; e.slowMult = 0.4; }
        s.altCast(f.x, f.y, 80);
      }
    }, sc.cls);
    await page.waitForTimeout(30);
    await page.screenshot({ path: path.join(out, `${tag}-alt-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
