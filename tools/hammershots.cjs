// Screenshots the Hammerdeep: Ondrel and each of its wind-ups (Anvilfall, Hammer Sweep,
// Choir of Iron) with Slag Grip and Sundered markers, plus the hub's group labels.
// Two local-party pages (?localparty=1): a Bulwark host and a Lumen guest, tier 4 unlocked.
// Usage: npm run build && node tools/hammershots.cjs <outDir> [phone]
const { chromium, devices } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'tools/shots';
const phone = process.argv.includes('phone');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
(async () => {
  const url = `http://127.0.0.1:${srv.address().port}/?localparty=1&seed=3&god=1`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const tag = phone ? 'phone' : 'desk';
  const ctx = await b.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 720 } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const errs = [];
  const A = await ctx.newPage(); const B = await ctx.newPage();
  for (const [n, p] of [['A', A], ['B', B]]) p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  // Each class is its own hero: pick the Bulwark first, then unlock tier 4 for it.
  await A.goto(url);
  await A.waitForTimeout(600);
  await A.click('[data-cls="bulwark"]');
  await A.evaluate(() => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, 4); window.__ember.save?.(); });
  await A.click('[data-cls="emberwright"]');
  await A.click('[data-cls="bulwark"]');
  await B.goto(url);
  await B.waitForTimeout(600);
  await B.click('[data-cls="lumen"]');
  // Solo, the Hammerdeep card shows its group label and the Delve button explains the block.
  await A.click('[data-d="hammerdeep"]');
  await A.waitForTimeout(200);
  await (await A.$('#tiers')).screenshot({ path: path.join(out, `${tag}-hd-hub-solo.png`) });
  await A.click('#hostBtn');
  const code = (await A.textContent('#partyCode')).trim();
  await B.fill('#joinCode', code); await B.click('#joinBtn');
  await A.waitForFunction(() => document.querySelectorAll('#coop li').length === 2, null, { timeout: 15000 }).catch(() => errs.push('link timeout'));
  await A.waitForTimeout(300);
  await (await A.$('#tiers')).screenshot({ path: path.join(out, `${tag}-hd-hub-party.png`) });
  // The fight itself: restart the scene straight into Ondrel with a Bulwark and a Lumen
  // (one page, no network), so the shots don't wait through four fights.
  await B.close();
  await A.evaluate(() => { document.getElementById('leaveBtn')?.click(); });
  await A.click('[data-d="kiln"]');
  await A.click('#startBtn');
  await A.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 15000 });
  await A.evaluate(() => {
    const s = window.__ember.scene();
    s.scene.restart({ opts: { seed: 3, cls: 'bulwark', dungeon: 'hammerdeep', route: ['ondrel'], tier: 4, invulnerable: true, heroName: 'Bulwark 4', party: [{ cls: 'lumen', name: 'Lumen 4' }] }, hud: s.hud, onEnd: () => {} });
  });
  await A.waitForTimeout(600);
  await A.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 4; });
  await A.waitForFunction(() => { const w = window.__ember.scene().world; return w.enemies.some((e) => e.alive && e.kind === 'ondrel' && w.time - e.spawnedAt > 2); }, null, { timeout: 120000, polling: 100 }).catch(() => errs.push('timeout ondrel'));
  const cast = async (id, label) => {
    await A.evaluate(() => { window.__ember.scene().warp = 3; });
    await A.waitForFunction((id) => window.__ember.scene().world.enemies.some((e) => e.alive && e.kind === 'ondrel' && e.castId === id && e.castT / e.castDur > (id === 'hammerSweep' ? 0.15 : 0.55)), id, { timeout: 60000, polling: 30 }).catch(() => errs.push('timeout ' + id));
    await A.evaluate(() => {
      const s = window.__ember.scene(); s.warp = 0;
      const p = s.world.heroData(0).player; p.slag = 3; p.sunderT = 6;
    });
    await A.waitForTimeout(120);
    await A.screenshot({ path: path.join(out, `${tag}-hd-${label}.png`) });
  };
  await cast('anvilfall', '1-anvilfall');
  await cast('hammerSweep', '2-sweep');
  await cast('choir', '3-choir');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close(); srv.close();
})();
