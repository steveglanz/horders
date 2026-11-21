// Usage: npm run build && node tools/partyperf.cjs
// L2 performance check, two parts:
// 1. Load: dist/index.html served gzipped over Lighthouse's "slow 4G" mobile profile
//    (150 ms RTT, 1.6 Mbps down, 750 Kbps up) with 4x CPU throttling, timed to the title screen being usable.
// 2. Frame rate: a 4-hero party (you plus three bot allies, ?botparty) on a 390x844 phone at 2x DPR,
//    at 1x and 4x CPU throttling (4x is Lighthouse's mid-tier phone setting), sampled in fights.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const gz = zlib.gzipSync(html, { level: 9 });
const srv = http.createServer((q, r) => {
  r.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip', 'cache-control': 'no-store' });
  r.end(gz);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}/`;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  console.log(`page: ${(html.length / 1024).toFixed(0)} KB, gzipped ${(gz.length / 1024).toFixed(0)} KB`);
  for (const run of [1, 2, 3]) {
    const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const t0 = Date.now();
    await page.goto(base + '?seed=3', { waitUntil: 'commit' });
    await page.waitForFunction(() => !!window.__ember && !!document.querySelector('canvas') && !document.getElementById('startBtn').disabled, null, { timeout: 60000 });
    const ready = Date.now() - t0;
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const f = performance.getEntriesByName('first-contentful-paint')[0]; return { response: Math.round(n.responseEnd), dcl: Math.round(n.domContentLoadedEventEnd), fcp: f ? Math.round(f.startTime) : -1 }; });
    console.log(`load ${run}: title usable ${ready} ms (html downloaded ${nav.response} ms, first paint ${nav.fcp} ms, DOMContentLoaded ${nav.dcl} ms)`);
    await page.close();
  }
  for (const throttle of [1, 4]) {
    const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    const cdp = await page.context().newCDPSession(page);
    await page.goto(base + '?seed=3&god=1&botparty=bulwark,lumen,duskblade');
    await page.waitForFunction(() => !!window.__ember);
    await page.waitForTimeout(800);
    await page.click('#startBtn');
    await page.waitForFunction(() => window.__ember.scene()?.world, null, { timeout: 15000 });
    await page.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.autoPick = true; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    const samples = [];
    for (let k = 0; k < 6; k++) {
      await page.waitForTimeout(9000);
      samples.push(await page.evaluate(() => { const s = window.__ember.scene(); const w = s.world; const f = s.fps(); return { fps: +f.avg.toFixed(1), p95ms: +f.p95ms.toFixed(1), gameMs: +s.workMs().toFixed(2), heroes: w.heroes.length, enemies: w.aliveEnemies, phase: w.phase, state: w.state }; }));
    }
    const fight = samples.filter((x) => x.phase === 'fight');
    const use = fight.length ? fight : samples;
    const avg = (k) => (use.reduce((a, x) => a + x[k], 0) / use.length).toFixed(1);
    console.log(`4 heroes, phone 390x844 @2x, CPU ${throttle}x: fps ${avg('fps')} (worst sample ${Math.min(...use.map((x) => x.fps))}), p95 frame ${avg('p95ms')} ms, game code ${avg('gameMs')} ms/frame, over ${use.length} fight samples`);
    console.log('  samples', JSON.stringify(samples));
    if (errs.length) console.log('  page errors', errs);
    await page.close();
  }
  await b.close(); srv.close();
})();
