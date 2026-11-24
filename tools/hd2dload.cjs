// HD-2D look test: what the 3D file costs on load, on engineering's L2 phone profile (tools/partyperf.cjs):
// Lighthouse "slow 4G" (150 ms RTT, 1.6 Mbps down, 750 Kbps up), 4x CPU throttling, 390x844 at 2x, files gzipped.
// 1. The title screen: time until it is usable, with ?hd2d=1 and without, and whether hd2d.js was requested
//    before Delve (it must not be).
// 2. Delve: time from the press to the run's first tick, in 2D and with ?hd2d=1 (first press: fetches hd2d.js).
// A desktop GPU stands in for the phone's here (SwiftShader, a software GPU, slower than any phone's), so the
// frame rate is left to a real phone. Usage: npm run build && node tools/hd2dload.cjs
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const files = { '/': 'dist/index.html', '/hd2d.js': 'dist/hd2d.js' };
const gz = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, zlib.gzipSync(fs.readFileSync(path.resolve(f)), { level: 9 })]));
const srv = http.createServer((q, r) => {
  const p = new URL(q.url, 'http://x').pathname;
  const k = p === '/hd2d.js' ? p : '/';
  r.writeHead(200, { 'content-type': k === '/' ? 'text/html' : 'text/javascript', 'content-encoding': 'gzip', 'cache-control': 'no-store' });
  r.end(gz[k]);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}/`;
// Seconds on the hub before Delve: node tools/hd2dload.cjs [wait-ms] (default 5000; 0 presses Delve as soon as the title is usable).
const wait = Number(process.argv[2] ?? 5000);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
(async () => {
  console.log(`index.html ${kb(fs.statSync('dist/index.html').size)}, gzipped ${kb(gz['/'].length)}; hd2d.js ${kb(fs.statSync('dist/hd2d.js').size)}, gzipped ${kb(gz['/hd2d.js'].length)}`);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = { '2d': { title: [], delve: [] }, '3d': { title: [], delve: [], load: [] } };
  for (const run of [1, 2, 3]) for (const mode of ['2d', '3d']) {
    const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const reqs = [];
    page.on('request', (q) => reqs.push({ url: q.url(), at: Date.now() }));
    await page.route('https://*.supabase.co/**', (r) => r.abort());
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const t0 = Date.now();
    await page.goto(base + '?seed=3' + (mode === '3d' ? '&hd2d=1' : '&hd2d=0'), { waitUntil: 'commit' });
    await page.waitForFunction(() => !!window.__ember && !!document.querySelector('canvas') && !document.getElementById('startBtn').disabled, null, { timeout: 90000 });
    const title = Date.now() - t0;
    // Requests while the title was becoming usable: hd2d.js must not be among them.
    const early = reqs.some((q) => q.url.endsWith('/hd2d.js') && q.at - t0 <= title);
    // A player reads the hub for a few seconds before pressing Delve (the 3D file prefetches quietly meanwhile).
    await page.waitForTimeout(wait);
    const prefetched = reqs.some((q) => q.url.endsWith('/hd2d.js'));
    const t1 = Date.now();
    await page.evaluate(() => document.getElementById('startBtn').click());
    await page.waitForFunction(() => document.getElementById('hd2dLoad').hidden, null, { timeout: 120000, polling: 50 });
    const file = Date.now() - t1;
    await page.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 120000, polling: 50 });
    const delve = Date.now() - t1;
    const on = await page.evaluate(() => !!window.__ember.scene().hd2d);
    const times = await page.evaluate(() => window.__ember.scene().hd2dTimes);
    res[mode].title.push(title); res[mode].delve.push(delve);
    console.log(`run ${run} ${mode}: title usable ${title} ms; hd2d.js requested before the title was usable: ${early ? 'YES' : 'no'}; fetched before Delve: ${prefetched ? 'yes' : 'no'}; Delve to first tick ${delve} ms (loading screen ${file} ms); 3D view on: ${on}${times ? ` (3D build ${times.mount} ms, first frame ${times.firstFrame} ms)` : ''}`);
    await page.close();
  }
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const m of ['2d', '3d']) console.log(`median ${m}: title usable ${med(res[m].title)} ms, Delve to first tick ${med(res[m].delve)} ms`);
  await b.close(); srv.close();
})();
