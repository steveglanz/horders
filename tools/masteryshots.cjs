// Screenshots the 1.0 CP2 mastery card on the end screen (sim/mastery.ts): a loss and a new-best win, on a 390x844
// phone, a 320x568 phone and desktop. It starts a Kiln delve, fills the card's counters by hand and opens the end screen.
// Usage: npm run build && node tools/masteryshots.cjs <outDir>
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const sizes = [
  ['390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['320', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desk', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }],
];
(async () => {
  const b = await chromium.launch();
  for (const [tag, opts] of sizes) {
    const ctx = await b.newContext(opts);
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'saver', look: '2d' })));
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5`);
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
    for (const [name, win] of [['loss', false], ['win', true]]) {
      await page.evaluate((win) => {
        const s = window.__ember.scene();
        const w = s.world;
        const p = w.player;
        Object.assign(p, { tells: 11, dodges: win ? 11 : 7, interrupts: 3, castsMissed: win ? 0 : 2, hurtBy: { Ashbuck: 60, 'Cinder Brute': 30 }, lastHurtBy: 'Cinder Brute' });
        w.soaks = 2; w.soaksMade = win ? 2 : 1;
        // A second-delve hero with F open (the page starts on the tutorial first delve, which sets no best time).
        w.firstDelve = false; p.unlockLevel = undefined;
        w.victory = win; w.time = win ? 372 : 214; w.tier = 2; w.encounter = win ? 5 : 3;
        s.scene.pause();
        s.hud.showEnd(w, { heroXp: 120, items: [], levelsGained: 0, ...(win ? { newBest: true, bestBefore: 401 } : {}) }, window.__ember.hero());
      }, win);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `${tag}-mastery-${name}.png`) });
    }
    console.log(tag, errs.length ? errs.join('\n') : 'no errors');
    await ctx.close();
  }
  await b.close(); srv.close();
})();
