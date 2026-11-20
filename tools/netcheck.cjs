// Checks co-op parties in real Chromium: one host, three guests over WebRTC,
// signalling through BroadcastChannel, and a fifth player refused as full.
// Usage: node tools/netcheck.cjs
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const http = require('http');
(async () => {
  const bundle = esbuild.buildSync({ entryPoints: ['client/net/party.ts', 'client/net/signal.ts'], bundle: true, format: 'iife', globalName: 'Net', write: false, outdir: 'x' });
  const js = bundle.outputFiles.map((f) => `(() => { ${f.text.replace('var Net =', 'const N =')}; window.Net = Object.assign(window.Net || {}, N); })();`).join('\n');
  const server = http.createServer((req, res) => {
    if (req.url === '/net.js') { res.setHeader('content-type', 'text/javascript'); return res.end(js); }
    res.setHeader('content-type', 'text/html'); res.end('<!doctype html><script src="/net.js"></script>');
  }).listen(0);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const pages = [];
  for (let i = 0; i < 5; i++) { const p = await ctx.newPage(); await p.goto(url); pages.push(p); }
  const errors = [];
  pages.forEach((p, i) => p.on('pageerror', (e) => errors.push(`page${i}: ${e.message}`)));
  // Host
  await pages[0].evaluate(async () => {
    window.log = [];
    const party = new Net.Party(Net.localSignal('TEST1'), 'host', { name: 'Host', cls: 'bulwark' }, {
      onJoin: (m) => window.log.push('join:' + m.name),
      onMessage: (from, ch, d) => { window.log.push(`${ch}:${d.n}`); party.send(from, ch, { n: d.n + 1000 }); },
    });
    window.party = party;
    await party.start();
  });
  // Guests, one at a time
  for (let i = 1; i < 5; i++) {
    await pages[i].evaluate(async (i) => {
      window.log = [];
      const party = new Net.Party(Net.localSignal('TEST1'), 'guest', { name: 'G' + i, cls: 'duskblade' }, {
        onJoin: (m) => { window.log.push('join:' + m.name); party.broadcast('rel', { n: i }); party.broadcast('fast', { n: i * 10 }); },
        onMessage: (from, ch, d) => window.log.push(`${ch}:${d.n}`),
        onRefused: (r) => window.log.push('refused:' + r),
      });
      window.party = party;
      await party.start();
    }, i);
    await pages[i].waitForTimeout(1500);
  }
  await pages[0].waitForTimeout(1000);
  const logs = [];
  for (const p of pages) logs.push(await p.evaluate(() => window.log));
  const hostMembers = await pages[0].evaluate(() => window.party.members.map((m) => m.name));
  // A guest leaves; the host should drop them.
  await pages[2].evaluate(() => window.party.close());
  await pages[0].waitForTimeout(1500);
  const afterLeave = await pages[0].evaluate(() => window.party.members.map((m) => m.name));
  console.log(JSON.stringify({ logs, hostMembers, afterLeave, errors }, null, 1));
  await browser.close();
  server.close();
})();
