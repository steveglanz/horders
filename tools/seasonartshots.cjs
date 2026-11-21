// The hub during Season 2 (the Deep Bellows): the clock is set to Mon 4 Jan 2027, the hero has played and is
// at season level 18 with two glows and the trail. Shoots the season box (desktop), the dungeon list with its
// "In season" mark, and the phone's season sheet. Usage: npm run build && node tools/seasonartshots.cjs <outDir> [saver] [s1]  (s1: the Hollow Tide instead)
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const saver = process.argv.includes('saver'); const s1 = process.argv.includes('s1');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const NOW = s1 ? Date.UTC(2026, 11, 1, 12) : Date.UTC(2027, 0, 4, 12);
(async () => {
  const b = await chromium.launch();
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    await ctx.addInitScript(([now, saver]) => { const real = Date.now; const t0 = real(); Date.now = () => now + (real() - t0); if (saver) localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'saver' })); }, [NOW, saver]);
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate((s1) => {
      const h = window.__ember.hero(); h.runs = 12; h.maxTier = 9;
      h.season = { id: s1 ? 0 : 1, marks: 9100 };
      h.glows = s1 ? ['tideSilver', 'hollowViolet'] : ['bellowsOrange', 'kilnRed', 'whiteHeat']; h.trails = s1 ? { saltMist: 2 } : { bellowsSparks: 2 };
      h.wear = { glow: s1 ? 'hollowViolet' : 'kilnRed' };
      document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
    }, s1);
    await page.waitForTimeout(300);
    const sfx = `${saver ? '-saver' : ''}${s1 ? '-s1' : ''}`;
    if (tag === 'desk') {
      await page.locator('.dungeons').screenshot({ path: path.join(out, `desk-dungeons${sfx}.png`) });
      const box = page.locator('.prep-full .box.season');
      await box.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
      await box.screenshot({ path: path.join(out, `desk-season${sfx}.png`) });
    } else {
      await page.evaluate(() => document.querySelector('[data-tab="delve"]')?.click());
      await page.waitForTimeout(200);
      const card = page.locator(s1 ? '.dg[data-d="foundry"]' : '.dg[data-d="hammerdeep"]');
      await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      await card.screenshot({ path: path.join(out, `phone-dungeons${sfx}.png`) });
      await page.evaluate(() => document.querySelector('[data-prep="season"]')?.click());
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `phone-season${sfx}.png`) });
    }
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(tag, errs.length ? errs : 'no errors', 'hscroll', wide);
    await ctx.close();
  }
  await b.close(); srv.close();
})();
