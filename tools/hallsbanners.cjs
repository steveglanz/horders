// Halls "tip once" check (design, 25 Nov): a pack's fight tip shows the first time this hero meets that encounter, then
// only its name, and a named foe folds into the pack's banner. Plays the same Halls map twice (autopilot, invulnerable,
// 2D for speed) and logs every banner each run shows, with a shot of the first pack's banner each time.
// Usage: npm run build && node tools/hallsbanners.cjs <outDir> [p320|l568] [seed]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const seed = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8);
fs.mkdirSync(out, { recursive: true });
const dist = process.env.DIST || 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const VIEW = { p320: { width: 320, height: 568 }, l568: { width: 568, height: 320 } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: VIEW[size], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${seed}&god=1&halls=1&hd2d=0`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); h.tipsSeen = []; });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  const runs = [];
  for (let run = 1; run <= 2; run++) {
    await page.evaluate((seed) => {
      const s = window.__ember.scene(); s.warp = 1;
      s.scene.restart({ opts: { cls: 'bulwark', dungeon: 'kiln', tier: 2, invulnerable: true, halls: true, seed }, hud: s.hud, onEnd: () => {} });
      // Log each banner as it is shown (title | sub), with the run time.
      window.__banners = []; let last = '';
      clearInterval(window.__bt);
      window.__bt = setInterval(() => {
        const el = document.getElementById('banner'); if (!el || !el.classList.contains('show')) { last = ''; return; }
        const t = document.getElementById('bannerTitle').textContent + ' | ' + document.getElementById('bannerSub').textContent;
        if (t !== last) { last = t; window.__banners.push(t); }
      }, 50);
    }, seed);
    await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 60000 });
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    // The first pack's banner: stop the world while it shows, and shoot it.
    await page.waitForFunction(() => { const w = window.__ember.scene().world; const el = document.getElementById('banner'); if (w.phase === 'fight' && el.classList.contains('show')) { window.__ember.scene().warp = 0; return true; } return false; }, null, { timeout: 300000, polling: 30 }).catch(() => errs.push('no first banner ' + run));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${size}-run${run}-first-pack.png`) });
    await page.evaluate(() => { window.__ember.scene().warp = 3; });
    await page.waitForFunction(() => { const w = window.__ember.scene().world; return !w.hallsOn || w.halls?.done; }, null, { timeout: 600000, polling: 500 }).catch(() => errs.push('map not done ' + run));
    runs.push({ run, banners: await page.evaluate(() => window.__banners), tipsSeen: await page.evaluate(() => window.__ember.hero().tipsSeen) });
  }
  // A pack met before: its banner is the name alone.
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 0; s.hud.banner('The Hollow Rift', ''); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${size}-name-only.png`) });
  console.log(JSON.stringify(runs, null, 1));
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
