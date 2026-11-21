// Each Deep Bellows glow on a lone hero (no party ring), on the Kiln and the Glarewell floors, plain, greyscale and deuteranopia.
// Usage: npm run build && node tools/glowmarkshots.cjs <outDir>
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => { document.getElementById('startBtn').click(); document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute"><filter id="deut"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0"/></filter></svg>'); });
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const d of ['kiln', 'glarewell']) for (const g of ['bellowsOrange', 'kilnRed', 'whiteHeat']) {
    await page.evaluate(([d, g]) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 7, cls: 'emberwright', dungeon: d, tier: 4, invulnerable: true }, hud: s.hud, onEnd: () => {}, glow: g }); }, [d, g]);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__ember.scene().scene.pause());
    for (const [k, f] of [['plain', ''], ['grey', 'grayscale(1)'], ['deut', 'url(#deut)']]) {
      await page.evaluate((f) => { document.documentElement.style.filter = f; }, f);
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(out, `${d}-${g}-${k}.png`), clip: { x: 590, y: 300, width: 100, height: 90 } });
    }
    await page.evaluate(() => { document.documentElement.style.filter = ''; window.__ember.scene().scene.resume(); });
  }
  console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close(); srv.close();
})();
