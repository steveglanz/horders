// Phase 15 Y4: the Seen log. The end screen's run-shape chips with every chip met for the first time (starred), and
// the hub's Seen chip and sheet for the Kiln with some entries met. Shoots 320 x 568, 568 x 320 and desktop.
// Usage: npm run build && node tools/seenshots.cjs <outDir> [prefix]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots'; const pre = process.argv[3] || 'seen';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const SIZES = { p320: { width: 320, height: 568, mobile: true }, l568: { width: 568, height: 320, mobile: true }, desk: { width: 1280, height: 800, mobile: false } };
const SEEN = ['kiln:boss:draw', 'kiln:wave:ring', 'kiln:mark:Swift', 'kiln:mark:Brood', 'kiln:event:caveIn', 'kiln:heat:richHaul', 'kiln:heat:stoneFloor'];
// SEEN_MORE=a,b adds keys (Y6 art shots meet every trait and both versions to show each glyph).
if (process.env.SEEN_MORE) SEEN.push(...process.env.SEEN_MORE.split(','));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const [tag, s] of Object.entries(SIZES)) {
    const ctx = await b.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 2, isMobile: s.mobile, hasTouch: s.mobile });
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(`${tag}: ${e.message}`));
    const url = `http://127.0.0.1:${srv.address().port}/?seed=2&god=1`;
    await page.goto(url);
    await page.waitForTimeout(600);
    await page.evaluate((seen) => {
      const h = window.__ember.hero();
      h.runs = Math.max(h.runs, 12); h.seen = seen;
      localStorage.setItem('horders.hero.v1', JSON.stringify(h));
    }, SEEN);
    await page.goto(url);
    await page.waitForTimeout(800);
    // The hub: the Seen chip (tab mode) or the Seen log line (wide), then the sheet.
    const chip = await page.evaluate(() => { const el = document.querySelector('[data-prep="seen"]'); return el && el.offsetParent ? el.textContent : null; });
    console.log(tag, 'chip', chip);
    if (chip) {
      await page.evaluate(() => document.querySelector('[data-prep="seen"]').click());
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `${pre}-${tag}-sheet.png`) });
      await page.evaluate(() => { document.getElementById('sheet').hidden = true; });
    } else {
      await page.evaluate(() => document.querySelector('.seen')?.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `${pre}-${tag}-hub.png`) });
    }
    let wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(tag, 'hub', wide ? 'SIDEWAYS SCROLL' : 'no sideways scroll');
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
    const kinds = await page.evaluate(() => new Promise((res) => {
      const s = window.__ember.scene();
      document.getElementById('title').hidden = true;
      s.scene.restart({ opts: { seed: 3, cls: 'emberwright', dungeon: 'kiln', tier: 5 }, hud: s.hud, onEnd: () => {} });
      setTimeout(() => {
        const sc = window.__ember.scene(); const w = sc.world; sc.warp = 0;
        const L = ['pillars', 'channel', 'vents'], E = ['caveIn', 'ventSurge', 'caveIn'];
        w.layoutAt = (k) => L[k % 3]; w.arenaEventAt = (k) => E[k % 3]; const V = ['arc', 'reinforce', 'ring', 'reinforce']; w.waveShapeAt = (k) => V[k % 4];
        w.namedPlan = () => ({ at: 1, affix: 'Smoldering' });
        w.heat = 'stoneFloor'; w.bossVariant = 'cataclysm'; w.stirsMet = 1 | 8;
        sc.hud.showEnd(w, { heroXp: 0, items: [], levelsGained: 0, seenNew: ['kiln:stir:elite', 'kiln:wave:reinforce', 'kiln:boss:cataclysm', 'kiln:mark:Smoldering', 'kiln:event:ventSurge'] });
        res([...document.querySelectorAll('#endShape .shape')].map((e) => `${e.dataset.shape}${e.classList.contains('new') ? '*' : ''}`));
      }, 500);
    }));
    await page.waitForTimeout(300);
    console.log(tag, kinds.join(','));
    const el = page.locator('#endShape');
    if (await el.count()) await el.screenshot({ path: path.join(out, `${pre}-${tag}-chips.png`) });
    wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const lines = await page.evaluate(() => [...document.querySelectorAll('#endShape .shape')].map((e) => Math.round(e.getBoundingClientRect().height)));
    console.log(tag, 'chip heights', lines.join(','), wide ? 'SIDEWAYS SCROLL' : 'no sideways scroll');
    await ctx.close();
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
