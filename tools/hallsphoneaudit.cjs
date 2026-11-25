// Halls on phones, "keep it simple" audit (Steve, 25 Nov): what a phone shows on a Halls run, at 320x568 or 568x320 in
// the 3D look. Shots: the start (with its banner), walking a corridor, a fight (autopilot until a pack wakes), and the
// map opened. For each it lists every visible HUD element (id or class, and its box), so the clutter can be counted.
// Usage: npm run build && node tools/hallsphoneaudit.cjs <outDir> [p320|l568] [tag]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const tag = process.argv[4] || 'now';
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
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: VIEW[size], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=8&god=1&halls=1&hd2d=1`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 1; s.scene.restart({ opts: { cls: 'emberwright', dungeon: 'kiln', tier: 2, invulnerable: true, halls: true, seed: 8 }, hud: s.hud, onEnd: () => {} }); });
  await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 120000 });
  const visible = () => page.evaluate(() => {
    const hud = document.getElementById('hud') || document.body; const outl = [];
    for (const el of hud.querySelectorAll('*')) {
      if (!(el.id || (el.className && typeof el.className === 'string'))) continue;
      const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity < 0.05) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
      if (!el.id) continue;
      let p = el.parentElement, hidden = false; while (p && p !== hud) { const ps = getComputedStyle(p); if (ps.display === 'none' || ps.visibility === 'hidden') { hidden = true; break; } p = p.parentElement; }
      if (hidden) continue;
      outl.push(`${el.id} ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}${el.innerText && el.innerText.length < 60 ? ' "' + el.innerText.replace(/\s+/g, ' ').trim() + '"' : ''}`);
    }
    return outl;
  });
  const report = {};
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${tag}-${size}-${name}.png`) }); report[name] = await visible(); };
  await page.waitForTimeout(2500);
  await shot('1-start');
  // Walk: autopilot until the hero is out of the first room with nothing awake, then freeze.
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; const m = w.halls; const p = w.player; const r0 = m.rooms[0]; const out = Math.hypot(p.x - r0.x, p.y - r0.y) > r0.r + 60; if (out && w.phase !== 'fight') { s.warp = 0; return true; } return false; }, null, { timeout: 300000, polling: 50 }).catch(() => errs.push('no walk'));
  await page.waitForTimeout(1500);
  await shot('2-walk');
  await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 1; });
  await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; if (w.phase === 'fight' && w.aliveEnemies > 0 && w.enemies.some((e) => e.alive && e.castId) ) { s.warp = 0; return true; } return false; }, null, { timeout: 300000, polling: 50 }).catch(() => errs.push('no fight'));
  await page.waitForTimeout(1500);
  await shot('3-fight');
  await page.evaluate(() => { const b = document.getElementById('hallsMapBtn'); if (b && !b.hidden) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForTimeout(800);
  await shot('4-map');
  console.log(JSON.stringify(report, null, 1));
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
