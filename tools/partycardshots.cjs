// A draft showing a capstone, a deep card and two party cards (Season 2), on desktop and phone.
// Usage: npm run build && node tools/partycardshots.cjs <outDir>
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 7, cls: 'bulwark', dungeon: 'hammerdeep', tier: 6, invulnerable: true, party: [{ cls: 'lumen', name: 'Lumen 6' }] }, hud: s.hud, onEnd: () => {} }); });
    await page.waitForTimeout(800);
    await page.evaluate(() => { const s = window.__ember.scene(); s.scene.pause(); const w = s.world;
      w.choices = [{ id: 'leeSide', nextRank: 1 }, { id: 'broadBack', nextRank: 1 }, { id: 'rivetedPlates', nextRank: 1 }];
      s.hud.draftShownFor = -1; s.hud.showDraft(w); });
    await page.waitForTimeout(300);
    console.log(tag, await page.evaluate(() => [...document.querySelectorAll('#cards .card')].map((c) => c.className + ' | ' + c.querySelector('.name')?.textContent)));
    await page.screenshot({ path: path.join(out, `${tag}-party-cards.png`) });
    console.log(tag, errs.length ? errs : 'no errors');
    await ctx.close();
  }
  await b.close(); srv.close();
})();
