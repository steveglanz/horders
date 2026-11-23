// X6: the run-shape chips on the end screen, with each kind's accent. Forces every chip a run can roll on one Kiln
// fight, then shoots it at 320 x 568,
// 568 x 320 and desktop. Usage: npm run build && node tools/shapeshots.cjs <outDir> [prefix]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots'; const pre = process.argv[3] || 'after';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const SIZES = { p320: { width: 320, height: 568, mobile: true }, l568: { width: 568, height: 320, mobile: true }, desk: { width: 1280, height: 800, mobile: false } };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const [tag, s] of Object.entries(SIZES)) {
    const ctx = await b.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2, isMobile: s.mobile, hasTouch: s.mobile });
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
    // One fight is enough: the world's own answers are swapped for every chip a run can roll (a floor of each kind,
    // a marked foe, two events, a boss version and a Heat), as #479 did for its 320 px check.
    const kinds = await page.evaluate(() => new Promise((res) => {
      const s = window.__ember.scene();
      const h = window.__ember.hero(); h.runs = Math.max(h.runs, 12);
      document.getElementById('title').hidden = true;
      s.scene.restart({ opts: { seed: 3, cls: 'emberwright', dungeon: 'kiln', tier: 5 }, hud: s.hud, onEnd: () => {} });
      setTimeout(() => {
        const sc = window.__ember.scene(); const w = sc.world; sc.warp = 0;
        const L = ['pillars', 'channel', 'vents'], E = ['caveIn', 'ventSurge', 'caveIn'];
        w.layoutAt = (k) => L[k % 3]; w.arenaEventAt = (k) => E[k % 3];
        w.namedPlan = () => ({ at: 1, affix: 'Smoldering' });
        w.heat = 'stoneFloor'; w.bossVariant = 'draw';
        sc.hud.showEnd(w);
        res([...document.querySelectorAll('#endShape .shape')].map((e) => e.dataset.shape));
      }, 500);
    }));
    await page.waitForTimeout(300);
    console.log(tag, kinds.join(','));
    await page.screenshot({ path: path.join(out, `${pre}-${tag}.png`) });
    const el = page.locator('#endShape');
    if (await el.count()) await el.screenshot({ path: path.join(out, `${pre}-${tag}-chips.png`) });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const lines = await page.evaluate(() => [...document.querySelectorAll('#endShape .shape')].map((e) => Math.round(e.getBoundingClientRect().height)));
    console.log(tag, 'heights', lines.join(','), wide ? 'SIDEWAYS SCROLL' : 'no sideways scroll');
    await ctx.close();
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
