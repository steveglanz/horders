// Phase 15 Y6 art for the Y3 third boss versions, in 2D: the Kiln Mother's Turning Fire (the sweep arrow, the next
// cone's edge and order pips) and Maelra's Sealed Vents (iron-capped grates, the next vent's rattling plate).
// Forces each version and phase 2 (her health set to 60% by hand), freezes the sim at the moment, and shoots.
// Ondrel's Homeward Hammer (thrown, lying in its crater, flying home), Hessa's Whirl (arrowed eddies round the drain, the way it turns), Nhevra's Creeping Rime (frost fingers reaching where it creeps, a mist rim) and Sealed Vents' open vent reach.
// Also the Lensmother's Carried Light (the light gliding onto her, then beams to each pillar while her Glare comes).
// Usage: npm run build && node tools/y3artshots.cjs <outDir> [p360|land|desk]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const size = ['p360', 'land', 'desk'].find((s) => process.argv.includes(s)) || 'p360';
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const VIEW = { p360: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, land: { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1280, height: 720 } } };
const CASES = [
  { name: 'turning', dungeon: 'kiln', boss: 'kilnMother', variant: 'turning', until: 'cones' },
  { name: 'seal-next', dungeon: 'foundry', boss: 'maelra', variant: 'seal', until: 'next' },
  { name: 'rime', dungeon: 'coldmarrow', boss: 'nhevra', variant: 'rime', until: 'rime', at: [300, 1400] },
  { name: 'seal-open', dungeon: 'foundry', boss: 'maelra', variant: 'seal', until: 'open' },
  { name: 'whirl-warn', dungeon: 'wrackline', boss: 'hessa', variant: 'whirl', until: 'whirlWarn', tier: 13 },
  { name: 'whirl-pull', dungeon: 'wrackline', boss: 'hessa', variant: 'whirl', until: 'whirlPull', tier: 13 },
  { name: 'home-fly', dungeon: 'hammerdeep', boss: 'ondrel', variant: 'home', party: true, until: 'homeFly', tier: 8 },
  { name: 'home-lie', dungeon: 'hammerdeep', boss: 'ondrel', variant: 'home', party: true, until: 'homeLie', tier: 8 },
  { name: 'home-back', dungeon: 'hammerdeep', boss: 'ondrel', variant: 'home', party: true, until: 'homeBack', tier: 8 },
  { name: 'carried', dungeon: 'glarewell', boss: 'lensmother', variant: 'walk', until: 'light', at: [250, 1100] },
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(VIEW[size]);
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=5&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 8); h.runs = Math.max(h.runs, 3); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 30000 });
  for (const c of CASES.filter((c) => !ONLY || ONLY.includes(c.name))) {
    await page.evaluate((c) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 13, cls: 'bulwark', dungeon: c.dungeon, route: [c.boss], tier: c.tier || 6, invulnerable: true, ...(c.party ? { party: [{ cls: 'lumen', name: 'Lumen' }, { cls: 'emberwright', name: 'Emberwright' }] } : {}) }, hud: s.hud, onEnd: () => {} }); }, c);
    await page.waitForTimeout(600);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
    await page.waitForFunction((c) => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === c.boss), c, { timeout: 60000, polling: 30 });
    await page.evaluate((c) => { const w = window.__ember.scene().world; w.bossVariant = c.variant; const e = w.enemies.find((o) => o.alive && o.kind === c.boss); e.hp = e.maxHp * 0.6; }, c);
    await page.waitForFunction((c) => {
      const s = window.__ember.scene(); const w = s.world;
      const ok = c.until === 'cones' ? w.telegraphs.filter((t) => t.alive && t.shape === 'cone' && t.owner === w.bossIndex).length >= 4 && w.telegraphs.some((t) => t.alive && t.t > 0.5)
        : c.until === 'light' ? !!s.lightAnim
        : c.until === 'rime' ? w.rimeOn && Math.hypot(w.rimeX - w.player.x, w.rimeY - w.player.y) < 260 && (s.rimeBorn === undefined || s.time.now - s.rimeBorn > 1500)
        : c.until === 'whirlWarn' ? w.whirl && w.ebbWarnT > 0 && w.ebbWarnT < 2.2
        : c.until === 'whirlPull' ? w.whirl && w.ebbT > 0.4
        : c.until === 'homeFly' ? w.homeStage === 1 && w.homeT < 0.9
        : c.until === 'homeLie' ? w.homeStage === 2 && w.homeT < 0.7
        : c.until === 'homeBack' ? w.homeStage === 2 && w.homeT < 0.14
        : c.until === 'open' ? w.openVent >= 0 && w.nextVent < 0 && Math.hypot(w.vents[w.openVent].x - w.player.x, w.vents[w.openVent].y - w.player.y) < 200
        : w.nextVent >= 0;
      if (ok) s.warp = 0;
      return ok;
    }, c, { timeout: 120000, polling: 'raf' }).catch(() => errs.push('timeout ' + c.name));
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
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
