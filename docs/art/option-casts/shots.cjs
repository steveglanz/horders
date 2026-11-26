// Ability-option casts: each of the ten level 12/16 options cast in a Kiln fight at 320x568, caught just after the
// cast (the scene is paused for the shot), in 3D and 2D, plus a sheet of their icons.
// Usage: npm run build && node docs/art/option-casts/shots.cjs <dist> <outDir> [look] [ids]
//   look: 3d or 2d (default 3d); ids: comma list (default all ten). DELAY env = ms after the cast (default 90).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = path.resolve(process.argv[2] || 'dist'); const out = process.argv[3] || 'shots';
const look = process.argv[4] || '3d';
const OPTS = { wideCut: ['duskblade', 2], quicken: ['duskblade', 1], clout: ['bulwark', 0], gather: ['bulwark', 1], sunlance: ['lumen', 0], canopy: ['lumen', 2], emberDart: ['emberwright', 0], whiteHeat: ['emberwright', 2], slagSpray: ['slagbinder', 0], slagMortar: ['slagbinder', 2] };
const ids = (process.argv[5] || Object.keys(OPTS).join(',')).split(',');
const DELAY = +(process.env.DELAY || 90);
fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(f));
}).listen(0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((g) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full', look: g })), look);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1${look === '2d' ? '' : '&hd2d=1'}`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  const calls = {};
  for (const id of ids) {
    const [cls, slot] = OPTS[id];
    await page.evaluate(([cls, id]) => { const s = window.__ember.scene(); clearInterval(window.__hold); s.scene.restart({ opts: { cls, alts: [id], dungeon: 'kiln', route: ['wardens'], tier: 2, invulnerable: true, seed: 3 }, hud: s.hud, onEnd: () => {} }); }, [cls, id]);
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 2, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__ember.scene().world.enemies.some((e) => e.alive), null, { timeout: 60000 });
    await page.waitForTimeout(800);
    // Hold the foes in a loose pack in front of the hero (to the right), so cones, darts and bursts all have targets.
    await page.evaluate(() => { const s = window.__ember.scene(), w = s.world;
      window.__hold = setInterval(() => { const p = w.heroData(0).player;
        w.enemies.filter((e) => e.alive).forEach((e, i) => { const a = -0.5 + (i % 5) * 0.25, d = 95 + Math.floor(i / 5) * 40; e.x = e.px = p.x + Math.cos(a) * d; e.y = e.py = p.y + Math.sin(a) * d; }); }, 5); });
    await page.waitForTimeout(300);
    const ok = await page.evaluate(([slot, delay]) => new Promise((res) => { const s = window.__ember.scene(), w = s.world;
      const p = w.heroData(0).player; if (p.cds) p.cds[slot] = 0; p.energy = p.maxEnergy ?? 100;
      // Software GL draws a frame every 100 ms or more, longer than half a cast's life, so the shot runs in slow motion:
      // the sim (warp) and the effects' clock (render's dt) both at a fifth, and the delay stretched to match.
      const SLOW = 5; s.warp = 1 / SLOW; const P = Object.getPrototypeOf(s); s.render = function (a, dt) { return P.render.call(this, a, dt / SLOW); };
      let seen = false; const tick0 = w.tick;
      s.altCast = function (...a) { P.altCast.apply(this, a); if (!seen) { seen = true; setTimeout(() => { s.scene.pause(); res(true); }, delay * SLOW); } };
      const id = setInterval(() => {
        if (!seen) s.cast(slot); else clearInterval(id);
        if (w.tick - tick0 > 600) { clearInterval(id); res(false); }
      }, 4);
      setTimeout(() => clearInterval(id), 20000);
    }), [slot, DELAY]);
    await page.waitForTimeout(look === '3d' ? 400 : 100);
    await page.screenshot({ path: path.join(out, `${look}-${id}.png`) });
    calls[id] = ok ? await page.evaluate(() => window.__ember.scene().hd2d?.stats().calls ?? null) : 'no cast';
    await page.evaluate(() => { const s = window.__ember.scene(); s.warp = 1; delete s.render; delete s.altCast; s.scene.resume(); });
  }
  console.log(JSON.stringify(calls));
  if (look === '3d') {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../client/icons.ts'), 'utf8');
    const tiles = ids.map((id) => { const m = src.match(new RegExp(`\\n  ${id}: '([^']*)'`)); return `<div style="text-align:center;width:110px"><svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="#f1e2cc" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${m ? m[1] : ''}"/></svg><br>${id}<br><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#f1e2cc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${m ? m[1] : ''}"/></svg></div>`; }).join('');
    const p2 = await b.newPage({ viewport: { width: 600, height: 200 }, deviceScaleFactor: 2 });
    await p2.setContent(`<body style="margin:0;background:#18100e;color:#d9c3b0;font:12px system-ui;padding:12px;display:flex;flex-wrap:wrap;gap:12px">${tiles}</body>`);
    await p2.screenshot({ path: path.join(out, 'icons.png'), fullPage: true });
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
