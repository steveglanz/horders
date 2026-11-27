// Play driver for AI playtesters: one real browser running the built game, driven one command at a time.
// The game is FROZEN between commands (scene warp 0), so a slow tester never dies while thinking;
// each move/hold/cast command runs the game for the time it names, then freezes it again.
//
//   npm ci && npm run build                       (once; rebuild after every git pull)
//   node tools/playdriver.cjs start [--view phone|se|p320|land|tablet|desk] [--fresh|--hero tools/heroes/hero-t6.json]
//                                   [--out <dir>] [--port 7811] [--2d] [--live] [--query "localparty=1&seed=5"]
//   --2d is much faster in a cloud container (headless 3D runs the game ~8x slower; move/wait still count game time).
//   node tools/playdriver.cjs look [name]        screenshot + what is on screen (overlays, buttons, HUD, nearby foes)
//   node tools/playdriver.cjs tap "<button text>" | tap css:<selector> | tap xy:<x>,<y>
//   node tools/playdriver.cjs move <up|down|left|right|up-left|...> <ms>   hold WASD for ms of GAME time (stops early on a draft or the end)
//   node tools/playdriver.cjs stick <dir> <ms>    drag the on-screen joystick (phones) for ms
//   node tools/playdriver.cjs cast <1-4> [ms]     press an ability key, then run ms (default 300)
//   node tools/playdriver.cjs key <Key> [ms]      press any key (Enter, Escape, p, 1...)
//   node tools/playdriver.cjs wait <ms>           run the game with no input
//   node tools/playdriver.cjs auto <seconds> [warp]  the game's own bot plays (to skip ahead); say so in reports
//   node tools/playdriver.cjs state               JSON state only (no screenshot)
//   node tools/playdriver.cjs scroll <css-selector|page> <dy>
//   node tools/playdriver.cjs eval "<js>"         bug hunters only: run JS in the page, prints the result
//   node tools/playdriver.cjs errors              page errors and console errors so far
//   node tools/playdriver.cjs stop
//
// Every command is appended to <out>/actions.log with game time, so a report can quote exact repro steps.
// The backend (Supabase) is faked: nothing is written to the live game. Phones use isMobile + touch.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const { spawn } = require('child_process');

const VIEWS = {
  phone: { width: 430, height: 932, mobile: true },   // iPhone 15 Pro Max (Steve's test phone)
  se: { width: 375, height: 667, mobile: true },
  p320: { width: 320, height: 568, mobile: true },
  land: { width: 932, height: 430, mobile: true },
  tablet: { width: 820, height: 1180, mobile: true },
  desk: { width: 1280, height: 800, mobile: false },
};
const DIRS = { up: ['w'], down: ['s'], left: ['a'], right: ['d'], 'up-left': ['w', 'a'], 'up-right': ['w', 'd'], 'down-left': ['s', 'a'], 'down-right': ['s', 'd'] };
const STATE_FILE = (port) => path.resolve(`tools/shots/.playdriver-${port}.json`);

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; o[k] = v; } else o._.push(a);
  }
  return o;
}

// ------------------------------------------------------------------ client side

async function send(port, body) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const q = http.request({ host: '127.0.0.1', port, path: '/', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }, timeout: 600000 }, (r) => {
      let s = ''; r.on('data', (c) => (s += c)); r.on('end', () => res(s));
    });
    q.on('error', rej); q.end(data);
  });
}

async function client() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  const port = +(a.port || process.env.PLAYDRIVER_PORT || 7811);
  if (!cmd || cmd === 'help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n')); return; }
  if (cmd === 'start') {
    if (!fs.existsSync('dist/index.html')) { console.error('dist/index.html missing: run npm ci && npm run build first'); process.exit(1); }
    fs.mkdirSync('tools/shots', { recursive: true });
    const log = fs.openSync(`tools/shots/.playdriver-${port}.log`, 'w');
    const child = spawn(process.execPath, [__filename, '__serve', ...process.argv.slice(3)], { detached: true, stdio: ['ignore', log, log] });
    child.unref();
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { const s = await send(port, { cmd: 'ping' }); console.log(s); return; } catch { /* not up yet */ }
    }
    console.error('driver did not start; see ' + `tools/shots/.playdriver-${port}.log`); process.exit(1);
  }
  try {
    console.log(await send(port, { cmd, a: a._.slice(1) }));
  } catch (e) {
    console.error(`no driver on port ${port} (${e.code}); run: node tools/playdriver.cjs start`); process.exit(1);
  }
}

// ------------------------------------------------------------------ server side

async function server() {
  const a = args(process.argv.slice(3));
  const port = +(a.port || process.env.PLAYDRIVER_PORT || 7811);
  const view = VIEWS[a.view || 'phone'] || VIEWS.phone;
  const out = path.resolve(a.out || `tools/shots/playtest-${Date.now()}`);
  fs.mkdirSync(out, { recursive: true });
  const live = !!a.live;
  const actions = path.join(out, 'actions.log');
  const dist = path.resolve('dist');
  const files = http.createServer((q, r) => {
    const p = path.join(dist, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    const f = p.endsWith(path.sep) || p === dist ? path.join(dist, 'index.html') : p;
    if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    const ext = path.extname(f);
    r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json' }[ext] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  }).listen(0);

  const browser = await chromium.launch({ args: a['2d'] ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 1, isMobile: view.mobile, hasTouch: view.mobile });
  if (a.hero && a.hero !== true) {
    const hero = fs.readFileSync(path.resolve(a.hero), 'utf8');
    await ctx.addInitScript((h) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('horders.hero.v1', h); sessionStorage.setItem('seeded', '1'); } }, hero);
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  // Fake backend: the live Supabase project is never touched.
  await page.route('https://*.supabase.co/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/auth/v1/signup') return json({ access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
    if (u.pathname === '/rest/v1/hero_saves' && req.method() === 'GET') return json([]);
    if (u.pathname === '/rest/v1/hero_saves') return route.fulfill({ status: 201, body: '' });
    if (u.pathname.endsWith('/world_boss_status')) return json({ id: 1, name: 'Old Vorhulm', title: 'the Glutton', hp: 312000, max_hp: 500000, omen: 'warded', fighters: 41, my_damage: 0, unclaimed: [] });
    if (u.pathname.endsWith('/strike_world_boss')) return json({ ok: true, name: 'Old Vorhulm', dealt: 4000, hp: 308000, max_hp: 500000, defeated: false });
    return json([], 200);
  });
  const qs = '?' + [a['2d'] ? 'hd2d=0' : '', a.query && a.query !== true ? a.query : ''].filter(Boolean).join('&');
  await page.goto(`http://127.0.0.1:${files.address().port}/${qs}`);
  await page.waitForTimeout(2000);
  const t0 = Date.now();
  let shotN = 0;
  let stickPos = null;

  const gameTime = () => page.evaluate(() => window.__ember?.scene()?.world?.time ?? null).catch(() => null);
  const freeze = (on) => page.evaluate((on) => { const s = window.__ember?.scene(); if (s && s.sys?.isActive()) s.warp = on ? 0 : 1; }, on).catch(() => {});
  /** Run the game for ms of game time (warp 1), then freeze it again unless --live. */
  // Game time, not wall time: headless 3D (SwiftShader) can run the game several times slower than real time.
  const run = async (ms) => {
    const want = Math.max(0, Math.min(+ms || 0, 60000)) / 1000;
    const start = await gameTime();
    await freeze(false);
    if (start == null) await page.waitForTimeout(want * 1000);
    else {
      const until = Date.now() + Math.max(want * 1000 * 20, 5000);
      while (Date.now() < until) {
        const t = await gameTime();
        if (t == null || t >= start + want) break;
        const ended = await page.evaluate(() => window.__ember?.scene()?.world?.state === 'ended' || !document.getElementById('draft').hidden).catch(() => true);
        if (ended) break;
        await page.waitForTimeout(40);
      }
    }
    if (!live) await freeze(true);
  };
  const log = async (line) => { const gt = await gameTime(); fs.appendFileSync(actions, `[real ${((Date.now() - t0) / 1000).toFixed(1)}s | game ${gt == null ? '-' : gt.toFixed(1) + 's'}] ${line}\n`); };

  const state = () => page.evaluate(() => {
    const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
    const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
    const overlays = [...document.querySelectorAll('.overlay, .sheet, #hud, #actionbar, #tabbar, #banner')].filter(vis).map((e) => e.id || e.className);
    const buttons = [...document.querySelectorAll('button, summary, [role=button], a[href], input, select, .card, [data-tab]')].filter(vis).map((b) => {
      const r = b.getBoundingClientRect();
      if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight || (r.width > innerWidth * 0.9 && r.height > innerHeight * 0.8)) return '';
      return `${txt(b).slice(0, 40) || b.getAttribute('aria-label') || b.id || b.tagName}${b.id ? ' #' + b.id : ''} @${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)} ${Math.round(r.width)}x${Math.round(r.height)}${b.disabled ? ' (disabled)' : ''}`;
    }).filter((s, i, arr) => s && arr.indexOf(s) === i).slice(0, 60);
    const banner = vis(document.getElementById('banner')) ? txt(document.getElementById('banner')) : '';
    const toasts = [...document.querySelectorAll('#toasts > *')].filter(vis).map(txt).slice(0, 6);
    const s = window.__ember?.scene();
    const active = s && s.sys?.isActive();
    let run = null;
    if (active && s.world) {
      const w = s.world; const p = w.player;
      const foes = w.enemies.filter((e) => e.alive).map((e) => ({ name: e.def?.name || e.kind, rank: e.def?.rank, hp: `${Math.round(e.hp)}/${Math.round(e.maxHp)}`, dist: Math.round(Math.hypot(e.x - p.x, e.y - p.y)), dir: (() => { const dx = e.x - p.x, dy = e.y - p.y; const v = Math.abs(dy) > Math.abs(dx) * 0.5 ? (dy < 0 ? 'up' : 'down') : ''; const h = Math.abs(dx) > Math.abs(dy) * 0.5 ? (dx < 0 ? 'left' : 'right') : ''; return [v, h].filter(Boolean).join('-'); })() }))
        .sort((x, y) => x.dist - y.dist);
      run = { state: w.state, phase: w.phase, pos: [Math.round(p.x), Math.round(p.y)], dungeon: w.dungeonId, tier: w.tier, time: +w.time.toFixed(1), hp: `${Math.round(p.hp)}/${Math.round(p.maxHp)}`, level: p.level, kills: w.kills, cds: (p.cds || []).map((c) => +(+c).toFixed(1)), foesAlive: foes.length, nearest: foes.slice(0, 6), hallsRoom: w.halls ? w.hallsRoom ?? null : null, draft: w.choices?.length ? w.choices.map((c) => c.name || c.id || JSON.stringify(c).slice(0, 60)) : undefined };
    }
    const heading = [...document.querySelectorAll('h1, h2, .eyebrow')].filter(vis).map(txt).filter(Boolean).slice(0, 6);
    return { overlays, heading, banner, toasts, run, buttons };
  });

  const resolveTap = async (target) => {
    if (target.startsWith('xy:')) { const [x, y] = target.slice(3).split(',').map(Number); await page.mouse.click(x, y); return `tapped ${x},${y}`; }
    if (target.startsWith('css:')) { await page.locator(target.slice(4)).first().click({ timeout: 4000 }); return `tapped ${target}`; }
    // By text: an exact match wins; otherwise the text must match exactly one visible control.
    const pick = await page.evaluate((target) => {
      const norm = (x) => (x || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const t = norm(target);
      const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && cs.visibility !== 'hidden' && !el.closest('[hidden]'); };
      const els = [...document.querySelectorAll('button, summary, [role=button], a[href], .card, [data-tab], label')].filter(vis);
      const label = (el) => norm(el.innerText || el.textContent) || norm(el.getAttribute('aria-label'));
      const exact = els.filter((el) => label(el) === t);
      const part = els.filter((el) => label(el).includes(t));
      const hit = exact.length === 1 ? exact[0] : exact.length === 0 && part.length === 1 ? part[0] : null;
      if (!hit) return { many: (exact.length ? exact : part).map((el) => label(el).slice(0, 50)) };
      const r = hit.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: label(hit).slice(0, 50) };
    }, target);
    if (pick.many) throw new Error(pick.many.length ? `"${target}" matches ${pick.many.length} controls: ${pick.many.join(' | ')}. Use more of the text, css:<selector> or xy:x,y` : `nothing visible matches "${target}"`);
    await page.mouse.click(pick.x, pick.y);
    return `tapped "${pick.label}" at ${Math.round(pick.x)},${Math.round(pick.y)}`;
  };

  const handlers = {
    ping: async () => ({ ok: true, out, view: a.view || 'phone', frozenBetweenCommands: !live, note: 'driver up; run: node tools/playdriver.cjs look' }),
    look: async ([name]) => {
      const file = path.join(out, `${String(++shotN).padStart(3, '0')}-${(name || 'look').replace(/[^a-z0-9-]/gi, '_')}.png`);
      await page.screenshot({ path: file });
      const st = await state();
      await log(`look -> ${path.basename(file)}`);
      return { screenshot: file, ...st };
    },
    state: async () => state(),
    tap: async (rest) => { const target = rest.join(' '); const r = await resolveTap(target); await page.waitForTimeout(250); await freeze(!live); await log(r); return { ok: r }; },
    move: async ([dir, ms]) => {
      const ks = DIRS[dir]; if (!ks) return { error: `dir must be one of ${Object.keys(DIRS).join(', ')}` };
      for (const k of ks) await page.keyboard.down(k);
      await run(ms || 500);
      for (const k of ks) await page.keyboard.up(k);
      await log(`move ${dir} ${ms || 500}ms`); return { ok: true, run: (await state()).run };
    },
    stick: async ([dir, ms]) => {
      const ks = DIRS[dir]; if (!ks) return { error: 'bad dir' };
      const z = await page.evaluate(() => { const t = document.getElementById('touch'); const r = t?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width * 0.3, y: r.y + r.height * 0.75 } : null; });
      if (!z) return { error: 'no #touch zone on screen (not in a run, or not a phone view)' };
      const dx = (ks.includes('a') ? -1 : ks.includes('d') ? 1 : 0) * 50; const dy = (ks.includes('w') ? -1 : ks.includes('s') ? 1 : 0) * 50;
      await page.mouse.move(z.x, z.y); await page.mouse.down(); await page.mouse.move(z.x + dx, z.y + dy, { steps: 4 });
      await run(ms || 500);
      await page.mouse.up();
      stickPos = null;
      await log(`stick ${dir} ${ms || 500}ms`); return { ok: true, run: (await state()).run };
    },
    cast: async ([n, ms]) => { await page.keyboard.press(String(n)); await run(ms || 300); await log(`cast ${n}`); return { ok: true, run: (await state()).run }; },
    key: async ([k, ms]) => { await page.keyboard.press(k); await run(ms || 200); await log(`key ${k}`); return { ok: true }; },
    wait: async ([ms]) => { await run(ms || 1000); await log(`wait ${ms || 1000}ms`); return { ok: true, run: (await state()).run }; },
    auto: async ([sec, warp]) => {
      const s = Math.min(+sec || 10, 300); const wp = Math.min(+warp || 1, 8);
      await page.evaluate((wp) => { const sc = window.__ember.scene(); if (sc && sc.sys?.isActive()) { sc.autopilot = true; sc.autoPick = true; sc.warp = wp; } }, wp);
      await page.waitForTimeout(s * 1000);
      await page.evaluate(() => { const sc = window.__ember.scene(); if (sc) { sc.autopilot = false; } });
      if (!live) await freeze(true);
      await log(`auto ${s}s warp ${wp} (game bot played)`); return { ok: true, run: (await state()).run };
    },
    scroll: async ([sel, dy]) => { await page.evaluate(([sel, dy]) => { const el = sel === 'page' ? document.scrollingElement : document.querySelector(sel); if (el) el.scrollBy(0, +dy); else [...document.querySelectorAll('.overlay.screen:not([hidden]), .sheet:not([hidden]) .sheet-body, #sheetBody')].forEach((e) => e.scrollBy(0, +dy)); }, [sel, dy || 400]); await log(`scroll ${sel} ${dy}`); return { ok: true }; },
    eval: async (rest) => { const js = rest.join(' '); const v = await page.evaluate((js) => { try { return JSON.stringify((0, eval)(js))?.slice(0, 4000); } catch (e) { return 'error: ' + e.message; } }, js); await log(`eval ${js.slice(0, 120)}`); return { result: v }; },
    errors: async () => ({ errors: errs.slice(-40), total: errs.length }),
    stop: async () => { await log('stop'); setTimeout(async () => { await browser.close().catch(() => {}); files.close(); ctrl.close(); fs.rmSync(STATE_FILE(port), { force: true }); process.exit(0); }, 100); return { ok: 'stopped', out }; },
  };

  // Freeze runs as soon as one starts (the game ticks in real time otherwise).
  if (!live) setInterval(() => page.evaluate(() => { const s = window.__ember?.scene(); if (s && s.sys?.isActive() && s.world && s.__pdWorld !== s.world) { s.__pdWorld = s.world; s.warp = 0; } }).catch(() => {}), 150);

  let busy = Promise.resolve();
  const ctrl = http.createServer((q, r) => {
    let body = ''; q.on('data', (c) => (body += c)); q.on('end', () => {
      busy = busy.then(async () => {
        let res;
        try { const { cmd, a: rest = [] } = JSON.parse(body || '{}'); const h = handlers[cmd]; res = h ? await h(rest) : { error: `unknown command ${cmd}; commands: ${Object.keys(handlers).join(', ')}` }; } catch (e) { res = { error: String(e.message || e).slice(0, 500) }; }
        if (errs.length && res && typeof res === 'object' && !res.errors) res.newErrors = errs.length;
        r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(res, null, 1));
      });
    });
  }).listen(port, '127.0.0.1');
  fs.writeFileSync(STATE_FILE(port), JSON.stringify({ pid: process.pid, out }));
  fs.appendFileSync(actions, `# playdriver view=${a.view || 'phone'} ${a.fresh ? 'fresh player' : a.hero ? 'hero ' + a.hero : 'saved/default hero'} ${a['2d'] ? '2D' : '3D'} commit=${(() => { try { return require('child_process').execSync('git rev-parse --short HEAD').toString().trim(); } catch { return '?'; } })()}\n`);
}

if (process.argv[2] === '__serve') server().catch((e) => { console.error(e); process.exit(1); });
else client();
