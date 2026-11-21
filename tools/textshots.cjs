// Screenshots the Text size setting (L3): the same fight frame and hub sheet at Normal and
// Large, on a phone and a desktop. The setting is put in storage before the page loads.
// Usage: npm run build && node tools/textshots.cjs <outDir>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['phone', { ...devices['iPhone 13'] }], ['desk', { viewport: { width: 1280, height: 720 } }]]) {
    for (const text of ['normal', 'large']) {
      const ctx = await b.newContext(opt);
      await ctx.route('https://*.supabase.co/**', (r) => r.abort());
      await ctx.addInitScript((t) => { try { localStorage.setItem('horders.display.v1', JSON.stringify({ text: t })); } catch {} }, text);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=4&god=1`);
      await page.waitForTimeout(700);
      // The weekly sheet: small print in a menu.
      await page.evaluate(() => {
        const h = window.__ember.hero(); h.runs = Math.max(h.runs, 5);
        document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
        document.querySelector('[data-prep="weekly"]')?.click();
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `${tag}-${text}-hub.png`) });
      await page.evaluate(() => document.querySelector('.sheet .close, [data-close]')?.click());
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.getElementById('startBtn').click());
      await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
      // A named Cinder Brute fight, frozen once the intro has gone: plates, target frame, quests.
      await page.evaluate(() => {
        const s = window.__ember.scene();
        s.scene.restart({ opts: { seed: 4, cls: 'emberwright', dungeon: 'kiln', route: ['brute', 'kilnMother'], tier: 3, invulnerable: true }, hud: s.hud, onEnd: () => {} });
      });
      await page.waitForTimeout(700);
      await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 1; });
      await page.waitForTimeout(5000);
      await page.evaluate(() => { const w = window.__ember.scene().world; const e = w.enemies.find((o) => o.alive && o.kind === 'cinderBrute'); if (e) { e.named = 9; e.affix = 1; e.ward = e.maxHp * 0.3; e.x = e.px = w.player.x + 150; e.y = e.py = w.player.y - 20; } });
      await page.waitForTimeout(600);
      await page.evaluate(() => { window.__ember.scene().warp = 0; });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(out, `${tag}-${text}-fight.png`) });
      console.log(tag, text, errs.length ? errs.join('\n') : 'no errors');
      await ctx.close();
    }
  }
  await b.close(); srv.close();
})();
