// CP3 opening PR 2 check (docs/design/opening.md): the opening run in the real build, 390x844 phone, fake backend.
// A fresh save taps through the wake screen; the game bot plays the opening (warp 3) while this records the route, the
// coach and banner lines as they show, the first draft line, the short Kiln Mother's lines and moves (PR 3), and the end; then a second fresh save quits mid-opening and
// must land back on the wake screen with no run counted. node tools/openingcheck.cjs [outDir]   (after npm run build)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'docs/art/opening-cp3/run');
fs.mkdirSync(out, { recursive: true });
const dist = path.resolve('dist');
const files = http.createServer((q, r) => {
  const p = path.join(dist, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  const f = p.endsWith(path.sep) || p === dist ? path.join(dist, 'index.html') : p;
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch();
  const page0 = async (hero) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if (hero) await ctx.addInitScript((h) => localStorage.setItem('horders.hero.v1', h), JSON.stringify(hero));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail('pageerror ' + e.message + ' ' + (e.stack||'').split('\n').slice(0,4).join(' | ')));
    // Fake backend, as tools/playdriver.cjs: the live Supabase project is never touched.
    await page.route('https://*.supabase.co/**', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
      if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
      if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json([]);
      if (u.pathname === '/rest/v1/hero_saves') return route.fulfill({ status: 201, body: '' });
      if (u.pathname.endsWith('/world_boss_status')) return json({ id: 1, name: 'Old Vorhulm', title: 'the Glutton', hp: 312000, max_hp: 500000, omen: 'warded', fighters: 41, my_damage: 0, unclaimed: [] });
      return json([], 200);
    });
    await page.goto(`http://127.0.0.1:${files.address().port}/?hd2d=0`);
    await page.waitForFunction(() => !!window.__ember);
    await page.waitForTimeout(800);
    return { page, ctx };
  };
  const tapIn = async (page) => {
    for (let k = 0; k < 3; k++) { await page.touchscreen.tap(195, 500); await page.waitForTimeout(500); }
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 20000 });
  };
  // 1. The opening, played by the game's bot.
  const { page, ctx } = await page0(null);
  await tapIn(page);
  const w0 = await page.evaluate(() => { const w = window.__ember.scene().world; return { first: w.firstDelve, cls: w.cls, route: w.route, worldBoss: w.worldBoss, omens: w.omens, packs: w.halls.packs.map((p) => p.foes.map((f) => f.kind).join('+')) }; });
  console.log('start:', JSON.stringify(w0));
  if (!w0.first || w0.cls !== 'emberwright' || w0.route.join() !== 'pack,wardens,brute,kilnMother' || w0.worldBoss || w0.omens.length) fail('not the opening route');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/1-move.png` });
  // Every coach line, however briefly it shows (the bot Quenches within a fraction of a second, between polls).
  await page.evaluate(() => {
    window.__coachSeen = [];
    new MutationObserver(() => { const c = document.querySelector('#coach'); if (c && !c.hidden && c.textContent && !window.__coachSeen.includes(c.textContent.trim())) window.__coachSeen.push(c.textContent.trim()); })
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  });
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = false; s.warp = 3; });
  const said = [];
  const shot = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    const st = await page.evaluate(() => {
      const s = window.__ember.scene(); const w = s?.world;
      const q = (sel) => { const e = document.querySelector(sel); return e && !e.hidden && getComputedStyle(e).display !== 'none' ? e.textContent.trim() : ''; };
      const ban = document.querySelector('#banner');
      return { state: w?.state, t: Math.round(w?.time ?? 0), coach: q('#coach'), kind: document.querySelector('#coach')?.dataset.kind ?? '', banner: ban?.classList.contains('show') ? `${q('#bannerTitle')} | ${q('#bannerSub')}` : '', draft: q('#draft') ? q('#draftLevel') : '', end: !document.querySelector('#end').hidden, hounds: w ? w.enemies.filter((e) => e.alive && e.kind === 'cinderhound').map((e) => e.def.size) : [], km: w?.kmOpen ?? 0, kmCast: w && w.bossIndex >= 0 && w.enemies[w.bossIndex]?.alive ? w.enemies[w.bossIndex].castId : '' };
    });
    for (const [k, v] of [['coach', st.coach], ['banner', st.banner], ['draft', st.draft]]) {
      if (v && !said.some((x) => x.k === k && x.v === v)) { said.push({ k, v, t: st.t }); console.log(`  t=${st.t}s ${k}: ${v}`); }
    }
    // PR 3: the short Kiln Mother's Swipe (stage 1) and blue cast (stage 2).
    const key = st.draft ? 'draft' : st.km && st.kmCast === 'kmSwipe' ? 'boss-swipe' : st.km && st.kmCast === 'cataclysm' ? 'boss-cast' : st.kind === 'roll' || st.kind === 'quench' ? st.kind : st.hounds.length ? 'hounds' : '';
    if (key && !shot.has(key)) { shot.add(key); await page.screenshot({ path: `${out}/2-${key}.png` }); }
    if (st.state === 'draft') await page.evaluate(() => { const s = window.__ember.scene(); s.world.choose(0); });
    if (st.end || st.state === 'ended') break;
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(800);
  for (const v of await page.evaluate(() => window.__coachSeen)) if (!said.some((x) => x.k === 'coach' && x.v === v)) { said.push({ k: 'coach', v, t: -1 }); console.log(`  (between polls) coach: ${v}`); }
  const end = await page.evaluate(() => { const s = window.__ember.scene().world.summary(); return { victory: s.victory, time: Math.round(s.time), floorSaves: s.floorSaves, firstDelve: s.firstDelve }; });
  await page.screenshot({ path: `${out}/3-end.png` });
  console.log('end:', JSON.stringify(end));
  if (!end.victory) fail('the opening was not won');
  if (!said.some((x) => x.v.includes('Your attack fires on its own. Tap Flame Wave'))) fail('no R1 line');
  if (!said.some((x) => x.v === 'Red on the floor is a hit coming. Tap Roll to get out.')) fail('no roll line');
  if (!said.some((x) => x.k === 'draft' && x.v === 'Pick one. It lasts this delve.')) fail('no draft line');
  if (said.some((x) => /Old Vorhulm|World boss|Omen/.test(x.v))) fail('a world-boss or Omen line showed');
  const roll = said.find((x) => x.v === 'Red on the floor is a hit coming. Tap Roll to get out.');
  const r3 = said.find((x) => x.v.startsWith('Hollow Wardens'));
  const r5 = said.find((x) => x.v.startsWith('Cinder Brute'));
  if (roll && r3 && r5 && !(roll.t >= r3.t && roll.t <= r5.t)) fail('the roll line did not come in the slammer room');
  if (said.some((x) => /door guard|Pick your fights|hulking/.test(x.v))) fail('an old tip showed in the opening');
  // F opens at level 1 (#898): room 5 opens on its name, then the Quench line comes on the caster's first cast.
  const quench = said.find((x) => x.v === 'A blue bar is a cast. Tap Quench, the blue button, to stop it.');
  if (!quench) fail('no Quench line');
  else if (r5 && quench.t >= 0 && quench.t < r5.t) fail('the Quench line came before the caster room');
  if (said.some((x) => /step out of the ring/.test(x.v))) fail('the no-interrupt caster line showed');
  // PR 3: the short Kiln Mother's three lines, in her name, and no stage title or Boil-over.
  for (const line of ["A thief from Wick. I thought you'd all gone cold.", 'Mind the pots. I fired every one of them.', 'Take it, then. I can always make more than you can carry.']) {
    if (!said.some((x) => x.k === 'banner' && x.v === `The Kiln Mother | ${line}`)) fail(`her line did not show: ${line}`);
  }
  if (said.some((x) => /Stage 2|Phase 2|boils over/.test(x.v))) fail('a stage title or Boil-over showed in the short Kiln Mother');
  console.log('first Quench banner:', said.some((x) => x.v.startsWith('It fears water. Of course it does.')));
  await ctx.close();

  // 2. Quitting mid-opening: back to the wake screen, and no run counted.
  const { page: p2 } = await page0(null);
  await tapIn(p2);
  await p2.waitForTimeout(1500);
  await p2.click('#pauseBtn');
  await p2.waitForTimeout(300);
  await p2.click('#quitBtn');
  await p2.waitForTimeout(600);
  const q = await p2.evaluate(() => ({ wake: !document.querySelector('#wake').hidden, runs: JSON.parse(localStorage.getItem('horders.hero.v1') || '{}').runs ?? 0 }));
  await p2.screenshot({ path: `${out}/4-quit-wake.png` });
  console.log('quit mid-opening:', JSON.stringify(q));
  if (!q.wake || q.runs !== 0) fail('quitting the opening did not bring the wake screen back with no run');
  await tapIn(p2);
  const again = await p2.evaluate(() => { const w = window.__ember.scene().world; return { first: w.firstDelve, route: w.route.join() }; });
  console.log('replayed:', JSON.stringify(again));
  if (!again.first) fail('the replay was not the opening');
  await browser.close();
  files.close();
  console.log(process.exitCode ? 'FAILED' : 'ALL PASS');
})();
