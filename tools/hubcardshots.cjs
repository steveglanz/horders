// Screenshots hub cards that live behind prep chips: the weekly quests sheet (one quest
// done, one part way, one fresh, then all three done with the title), on desktop and phone.
// Usage: npm run build && node tools/hubcardshots.cjs <outDir> [raids]
// (raids: the three raids at 320 px instead: each raid card picked by a solo tier 10 hero, then the hub scrolled to
// its end with the party line's lock lines (four heroes, no bots) and the Delve button; reports horizontal scroll)
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const RAIDS = ['crucible', 'hoard', 'smeltery'];
async function raids(b) {
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const h = window.__ember.hero(); h.runs = Math.max(h.runs, 12); h.maxTier = 10;
    document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
    document.querySelector('[data-tab="delve"]')?.click();
  });
  await page.waitForTimeout(300);
  for (const id of RAIDS) {
    await page.evaluate((id) => document.querySelector(`.dg[data-d="${id}"]`)?.click(), id);
    await page.waitForTimeout(300);
    const card = page.locator(`.dg[data-d="${id}"]`);
    await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    await card.screenshot({ path: path.join(out, `se-raid-${id}-card.png`) });
    if (!(await page.locator('.partyroles').count())) errs.push(`no party line for ${id}`);
    // The party line sits above the fixed Delve button only once the hub is scrolled to its end. (Playwright's mouse
    // rests at 0,0, so whatever scrolls under it would pop a hover tip: hide tips for the shot.)
    await page.evaluate(() => { const t = document.getElementById('title'); if (t) t.scrollTop = 1e5; });
    await page.addStyleTag({ content: '#tip { display: none !important; }' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `se-raid-${id}.png`) });
    const info = await page.evaluate(() => ({ start: document.getElementById('startBtn')?.textContent, wide: document.documentElement.scrollWidth > window.innerWidth, lines: [...document.querySelectorAll('.partyroles .hint')].map((e) => e.textContent) }));
    console.log('se', id, JSON.stringify(info));
  }
  console.log('se raids', errs.length ? errs.join('\n') : 'no errors');
  await ctx.close();
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (process.argv.includes('raids')) { await raids(b); await b.close(); srv.close(); return; }
  for (const [tag, opt] of [['desk', { viewport: { width: 1280, height: 800 } }], ['phone', { ...devices['iPhone 13'] }]]) {
    const ctx = await b.newContext(opt);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=2&god=1`);
    await page.waitForTimeout(700);
    for (const [name, all] of [['weekly', false], ['weekly-done', true]]) {
      await page.evaluate((all) => {
        const h = window.__ember.hero();
        h.runs = Math.max(h.runs, 5); h.maxTier = Math.max(h.maxTier, 6);
        // Prime this week's quests the way the hub rolls them, then fill in some progress.
        delete h.weekly;
        document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
      }, all);
      // Read the rolled quests back from the chip's sheet by forcing a save shape: the hub reads h.weekly when set.
      await page.evaluate((all) => {
        const h = window.__ember.hero();
        const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
        const q = (id, goal, progress, done) => ({ id, goal, progress, embers: 60, done });
        h.weekly = { week, quests: all ? [q('wins', 5, 5, true), q('interrupts', 40, 40, true), q('named', 3, 3, true)] : [q('wins', 5, 5, true), q('interrupts', 40, 23, false), q('named', 3, 0, false)], titled: all };
        document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
      }, all);
      await page.waitForTimeout(200);
      await page.evaluate(() => document.querySelector('[data-prep="weekly"]')?.click());
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `${tag}-${name}.png`) });
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.querySelector('.sheet .close, [data-close]')?.click());
      await page.waitForTimeout(200);
    }
    // The Delver's Key sheet: a tier 8 hero with a +3 Kiln key and a best of +5.
    await page.evaluate(() => {
      const h = window.__ember.hero();
      h.maxTier = Math.max(h.maxTier, 8);
      h.keys = { ...(h.keys || {}), kiln: 3 }; h.keyBest = { ...(h.keyBest || {}), kiln: 5 };
      document.querySelector('[data-cls="bulwark"]').click(); document.querySelector('[data-cls="emberwright"]').click();
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('[data-prep="key"]')?.click());
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `${tag}-key.png`) });
    // The end screen's key line, rendered with the page's own styles (the markup ui.ts writes).
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'note'; d.id = 'keyprev';
      d.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:999;padding:12px;background:#1a100e;border-radius:12px';
      d.innerHTML = 'Fights cleared: 5 of 5 · <span class="keynote up"><span aria-hidden="true">⚿</span> Delver\'s Key +3 → <b>+5</b> (fast clear!)</span> · +24 embers<br><br>Fights cleared: 3 of 5 · <span class="keynote down"><span aria-hidden="true">⚿</span> Delver\'s Key +3 → <b>+2</b></span>';
      document.body.appendChild(d);
    });
    await page.locator('#keyprev').screenshot({ path: path.join(out, `${tag}-keynote.png`) });
    console.log(tag, errs.length ? errs.join('\n') : 'no errors');
    await ctx.close();
  }
  await b.close(); srv.close();
})();
