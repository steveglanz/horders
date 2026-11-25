// Phase 18 Halls H2a (mobile check): does the camera's corridor lead (HALLS.lead) still keep foes on a phone screen
// when everything moves faster? An autopilot hero (invulnerable) plays the Kiln map in the 3D look at 320x568 or
// 568x320; every rendered frame on the map it records where each awake foe shows against the screen and the HUD, and
// in a corridor how far ahead and behind the hero the screen reaches along the corridor.
// SPEED=1.25 scales hero movement (World.moveSpeed) and every foe's walk speed (def.speed) in the page, the way H2a's
// MOVE_SCALE will, so the check can run before H2a lands (charges and leaps are not scaled here).
// Usage: npm run build && SPEED=1.25 node tools/hallslead.cjs [p320|l568] [seed]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const size = ['p320', 'l568'].find((s) => process.argv.includes(s)) || 'p320';
const seed = Number(process.argv.find((a) => /^\d+$/.test(a)) || 2);
const K = Number(process.env.SPEED || 1);
const SECS = Number(process.env.SECS || 240);
const dist = process.env.DIST || 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const VIEW = { p320: { width: 320, height: 568 }, l568: { width: 568, height: 320 } };
const CLS = (process.env.CLS || 'bulwark').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: VIEW[size], deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=${seed}&god=1&halls=1&hd2d=1`);
  await page.waitForFunction(() => !!window.__ember && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 12); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  const rows = [];
  for (const cls of CLS) {
    await page.evaluate(([cls, seed, K]) => {
      const s = window.__ember.scene();
      s.warp = 1;
      s.scene.restart({ opts: { cls, dungeon: 'kiln', tier: 2, invulnerable: true, halls: true, seed }, hud: s.hud, onEnd: () => {} });
      const L = (window.__lead = { K, frames: 0, foe: 0, off: 0, offNear: 0, underBar: 0, nearest: [], where: {}, cor: [], scaled: new WeakSet(), patched: false });
      const step = () => {
        const sc = window.__ember.scene(); const w = sc?.world; const v = sc?.hd2d;
        if (w?.halls && v && !w.halls.done) {
          if (L.K !== 1 && !L.patched) {
            const proto = Object.getPrototypeOf(w); const d = Object.getOwnPropertyDescriptor(proto, 'moveSpeed');
            if (!d.get.__scaled) { const g = function () { return d.get.call(this) * L.K; }; g.__scaled = true; Object.defineProperty(proto, 'moveSpeed', { get: g, configurable: true }); }
            L.patched = true;
          }
          for (const e of w.enemies) if (L.K !== 1 && e.def && !L.scaled.has(e.def)) { L.scaled.add(e.def); e.def.speed *= L.K; }
          const p = w.player; const W = innerWidth, H = innerHeight;
          const bar = document.getElementById('actionbar')?.getBoundingClientRect();
          const me = v.project(p.x, p.y);
          L.frames++;
          if (w.phase === 'fight') {
            for (const e of w.enemies) {
              if (!e.alive) continue;
              const d = Math.hypot(e.x - p.x, e.y - p.y);
              const at = v.project(e.x, e.y);
              L.foe++;
              const on = at && at.x >= 0 && at.x <= W && at.y >= 0 && at.y <= H;
              if (!on) {
                L.off++;
                if (d < 350) {
                  L.offNear++; L.nearest.push(Math.round(d));
                  // Where the hero stood (a room, or out in a corridor) and which edge the foe was past.
                  const inRoom = w.halls.rooms.some((r) => Math.hypot(p.x - r.x, p.y - r.y) <= r.r);
                  const side = !at ? 'behind' : at.y < 0 ? 'top' : at.y > H ? 'bottom' : at.x < 0 ? 'left' : 'right';
                  const k = (inRoom ? 'room-' : 'corridor-') + side; L.where[k] = (L.where[k] || 0) + 1;
                }
              }
              else if (bar && bar.width && at.x >= bar.left && at.x <= bar.right && at.y >= bar.top && at.y <= bar.bottom) L.underBar++;
            }
          } else if (me) {
            // In a corridor: how far along it the screen reaches ahead (way you walk) and behind.
            const m = w.halls; const hw = 80;
            let cor = -1;
            m.corridors.forEach((c, i) => { const a = m.rooms[c.a], bb = m.rooms[c.b]; const dx = bb.x - a.x, dy = bb.y - a.y, l2 = dx * dx + dy * dy; const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)); const qx = a.x + t * dx, qy = a.y + t * dy; const inA = Math.hypot(p.x - a.x, p.y - a.y) < a.r, inB = Math.hypot(p.x - bb.x, p.y - bb.y) < bb.r; if (!inA && !inB && Math.hypot(p.x - qx, p.y - qy) < hw) cor = i; });
            const vx = p.x - p.px, vy = p.y - p.py, vl = Math.hypot(vx, vy);
            if (cor >= 0 && vl > 0.01) {
              const ux = vx / vl, uy = vy / vl;
              const reach = (s) => { let d = 0; for (; d < 1500; d += 20) { const q = v.project(p.x + ux * d * s, p.y + uy * d * s); if (!q || q.x < 0 || q.x > W || q.y < 0 || q.y > H) break; } return d; };
              L.cor.push([reach(1), reach(-1), Math.round(Math.abs(uy) > Math.abs(ux) ? (uy < 0 ? 0 : 1) : 2)]);
            }
          }
        }
        if (window.__lead === L) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, [cls, seed, K]);
    await page.waitForFunction(() => window.__ember.scene()?.world?.halls && window.__ember.scene().world.tick > 2, null, { timeout: 120000 });
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; });
    const t0 = Date.now();
    await page.waitForFunction((secs) => { const w = window.__ember.scene()?.world; return !w?.halls || w.halls.done || w.time > secs; }, SECS, { timeout: 1500000, polling: 1000 }).catch(() => errs.push('timeout ' + cls));
    const r = await page.evaluate(() => { const L = window.__lead; const w = window.__ember.scene().world; window.__lead = null; const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; }; const min = (a) => (a.length ? Math.min(...a) : null);
      const up = L.cor.filter((c) => c[2] === 0), down = L.cor.filter((c) => c[2] === 1), side = L.cor.filter((c) => c[2] === 2);
      const sum = (a) => a.length ? { n: a.length, aheadMed: med(a.map((c) => c[0])), aheadMin: min(a.map((c) => c[0])), behindMed: med(a.map((c) => c[1])), behindMin: min(a.map((c) => c[1])) } : null;
      return { time: Math.round(w.time), done: !!w.halls?.done, frames: L.frames, foeFrames: L.foe, offScreenPct: L.foe ? +(100 * L.off / L.foe).toFixed(1) : 0, offNear350: L.offNear, nearestOffMin: min(L.nearest), offNearWhere: L.where, underBarPct: L.foe ? +(100 * L.underBar / L.foe).toFixed(1) : 0, corridorUp: sum(up), corridorDown: sum(down), corridorSide: sum(side) }; });
    rows.push({ size, speed: K, cls, seed, realS: Math.round((Date.now() - t0) / 1000), ...r });
    console.log(JSON.stringify(rows.at(-1)));
  }
  console.log(size, 'speed', K, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
