// Pause/resume check (client/resume.ts): in the real build (390x844 phone, fake backend), the game bot plays a Kiln
// delve for a while; the page is then reloaded mid-delve (pagehide saves it, as when iOS throws the page away). The
// reload must open the same delve paused at the same tick, hero spot, health, Sparks and foes; unpaused it plays on to the
// end screen, and the save is gone after. A second pass reloads during a Spark draft.
// node tools/resumecheck.cjs [outDir]   (after npm run build; HERO=tools/heroes/hero-t4.json by default; LOOK=3d for 3D; END=0 skips playing to the end)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'docs/art/resume-cp3');
fs.mkdirSync(out, { recursive: true });
const dist = path.resolve('dist');
const hero = fs.readFileSync(path.resolve(process.env.HERO || 'tools/heroes/hero-t4.json'), 'utf8');
const look = process.env.LOOK === '3d' ? '' : '?hd2d=0';
const files = http.createServer((q, r) => {
  const p = path.join(dist, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  const f = p.endsWith(path.sep) || p === dist ? path.join(dist, 'index.html') : p;
  if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(0);
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
const sig = () => {
  const s = window.__ember.scene(); const w = s.world;
  return JSON.stringify({ tick: w.tick, state: w.state, hp: w.player.hp, x: w.player.x, y: w.player.y, talents: w.talents, level: w.player.level,
    foes: w.enemies.filter((e) => e.alive).map((e) => [e.kind, Math.round(e.hp * 1000), Math.round(e.x), Math.round(e.y)]), kills: w.kills });
};
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // The hero only goes in once: a reload must find the save the game itself wrote.
  await ctx.addInitScript((h) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('horders.hero.v1', h); sessionStorage.setItem('seeded', '1'); } }, hero);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail('pageerror ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  await page.route('https://*.supabase.co/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
    if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json([]);
    if (u.pathname === '/rest/v1/hero_saves') return route.fulfill({ status: 201, body: '' });
    if (u.pathname.endsWith('/world_boss_status')) return json({ id: 1, name: 'Old Vorhulm', title: 'the Glutton', hp: 312000, max_hp: 500000, omen: 'warded', fighters: 41, my_damage: 0, unclaimed: [] });
    return json([], 200);
  });
  const url = `http://127.0.0.1:${files.address().port}/${look}`;
  await page.goto(url);
  await page.waitForFunction(() => !!window.__ember);
  await page.waitForTimeout(800);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 60000 });
  const runsBefore = await page.evaluate(() => window.__ember.hero().runs ?? null);

  // Pass 1 plays until about 40 s of game time; pass 2 (after the first resume) until the next Spark draft.
  for (const pass of ['running', 'draft']) {
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 4; });
    if (pass === 'running') await page.waitForFunction(() => window.__ember.scene().world.time > 40, null, { timeout: 120000 });
    else {
      await page.evaluate(() => { window.__ember.scene().autoPick = false; });
      await page.waitForFunction(() => window.__ember.scene().world.state === 'draft', null, { timeout: 180000 });
    }
    await page.evaluate(() => window.__ember.scene().togglePause(true));
    await page.waitForTimeout(300);
    const before = await page.evaluate(sig);
    await page.screenshot({ path: `${out}/${pass}-1-before.jpg`, quality: 70 });
    const t0 = Date.now();
    await page.reload();
    await page.waitForFunction(() => !!window.__ember?.scene()?.world && window.__ember.scene().world.tick > 0 && document.querySelector('#hd2dLoad').hidden, null, { timeout: 60000 });
    const ms = Date.now() - t0;
    await page.waitForTimeout(500);
    const after = await page.evaluate(sig);
    const paused = await page.evaluate(() => !document.querySelector('#pause').hidden);
    await page.screenshot({ path: `${out}/${pass}-2-resumed.jpg`, quality: 70 });
    const b = JSON.parse(before), a = JSON.parse(after);
    console.log(`${pass}: tick ${b.tick} -> ${a.tick}, state ${a.state}, level ${a.level}, ${a.foes.length} foes, paused ${paused}, back in ${ms} ms`);
    if (before !== after) fail(`${pass}: resumed run differs\n  before ${before}\n  after  ${after}`);
    if (!paused) fail(`${pass}: resumed run is not paused`);
    if (pass === 'draft' && a.state === 'draft') {
      await page.evaluate(() => window.__ember.scene().togglePause(false));
      await page.waitForTimeout(400);
      const shown = await page.evaluate(() => !document.querySelector('#draft').hidden);
      await page.screenshot({ path: `${out}/draft-3-cards.jpg`, quality: 70 });
      console.log(`draft: Spark cards ${shown ? 'shown' : 'NOT shown'} after unpausing`);
      if (!shown) fail('the resumed draft shows no cards');
    } else {
      await page.evaluate(() => window.__ember.scene().togglePause(false));
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${out}/${pass}-3-playing.jpg`, quality: 70 });
    }
  }
  if (process.env.END === '0') { console.log(process.exitCode ? 'SOME FAILED' : 'ALL PASS (end skipped)'); await browser.close(); files.close(); return; }
  // Play on to the end: the end screen shows, the run is banked once, and the save is gone.
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 6; });
  await page.waitForFunction(() => !document.querySelector('#end').hidden, null, { timeout: 400000 });
  const end = await page.evaluate(() => ({ head: document.querySelector('#end h2, #endTitle')?.textContent?.trim(), save: localStorage.getItem('horders.resume.v1'), runs: window.__ember.hero().runs ?? null }));
  await page.screenshot({ path: `${out}/end.jpg`, quality: 70 });
  console.log(`end: "${end.head}", resume save ${end.save ? 'STILL THERE' : 'cleared'}, runs ${runsBefore} -> ${end.runs}`);
  if (end.save) fail('resume save left after the run ended');
  await page.reload();
  await page.waitForTimeout(1500);
  const hub = await page.evaluate(() => ({ title: !document.querySelector('#title').hidden, scene: !!window.__ember.scene()?.sys?.isActive() }));
  if (!hub.title || hub.scene) fail('a finished run came back on reload');
  console.log(process.exitCode ? 'SOME FAILED' : 'ALL PASS');
  await browser.close();
  files.close();
})();
