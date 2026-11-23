// Phase 16 U8: the five new elites (U2) on phone screens. For each, its fight banner, then its tell forced mid-cast,
// at 320x568 and 568x320, in the 3D look (?hd2d=1) and the 2D fallback.
// Usage: npm run build && node tools/newfoeshots.cjs <outDir> [p320|l568] [2d]   (ONLY=ashwall,lampeye to shoot a few)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const look = process.argv.includes('2d') ? '2d' : '3d';
fs.mkdirSync(out, { recursive: true });
const dist = process.env.DIST || 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const VIEW = { p320: { width: 320, height: 568 }, l568: { width: 568, height: 320 } };
const CASES = [
  { name: 'ashwall', dungeon: 'kiln', enc: 'ashwall', kind: 'ashwall', tier: 4, cast: 'shieldBash' },
  { name: 'ballast', dungeon: 'foundry', enc: 'ballast', kind: 'ballast', tier: 4, cast: 'anchorSlam' },
  { name: 'lampeye', dungeon: 'glarewell', enc: 'lampeye', kind: 'lampeye', tier: 6, until: 'gaze' },
  { name: 'dimhorn', dungeon: 'coldmarrow', enc: 'dimhorn', kind: 'dimhorn', tier: 6, until: 'call' },
  { name: 'conch', dungeon: 'wrackline', enc: 'conch', kind: 'conchblower', tier: 13, until: 'conch' },
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: VIEW[size], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1&hd2d=${look === '3d' ? 1 : 0}`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 13); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  const report = [];
  for (const c of CASES.filter((c) => !ONLY || ONLY.includes(c.name))) {
    await page.evaluate((c) => { const s = window.__ember.scene(); s.warp = 1; s.autopilot = false; s.scene.restart({ opts: { seed: 13, cls: 'bulwark', dungeon: c.dungeon, route: [c.enc], tier: c.tier, invulnerable: true }, hud: s.hud, onEnd: () => {} }); }, c);
    await page.waitForFunction(() => window.__ember.scene()?.world?.phase === 'fight', null, { timeout: 400000, polling: 100 }).catch(async () => { throw new Error('no fight: ' + JSON.stringify(await page.evaluate(() => { const w = window.__ember.scene()?.world; return w ? [w.phase, w.tick, w.state] : null; }))); });
    await page.waitForTimeout(look === '3d' ? 2500 : 900);
    // The fight's banner: whole, or cut off?
    report.push({ name: c.name, banner: await page.evaluate(() => {
      const el = document.getElementById('banner'); if (!el || !el.classList.contains('show')) return null;
      const r = el.getBoundingClientRect(); const sub = el.querySelector('.sub') || el.lastElementChild;
      return { text: el.innerText.replace(/\n+/g, ' | '), top: Math.round(r.top), bottom: Math.round(r.bottom), cut: sub ? sub.scrollHeight > sub.clientHeight + 1 : false };
    }) });
    await page.screenshot({ path: path.join(out, `${look}-${size}-${c.name}-banner.png`) });
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
    await page.waitForFunction((c) => {
      const s = window.__ember.scene(); const w = s.world;
      const i = w.enemies.findIndex((e) => e.alive && e.kind === c.kind); if (i < 0) return false;
      const e = w.enemies[i];
      let ok = false;
      if (c.cast) ok = e.castId === c.cast && e.castT > 0.25;
      else if (c.until === 'gaze') ok = e.aux > 3.5 && !e.castId && w.lampeyeSees(e, w.player.x, w.player.y);
      else if (c.until === 'call') {
        // Forced, since an autopilot hero keeps it in the coal's light. Placed out in the dark beside you.
        e.x = e.px = w.player.x + 110; e.y = e.py = w.player.y - 90;
        if (!e.castId) w.startCast(i, 'darkCall', 'Dark Call', 2, false);
        e.castT = Math.max(e.castT, 0.8); ok = e.castId === 'darkCall';
      } else if (c.until === 'conch') {
        e.x = e.px = w.player.x + 110; e.y = e.py = w.player.y - 70;
        if (!e.castId) w.startCast(i, 'conchCall', 'Conch Call', 1.8, true);
        e.castT = Math.max(e.castT, 0.9); ok = e.castId === 'conchCall';
      }
      if (ok) { s.warp = 0; s.autopilot = false; }
      return ok;
    }, c, { timeout: 300000, polling: 100 }).catch(() => errs.push('timeout ' + c.name));
    await page.waitForTimeout(look === '3d' ? 250 : 120);
    // Where the elite and its cast bar sit against the HUD.
    report.at(-1).tell = await page.evaluate((c) => {
      const s = window.__ember.scene(); const w = s.world; const e = w.enemies.find((o) => o.alive && o.kind === c.kind);
      const cam = s.cameras.main; const cv = s.game.canvas; const k = cv.getBoundingClientRect().width / cv.width;
      const sx = (e.x - cam.worldView.x) * cam.zoom * k, sy = (e.y - cam.worldView.y) * cam.zoom * k;
      const bar = document.getElementById('actionbar').getBoundingClientRect();
      return { foe: [Math.round(sx), Math.round(sy)], cast: e.castId || '', barTop: Math.round(bar.top), barLeft: Math.round(bar.left) };
    }, c);
    await page.screenshot({ path: path.join(out, `${look}-${size}-${c.name}-tell.png`) });
  }
  console.log(JSON.stringify(report, null, 1));
  console.log(look, size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
