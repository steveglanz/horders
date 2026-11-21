// Store page assets (roadmap L5): app icons from docs/store/icon.svg, store screenshots
// at the sizes the stores ask for, and an optional 30 s trailer capture.
//
//   npm run build && node tools/storeshots.cjs <outDir> [icons] [phone] [landscape] [desktop] [trailer]
//
// With no target names it makes everything except the trailer. Screenshots load the game with
// ?hires=1 so the canvas renders at the full 3x of the store size, and ?god=1 so the hero lives.
// Each fight restarts the scene straight into a boss (or an opener for the horde shot), lets the
// bots play at speed, and freezes the frame mid-wind-up so the telegraph shows.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');

const out = process.argv[2] || 'tools/shots';
const want = new Set(process.argv.slice(3));
const all = want.size === 0;
fs.mkdirSync(out, { recursive: true });
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

// Apple 6.9"/6.7" (1290x2796), Google Play and the web take the same shots.
const SIZES = {
  phone: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 932, height: 430 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
};

// The fights, in the order a store page shows them.
const SCENES = [
  { name: '2-warpack', opts: { cls: 'emberwright', dungeon: 'kiln', route: ['warpack', 'kilnMother'], tier: 3 }, until: 'busy' },
  { name: '3-ondrel-party', opts: { cls: 'bulwark', dungeon: 'hammerdeep', route: ['ondrel'], tier: 4, heroName: 'Bulwark 4', party: [{ cls: 'lumen', name: 'Lumen 4' }, { cls: 'emberwright', name: 'Emberwright 4' }, { cls: 'duskblade', name: 'Duskblade 4' }] }, boss: 'ondrel', cast: 'anvilfall', at: 0.6 },
  { name: '4-lensmother', opts: { cls: 'duskblade', dungeon: 'glarewell', route: ['lensmother'], tier: 7 }, boss: 'lensmother', cast: 'lensSweep', at: 0.45 },
  { name: '5-maelra', opts: { cls: 'lumen', dungeon: 'foundry', route: ['maelra'], tier: 5 }, boss: 'maelra', cast: null, at: 0 },
];

function serve() {
  const html = fs.readFileSync(path.resolve('dist/index.html'));
  return http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
}

async function icons(browser) {
  const svg = fs.readFileSync(path.resolve('docs/store/icon.svg'), 'utf8');
  // Rounded-corner preview of how a launcher masks it, plus the full-bleed sizes stores take.
  const sizes = [1024, 512, 192, 180, 48, 32];
  for (const s of sizes) {
    const page = await browser.newPage({ viewport: { width: s, height: s } });
    await page.setContent(`<html><body style="margin:0">${svg.replace('width="1024" height="1024"', `width="${s}" height="${s}"`)}</body></html>`);
    await page.screenshot({ path: path.join(out, `icon-${s}.png`) });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 560, height: 200 } });
  const tile = (s, r) => `<div style="width:${s}px;height:${s}px;border-radius:${r};overflow:hidden;flex:none">${svg.replace('width="1024" height="1024"', `width="${s}" height="${s}"`)}</div>`;
  await page.setContent(`<html><body style="margin:0;height:200px;display:flex;gap:28px;align-items:center;justify-content:center;background:#e9e4df">${tile(160, '22%')}${tile(160, '50%')}${tile(64, '22%')}${tile(32, '6px')}</body></html>`);
  await page.screenshot({ path: path.join(out, 'icon-masks.png') });
  await page.close();
  console.log('icons done');
}

async function fight(page, sc, tag, errs) {
  await page.evaluate((o) => {
    const s = window.__ember.scene();
    s.scene.restart({ opts: { seed: 7, invulnerable: true, ...o }, hud: s.hud, onEnd: () => {} });
  }, sc.opts);
  await page.waitForTimeout(800);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; s.warp = 3; });
  if (sc.until === 'busy') {
    // A few seconds in, with the pack still up around the hero.
    await page.waitForFunction(() => { const w = window.__ember.scene().world; const up = w.enemies.filter((e) => e.alive); const p = w.player; const near = up.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 260); const ok = w.phase === 'fight' && w.time > 8 && near.length >= 2; if (ok) window.__ember.scene().warp = 0; return ok; }, null, { timeout: 90000, polling: 50 }).catch(() => errs.push('timeout ' + sc.name));
  } else {
    await page.waitForFunction((sc) => {
      const w = window.__ember.scene().world;
      // Freeze in the same frame the condition holds, so the wind-up can't finish first.
      const ok = w.enemies.some((e) => e.alive && e.kind === sc.boss && w.time - e.spawnedAt > 7 && (sc.cast === null ? w.time - e.spawnedAt > 14 : e.castId && (sc.cast === 'any' || e.castId === sc.cast) && e.castT / e.castDur > sc.at));
      if (ok) window.__ember.scene().warp = 0;
      return ok;
    }, sc, { timeout: 150000, polling: 30 }).catch(() => errs.push('timeout ' + sc.name));
  }
  await page.evaluate(() => { window.__ember.scene().warp = 0; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, `${tag}-${sc.name}.png`) });
}

async function shots(browser, tag) {
  const srv = serve();
  const ctx = await browser.newContext(SIZES[tag]);
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1&hires=1`);
  await page.waitForTimeout(900);
  // A hero with some history, so the hub isn't a fresh level-1 card: tier 7, level 14, and a
  // full set of gear (two Kilnbreaker pieces and an Epic weapon). Items are plain records in
  // the save's own shape; switching class away and back re-renders the hub with them.
  await page.evaluate(() => {
    const h = window.__ember.hero();
    h.maxTier = Math.max(h.maxTier, 7); h.level = Math.max(h.level, 14);
    const gear = [
      { slot: 'weapon', rarity: 'epic', name: 'Searing Emberbrand', stats: [['power', 15.6], ['crit', 4.8], ['haste', 6.1], ['vitality', 34]] },
      { slot: 'head', rarity: 'rare', name: 'Kilnbreaker Helm', set: 'kilnbreaker', stats: [['vitality', 61], ['power', 9.2], ['reach', 13]] },
      { slot: 'chest', rarity: 'rare', name: 'Ashen Hauberk', stats: [['vitality', 61], ['haste', 5.4], ['swiftness', 3.9]] },
      { slot: 'hands', rarity: 'rare', name: 'Kilnbreaker Grips', set: 'kilnbreaker', stats: [['haste', 10.7], ['power', 8.8], ['crit', 4.1]] },
      { slot: 'ring', rarity: 'fine', name: 'Cinder Band', stats: [['crit', 9.2], ['vitality', 30]] },
      { slot: 'trinket', rarity: 'epic', name: 'Banked Coal', stats: [['power', 18.3], ['haste', 6.6], ['crit', 4.4], ['vitality', 41]] },
    ];
    for (const g of gear) {
      const id = 'store' + g.slot;
      h.inventory = h.inventory.filter((i) => i.id !== id);
      h.inventory.push({ id, slot: g.slot, rarity: g.rarity, ilvl: 14, name: g.name, stats: g.stats.map(([stat, value]) => ({ stat, value })), ...(g.set ? { set: g.set } : {}) });
      h.equipped[g.slot] = id;
    }
    h.passives = { might: 6, fortitude: 4, insight: 2 };
    h.embers = Math.max(h.embers, 340);
  });
  await page.click('[data-cls="bulwark"]');
  await page.click('[data-cls="emberwright"]');
  // Scroll the hub so the delve cards lead (a new hero's gear card is empty).
  await page.evaluate(() => { const h = document.querySelector('.hub-delve'); if (h && innerWidth < 900) h.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, `${tag}-1-hub.png`) });
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 20000 });
  for (const sc of SCENES) await fight(page, sc, tag, errs);
  console.log(tag, errs.length ? errs.join('\n') : 'no errors');
  await ctx.close(); srv.close();
}

// 30 seconds of the Hammerdeep boss with a full party, recorded in real time at 1280x720.
// Software GL can't hold 60 fps, so the run plays at warp 1 and the recorder keeps the
// real frame rate; re-encode or speed-ramp in an editor for the store's trailer.
async function trailer(browser) {
  const srv = serve();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/?seed=7&god=1`);
  await page.waitForTimeout(2500);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 20000 });
  await page.evaluate((o) => { const s = window.__ember.scene(); s.scene.restart({ opts: { seed: 7, invulnerable: true, ...o }, hud: s.hud, onEnd: () => {} }); }, SCENES[1].opts);
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; });
  await page.waitForTimeout(28000);
  const video = page.video();
  await ctx.close();
  const file = path.join(out, 'trailer-hammerdeep.webm');
  await video.saveAs(file);
  await video.delete();
  srv.close();
  console.log('trailer', file);
}

(async () => {
  const browser = await chromium.launch({ args: GL });
  if (all || want.has('icons')) await icons(browser);
  for (const tag of ['phone', 'landscape', 'desktop']) if (all || want.has(tag)) await shots(browser, tag);
  if (want.has('trailer')) await trailer(browser);
  await browser.close();
})();
