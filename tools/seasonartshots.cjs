// The hub during Season 2 (the Deep Bellows): the clock is set to Mon 4 Jan 2027, the hero has played and is
// at season level 18 with two glows and the trail. Shoots the season box (desktop), the dungeon list with its
// "In season" mark, and the phone's season sheet. Usage: npm run build && node tools/seasonartshots.cjs <outDir> [saver] [s1|s3|s4|s5|s6]  (s1: the Hollow Tide, s3: the Cold Hearth on Mon 15 Feb 2027, s4: the Slag Moon on Mon 29 Mar 2027, s5: the Falling Press on Mon 10 May 2027, s6: the Low Ebb on Mon 21 Jun 2027, instead)
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const saver = process.argv.includes('saver'); const s1 = process.argv.includes('s1'); const s3 = process.argv.includes('s3'); const s4 = process.argv.includes('s4'); const s5 = process.argv.includes('s5'); const s6 = process.argv.includes('s6');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const NOW = s1 ? Date.UTC(2026, 11, 1, 12) : s3 ? Date.UTC(2027, 1, 15, 12) : s4 ? Date.UTC(2027, 2, 29, 12) : s5 ? Date.UTC(2027, 4, 10, 12) : s6 ? Date.UTC(2027, 5, 21, 12) : Date.UTC(2027, 0, 4, 12);
const LOOK = s1 ? { id: 0, glows: ['tideSilver', 'hollowViolet'], trails: { saltMist: 2 }, wear: 'hollowViolet', dungeon: 'foundry', sfx: '-s1' }
  : s5 ? { id: 4, glows: ['oilGreen', 'rivetBlue', 'hotStamp'], trails: { oilSheen: 2 }, wear: 'hotStamp', dungeon: 'pressworks', sfx: '-s5' }
  : s6 ? { id: 5, glows: ['wrackOlive', 'drainBlue', 'ebbIndigo'], trails: { raftSplinters: 2 }, wear: 'ebbIndigo', dungeon: 'wrackline', sfx: '-s6' }
  : s4 ? { id: 3, glows: ['slagGold', 'moonAsh', 'pourCrimson'], trails: { slagDrips: 2 }, wear: 'pourCrimson', dungeon: 'glarewell', sfx: '-s4' }
  : s3 ? { id: 2, glows: ['rimeBlue', 'coalGlow', 'frostbite'], trails: { rimeDust: 2 }, wear: 'coalGlow', dungeon: 'coldmarrow', sfx: '-s3' }
  : { id: 1, glows: ['bellowsOrange', 'kilnRed', 'whiteHeat'], trails: { bellowsSparks: 2 }, wear: 'kilnRed', dungeon: 'hammerdeep', sfx: '' };
(async () => {
  const b = await chromium.launch();
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    await ctx.addInitScript(([now, saver]) => { const real = Date.now; const t0 = real(); Date.now = () => now + (real() - t0); if (saver) localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'saver' })); }, [NOW, saver]);
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
    await page.waitForTimeout(700);
    await page.evaluate((L) => {
      const h = window.__ember.hero(); h.runs = 12; h.maxTier = 10;
      h.season = { id: L.id, marks: 9100 };
      h.glows = L.glows; h.trails = L.trails;
      h.wear = { glow: L.wear };
      document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
    }, LOOK);
    await page.waitForTimeout(300);
    const sfx = `${saver ? '-saver' : ''}${LOOK.sfx}`;
    if (tag === 'desk') {
      await page.locator('.dungeons').screenshot({ path: path.join(out, `desk-dungeons${sfx}.png`) });
      const box = page.locator('.prep-full .box.season');
      await box.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
      await box.screenshot({ path: path.join(out, `desk-season${sfx}.png`) });
    } else {
      await page.evaluate(() => document.querySelector('[data-tab="delve"]')?.click());
      await page.waitForTimeout(200);
      const card = page.locator(`.dg[data-d="${LOOK.dungeon}"]`);
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
