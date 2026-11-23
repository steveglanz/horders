// Phase 14 X6 art: the five named-foe traits (badge right of the crown, body tint and body look) and the arena events'
// warnings and landings (cave-in, vent surge, cold snap). The sim pauses for each shot; traits and events are set on
// the live world by hand (no tools flags reach the browser).
// Usage: npm run build && node tools/x6shots.cjs <outDir> [p360]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const p360 = process.argv.includes('p360');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const PARTY = { invulnerable: true, cls: 'emberwright', heroName: 'Emberwright 9', party: [{ cls: 'bulwark', name: 'Bulwark 9' }, { cls: 'lumen', name: 'Lumen 9' }] };
const AFFIXES = ['Swift', 'Warded', 'Vengeful', 'Brood', 'Smoldering'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = p360 ? 'p360' : 'desk';
  const ctx = await b.newContext(p360 ? { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'full' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=3&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  const start = async (opts) => {
    await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: o, hud: s.hud, onEnd: () => {} }); }, opts);
    await page.waitForTimeout(700);
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 2; });
    await page.waitForFunction(() => { const w = window.__ember.scene().world; return w.phase === 'fight' && w.time > 2.5; }, null, { timeout: 30000, polling: 30 });
  };
  const shoot = async (name) => {
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = 'hidden'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${tag}-${name}.png`) });
    await page.evaluate(() => { const b = document.getElementById('banner'); if (b) b.style.visibility = ''; });
  };
  // Traits: one elite in a Kiln trash fight is made a named foe with each trait in turn.
  for (const [ai, affix] of AFFIXES.entries()) {
    await start({ ...PARTY, seed: 3, dungeon: 'kiln', tier: 3, route: ['wardens'] });
    await page.evaluate((ai) => {
      const s = window.__ember.scene(); const w = s.world;
      const e = w.enemies.find((o) => o.alive && o.def.rank !== 'normal' && o.def.rank !== 'boss');
      if (!e) return;
      e.named = 0; e.affix = ai; e.spawnedAt = w.time - 2.6;
      if (ai === 1) { e.ward = e.maxHp * 0.15; e.warded = true; }
    }, ai);
    await page.waitForTimeout(500);
    await page.waitForFunction(() => { const s = window.__ember.scene(); const w = s.world; const e = w.enemies.find((o) => o.alive && o.named >= 0); if (!e) return true; s.warp = 0; const p = w.player; p.x = p.px = e.x; p.y = p.py = e.y + 150; e.flash = -1; return true; }, null, { timeout: 5000, polling: 30 });
    await shoot(`trait-${affix}`);
  }
  // Events: set the event on the live fight with half a second to go before its warning.
  const event = async (opts, id, warnDur, name) => {
    await start(opts);
    await page.evaluate((id) => { const w = window.__ember.scene().world; w.arenaEvent = id; w.arenaEventStage = 0; w.arenaEventT = 0.4; }, id);
    await page.waitForFunction((d) => { const s = window.__ember.scene(); const w = s.world; const ok = w.arenaEventStage === 1 && w.arenaEventT < d * (w.arenaEvent === 'caveIn' ? 0.08 : 0.25); if (ok) s.warp = 0; return ok; }, warnDur, { timeout: 20000, polling: 8 }).catch(() => errs.push('timeout warn ' + name));
    if (id === 'caveIn') await page.evaluate(() => { const w = window.__ember.scene().world; const c = w.caveInSpots()[0]; const p = w.player; p.x = p.px = c.x; p.y = p.py = c.y + 120; });
    await shoot(`${name}-warn`);
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    await page.waitForFunction(() => { const s = window.__ember.scene(); const ok = s.world.arenaEventStage === 2; if (ok) s.warp = 0; return ok; }, null, { timeout: 10000, polling: 4 }).catch(() => errs.push('timeout land ' + name));
    await page.evaluate(() => { window.__ember.scene().warp = 1; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { window.__ember.scene().warp = 0; });
    if (id === 'caveIn') await page.evaluate(() => { const w = window.__ember.scene().world; const c = w.caveInSpots()[0]; const p = w.player; p.x = p.px = c.x; p.y = p.py = c.y + 120; });
    await shoot(`${name}-land`);
  };
  await event({ ...PARTY, seed: 3, dungeon: 'kiln', tier: 3, route: ['warpack'] }, 'caveIn', 2.2, 'caveIn');
  await event({ ...PARTY, seed: 3, dungeon: 'kiln', tier: 3, route: ['warpack'] }, 'ventSurge', 1.8, 'ventSurge');
  await event({ ...PARTY, seed: 3, dungeon: 'coldmarrow', tier: 11, route: ['rimepack'] }, 'coldSnap', 2.5, 'coldSnap');
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
