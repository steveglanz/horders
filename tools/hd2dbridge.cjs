// The floor bridge in the 3D look (?hd2d=1): the same forced boss moments as tools/y3artshots.cjs, drawn by the 3D view,
// so the 2D-only floor tells (rafts and the Whirl, vents, the light and its wedges, the Rime) can be checked on its floor.
// Usage: npm run build && ONLY=whirl-pull,seal-open,carried,rime node tools/hd2dbridge.cjs <outDir>   (DIST=<dir> for another build)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p360', 'land', 'desk'].find((s) => process.argv.includes(s)) || 'p360';
fs.mkdirSync(out, { recursive: true });
const dist = process.env.DIST || 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const VIEW = { p360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, land: { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1280, height: 720 } } };
const CASES = [
  { name: 'turning', dungeon: 'kiln', boss: 'kilnMother', variant: 'turning', until: 'cones' },
  { name: 'seal-next', dungeon: 'foundry', boss: 'maelra', variant: 'seal', until: 'next' },
  { name: 'rime', dungeon: 'coldmarrow', boss: 'nhevra', variant: 'rime', until: 'rime', at: [300, 1400] },
  { name: 'seal-open', dungeon: 'foundry', boss: 'maelra', variant: 'seal', until: 'open' },
  { name: 'whirl-warn', dungeon: 'wrackline', boss: 'hessa', variant: 'whirl', until: 'whirlWarn', tier: 13 },
  { name: 'whirl-pull', dungeon: 'wrackline', boss: 'hessa', variant: 'whirl', until: 'whirlPull', tier: 13 },
  { name: 'home-fly', dungeon: 'hammerdeep', boss: 'ondrel', variant: 'home', party: true, until: 'homeFly', tier: 8 },
  { name: 'tithe', dungeon: 'flue', boss: 'regent', variant: 'tithe', party: true, until: 'tithe', tier: 11, hp: 0.4 },
  { name: 'inhale', dungeon: 'hoard', boss: 'vorhulm', variant: 'inhale', party: true, until: 'inhale', tier: 9, hp: 0.2 },
  { name: 'home-lie', dungeon: 'hammerdeep', boss: 'ondrel', variant: 'home', party: true, until: 'homeLie', tier: 8 },
  { name: 'home-back', dungeon: 'hammerdeep', boss: 'ondrel', variant: 'home', party: true, until: 'homeBack', tier: 8 },
  // Room shots: the boss in, nothing forced (until 'boss': as soon as it's up).
  { name: 'ash-boss', dungeon: 'ashvents', boss: 'ysmeret', variant: undefined, until: 'boss', tier: 7, at: [1500] },
  { name: 'cru-boss', dungeon: 'crucible', boss: 'grandmotherSlag', until: 'boss', tier: 8, party: true, at: [1500] },
  { name: 'hoard-boss', dungeon: 'hoard', boss: 'vorhulm', until: 'boss', tier: 9, party: true, at: [1500] },
  { name: 'cold-boss', dungeon: 'coldmarrow', boss: 'nhevra', until: 'boss', tier: 10, at: [1500] },
  { name: 'press-boss', dungeon: 'pressworks', boss: 'oskel', until: 'boss', tier: 10, party: true, at: [1500] },
  { name: 'smelt-boss', dungeon: 'smeltery', boss: 'colossus', until: 'boss', tier: 10, party: true, at: [1500] },
  { name: 'carried', dungeon: 'glarewell', boss: 'lensmother', variant: 'walk', until: 'light', at: [250, 1100] },
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext(VIEW[size]);
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1&hd2d=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 8); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000 });
  for (const c of CASES.filter((c) => !ONLY || ONLY.includes(c.name))) {
    await page.evaluate((c) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 13, cls: 'bulwark', dungeon: c.dungeon, route: [c.boss], tier: c.tier || 6, invulnerable: true, ...(c.party ? { party: [{ cls: 'lumen', name: 'Lumen' }, { cls: 'emberwright', name: 'Emberwright' }] } : {}) }, hud: s.hud, onEnd: () => {} }); }, c);
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction((c) => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === c.boss), c, { timeout: 300000, polling: 200 });
    await page.evaluate((c) => { const w = window.__ember.scene().world; if (c.variant) w.bossVariant = c.variant; const e = w.enemies.find((o) => o.alive && o.kind === c.boss); e.hp = e.maxHp * (c.hp || 0.6); }, c);
    await page.waitForFunction((c) => {
      const s = window.__ember.scene(); const w = s.world;
      const ok = c.until === 'cones' ? w.telegraphs.filter((t) => t.alive && t.shape === 'cone' && t.owner === w.bossIndex).length >= 4 && w.telegraphs.some((t) => t.alive && t.t > 0.5)
        : c.until === 'light' ? !!s.lightAnim
        : c.until === 'rime' ? w.rimeOn && Math.hypot(w.rimeX - w.player.x, w.rimeY - w.player.y) < 260 && (s.rimeBorn === undefined || s.time.now - s.rimeBorn > 1500)
        : c.until === 'whirlWarn' ? w.whirl && w.ebbWarnT > 0 && w.ebbWarnT < 2.2
        : c.until === 'whirlPull' ? w.whirl && w.ebbT > 0.4
        : c.until === 'homeFly' ? w.homeStage === 1 && w.homeT < 0.9
        : c.until === 'tithe' ? w.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -5 && t.t > 2.5)
        : c.until === 'inhale' ? w.inhaleStage === 2 && w.inhaleT > 1.5
        : c.until === 'homeLie' ? w.homeStage === 2 && w.homeT < 0.7
        : c.until === 'homeBack' ? w.homeStage === 2 && w.homeT < 0.14
        : c.until === 'open' ? w.openVent >= 0 && w.nextVent < 0 && Math.hypot(w.vents[w.openVent].x - w.player.x, w.vents[w.openVent].y - w.player.y) < 200
        : c.until === 'boss' ? true
        : w.nextVent >= 0;
      if (ok) s.warp = 0;
      return ok;
    }, c, { timeout: 400000, polling: 200 }).catch(() => errs.push('timeout ' + c.name));
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(1500);
    let last = 0;
    for (const [n, ms] of (c.at || [400]).entries()) {
      await page.waitForTimeout(ms - last); last = ms;
      await page.screenshot({ path: path.join(out, `${size}-${c.name}${c.at ? '-' + n : ''}.png`) });
    }
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = ''; });
  }
  console.log(size, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
