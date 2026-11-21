// Screenshots the season trails behind a moving hero: Bellows Sparks at stages 1, 2 and 3
// (stage 3 just after a dash), and all four seasons' trails at stage 2. No network.
// With `rime`: Rime Dust (the Cold Hearth's falling frost) at stages 1 and 2, stage 2 on the Glarewell's pale floor, and stage 3's dash in the Coldmarrow.
// `full` sets Graphics to Full: software GL runs under 42 fps, so Auto would trim the trail to Battery saver's rate.
// Usage: npm run build && node tools/trailshots.cjs <outDir> [saver|full] [rime]
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots'; const saver = process.argv.includes('saver'); const full = process.argv.includes('full');
fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const RIME = [
  { name: 'rime-1', id: 'rimeDust', stage: 1, cls: 'emberwright' },
  { name: 'rime-2', id: 'rimeDust', stage: 2, cls: 'emberwright' },
  { name: 'rime-glare-2', id: 'rimeDust', stage: 2, cls: 'emberwright', dungeon: 'glarewell' },
  { name: 'rime-cold-3-dash', id: 'rimeDust', stage: 3, cls: 'duskblade', dash: true, dungeon: 'coldmarrow' },
];
const ALL = [
  { name: 'bellows-1', id: 'bellowsSparks', stage: 1, cls: 'emberwright' },
  { name: 'bellows-2', id: 'bellowsSparks', stage: 2, cls: 'emberwright' },
  { name: 'bellows-3-dash', id: 'bellowsSparks', stage: 3, cls: 'duskblade', dash: true },
  { name: 'salt-2', id: 'saltMist', stage: 2, cls: 'lumen' },
  { name: 'rime-2', id: 'rimeDust', stage: 2, cls: 'bulwark' },
  { name: 'slag-2', id: 'slagDrips', stage: 2, cls: 'slagbinder' },
  // A bot party: our Bellows Sparks II plus two allies' trails from the party's shared looks.
  { name: 'party', id: 'bellowsSparks', stage: 2, cls: 'emberwright', party: [{ cls: 'lumen', name: 'Lumen 9' }, { cls: 'bulwark', name: 'Bulwark 9' }], looks: [{}, { trail: { id: 'saltMist', stage: 2 } }, { trail: { id: 'rimeDust', stage: 3 } }] },
];
const SHOTS = process.argv.includes('rime') ? RIME : ALL;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  if (saver || full) await ctx.addInitScript((g) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: g })), saver ? 'saver' : 'full');
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  for (const sh of SHOTS) {
    await page.evaluate((sh) => {
      const s = window.__ember.scene();
      s.scene.restart({ opts: { seed: 7, cls: sh.cls, dungeon: sh.dungeon ?? 'kiln', tier: 3, invulnerable: true, party: sh.party, looks: sh.looks }, hud: s.hud, onEnd: () => {}, trail: { id: sh.id, stage: sh.stage } });
    }, sh);
    await page.waitForTimeout(600);
    await page.evaluate((sh) => {
      const s = window.__ember.scene();
      // The dash shot lets the bot fight until it dashes, then freezes the scene 120 ms later (a software-GL
      // screenshot takes longer than the motes live); the others walk the hero up-right with W and D.
      s.autopilot = !!(sh.dash || sh.party); s.autoPick = true;
      window.__dashAt = 0;
      if (sh.dash) { const orig = s.trailDash.bind(s); s.trailDash = (...a) => { orig(...a); if (s.trails.length && Math.hypot(a[2] - s.world.player.x, a[3] - s.world.player.y) <= 4) { window.__dashAt = performance.now(); window.__dashLen = Math.round(Math.hypot(a[2] - a[0], a[3] - a[1])); s.trailDash = orig; setTimeout(() => s.scene.pause(), 120); } }; }
    }, sh);
    if (sh.dash) {
      await page.waitForFunction(() => window.__dashAt && performance.now() - window.__dashAt > 90, null, { timeout: 60000, polling: 30 }).catch(() => errs.push(`${sh.name}: no dash`));
    } else if (sh.party) {
      await page.waitForTimeout(3000);
      console.log(sh.name, await page.evaluate(() => window.__ember.scene().trails.map((t) => ({ hero: t.hero, stage: t.stage, color: t.color.toString(16), live: t.fx.filter((f) => f.life > 0).length }))));
    } else {
      // Walk up-right for 1.4 s, so the trail runs down-left behind the hero.
      await page.keyboard.down('d'); await page.keyboard.down('w');
      await page.waitForTimeout(1400);
    }
    await page.screenshot({ path: path.join(out, `trail-${sh.name}${saver ? '-saver' : full ? '-full' : ''}.png`), clip: sh.party ? { x: 0, y: 0, width: 1280, height: 720 } : { x: 440, y: 230, width: 400, height: 260 } });
    if (!sh.dash && !sh.party) { await page.keyboard.up('d'); await page.keyboard.up('w'); }
    else if (sh.dash) console.log(sh.name, await page.evaluate(() => ({ dashLen: window.__dashLen, liveMotes: window.__ember.scene().trails.reduce((n, t) => n + t.fx.filter((f) => f.life > 0).length, 0) })));
    if (sh.dash) await page.evaluate(() => window.__ember.scene().scene.resume());
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
