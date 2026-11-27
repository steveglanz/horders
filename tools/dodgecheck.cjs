// CP2 dodge wiring check (vision v2 item 3): on a touch phone, the Roll button shows and rolls with the Dodge setting on
// "Button"; on "Flick the stick" the button hides, a fast flick of the stick rolls, and a slow push of the stick doesn't.
// Real touch events (Chrome DevTools Input.dispatchTouchEvent) on the real build at 390x844.
// Usage: npm run build && node tools/dodgecheck.cjs [distDir]   Exits 1 if any check fails.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const dist = process.argv[2] || 'dist';
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const f = path.join(dist, p === '/hd2d.js' ? 'hd2d.js' : 'index.html');
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  r.end(fs.readFileSync(path.resolve(f)));
}).listen(0);
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); };
async function run(b, dodge) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((d) => localStorage.setItem('horders.display.v1', JSON.stringify({ graphics: 'saver', look: '2d', dodge: d })), dodge);
  await ctx.addInitScript((h) => localStorage.setItem('horders.hero.v1', h), fs.readFileSync('tools/heroes/hero-t4.json', 'utf8'));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=9&god=1`);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => window.__ember.scene()?.world?.time > 1.5 && window.__ember.scene().world.state === 'running', null, { timeout: 120000 });
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  // Rolls so far: a roll sets the hero's recharge, so count fresh recharges between two reads.
  await page.evaluate(() => {
    const s = window.__ember.scene(); window.__rolls = 0; let was = 0;
    const tick = () => { const p = s.world.player; const cd = p.rollCd ?? 0; if (cd > was + 0.01) window.__rolls++; was = cd; requestAnimationFrame(tick); };
    tick();
  });
  const rolls = () => page.evaluate(() => window.__rolls);
  const wait = (ms) => page.waitForTimeout(ms);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  /**
   * Puts a finger down at (x, y), nudges it 8 px (still near the stick's middle), then moves it to dx in `steps` moves
   * `gap` ms apart, then lifts it. Each DevTools touch event itself takes about 30 ms to arrive here, so a fast flick is
   * the nudge then one jump to the edge (about 35 ms between them, inside the 110 ms flick window).
   */
  const swipe = async (x, y, dx, steps, gap) => {
    await touch('touchStart', x, y);
    await touch('touchMove', x + 8, y);
    for (let k = 1; k <= steps; k++) { await touch('touchMove', x + 8 + ((dx - 8) * k) / steps, y); if (gap) await wait(gap); }
    await wait(120);
    await touch('touchEnd');
    await wait(250);
  };
  const btn = await page.evaluate(() => { const b = document.querySelector('.ab.roll'); if (!b) return null; const r = b.getBoundingClientRect(); return { hidden: b.hidden, visible: !b.hidden && r.width > 0 && r.height > 0, x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (dodge === 'button') {
    check('button mode: pointer is coarse (touch phone)', coarse);
    check('button mode: Roll button shows', !!btn && btn.visible, btn ? `at ${Math.round(btn.x)},${Math.round(btn.y)}` : 'no button');
    const before = await rolls();
    if (btn) { await touch('touchStart', btn.x, btn.y); await wait(60); await touch('touchEnd'); await wait(400); }
    check('button mode: tapping Roll rolls', (await rolls()) === before + 1, `${(await rolls()) - before} roll(s)`);
    await wait(3200); // the roll recharges
    const b2 = await rolls();
    await swipe(120, 500, 80, 1, 0);
    check('button mode: a fast flick does not roll', (await rolls()) === b2, `${(await rolls()) - b2} roll(s)`);
  } else {
    check('flick mode: Roll button hidden', !!btn && btn.hidden);
    const before = await rolls();
    await swipe(120, 500, 80, 1, 0); // past the stick's edge (56 px) in one quick move
    check('flick mode: a fast flick rolls', (await rolls()) === before + 1, `${(await rolls()) - before} roll(s)`);
    await wait(3200);
    const b2 = await rolls();
    await swipe(120, 500, 80, 12, 40); // the same push over about half a second: walking, not a flick
    check('flick mode: a slow push does not roll', (await rolls()) === b2, `${(await rolls()) - b2} roll(s)`);
  }
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  await run(b, 'button');
  await run(b, 'flick');
  await b.close(); srv.close();
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `${bad.length} check(s) failed` : 'all dodge checks passed');
  process.exit(bad.length ? 1 : 0);
})();
