// Screenshots the Slagbinder: sprite and Slag Lob in a fight, Molten Plating, Cooling Shell with Brittle foes,
// a party shell, and the hub's five-class picker with the stance row. The bot plays; each shot waits for its state.
// Usage: npm run build && node tools/slagshots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const SCENES = [
  { name: '1-plating', opts: { dungeon: 'kiln', tier: 3 }, until: 'plate' },
  { name: '2-shell-brittle', opts: { dungeon: 'kiln', tier: 3 }, until: 'shell' },
  { name: '3-party-shell', opts: { dungeon: 'hammerdeep', tier: 4, party: [{ cls: 'bulwark' }, { cls: 'lumen' }, { cls: 'emberwright' }] }, until: 'shell' },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=6&god=1`);
  await page.waitForTimeout(700);
  // The hub's class picker first (on phones it sits on the Hero tab).
  await page.evaluate(() => document.querySelector('[data-tab="hero"]')?.click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('[data-cls="slagbinder"]')?.click());
  await page.waitForTimeout(300);
  const picker = await page.evaluate(() => { const el = document.querySelector('.classes'); if (!el) return null; el.scrollIntoView({ block: 'start' }); const r = el.getBoundingClientRect(); const s = el.nextElementSibling; const r2 = (s && s.getBoundingClientRect()) || r; return { x: r.x, y: r.y, width: r.width, height: Math.max(r.height, r2.bottom - r.y) }; });
  if (picker) await page.screenshot({ path: path.join(out, `${tag}-slag-0-picker.png`), clip: { x: Math.max(0, picker.x - 12), y: Math.max(0, picker.y - 12), width: picker.width + 24, height: Math.min(picker.height + 24, 400) } });
  else errs.push('no class picker');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) errs.push('hub scrolls sideways');
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sc of SCENES) {
    await page.evaluate((o) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 6, cls: 'slagbinder', invulnerable: true, ...o }, hud: s.hud, onEnd: () => {} });
    }, sc.opts);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
    // Plating waits for the bot to pour it. The bot rarely casts Cooling Shell, so for the shell shots the tool
    // sets shellUntil (and Brittle on the two nearest foes, solo) once foes close in; the sim draws them as usual.
    await page.waitForFunction((sc) => {
      const s = window.__ember.scene(); const w = s.world; const p = w.player;
      let ok = false;
      if (sc.until === 'plate') ok = w.phase === 'fight' && (p.plateUntil ?? -1) > w.time + 4;
      else {
        const near = w.enemies.map((e, i) => [e, i]).filter(([e]) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < 300);
        ok = w.phase === 'fight' && w.time > 3 && near.length >= 2;
        if (ok) {
          p.shellUntil = w.time + 4;
          if (!sc.opts.party) near.slice(0, 2).forEach(([e]) => { e.brittleUntil = w.time + 4; });
          else { const a = w.heroData(1).player; a.plate = 40; a.plateAmt = 60; a.plateUntil = w.time + 5; a.plateBy = 0; }
        }
      }
      if (ok) s.warp = 0;
      return ok;
    }, sc, { timeout: 60000, polling: 20 }).catch(() => errs.push('timeout ' + sc.name));
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${tag}-slag-${sc.name}.png`) });
  }
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
