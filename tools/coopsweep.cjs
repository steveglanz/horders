// Usage: npm run build && node tools/coopsweep.cjs [--raid] [--pressworks] [--hoard] [--smeltery] [screenshot dir]
// Roadmap G8, the co-op QA sweep. Every hero is a page in one Chromium (same-browser signalling,
// real WebRTC), at phone size. Only the host plays (autopilot); guests stand still, so runs use
// ?god=1 and a hero is downed by hand where a check needs it. Exits 1 if any check fails.
//  1. The Hammerdeep blocks a solo hero (Start disabled).
//  2. Parties of 2, 3 and 4 finish a Kiln delve; every hero gets the end screen and a run.
//  3. A guest drops mid-fight: the host's run carries on to the end.
//  4. Hammerdeep boss revive: one pick-up per boss fight; a second downed hero stays down.
//  5. (--raid, ~6 min) Crucible with two Bulwarks: "Swap tanks!" shows on the guest tank after Ladle Pour.
//  6. (--pressworks, ~5 min) A guest drops while Oskel's Downstroke is up: the run keeps ticking and the
//     host and the other guest reach the end screen.
//  7. (--hoard, ~4 min) The Hoard (raid 2): a guest drops while swallowed, and another while the Craw stands
//     with someone else inside. The run reaches the end screen, nobody is left inside, guests hear the Hoard theme.
//  8. (--smeltery, ~2 min) The Smeltery (raid 3): the guest Wheel is about to turn on drops mid-cast. The run goes
//     on through Meltdown to the end screen; guests get the phase banners and the Smeltery theme.
// Quick join has its own script (tools/quickjoincheck.cjs) and role matching is unit tested (tests/lobby.test.ts).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.resolve('dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(0);
const RAID = process.argv.includes('--raid');
const PRESS = process.argv.includes('--pressworks');
const HOARD = process.argv.includes('--hoard');
const SMELT = process.argv.includes('--smeltery');
const dir = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'tools/shots';
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
const tab = async (p, t) => { if (await p.evaluate(() => document.body.classList.contains('tabs'))) { await p.click(`#tabbar [data-tab="${t}"]`); await p.waitForTimeout(150); } };
const world = (p, f, a) => p.evaluate(([src, arg]) => (new Function('w', 'a', src))(window.__ember.scene().world, arg), [f, a]);

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];

  /** n heroes of the given classes, linked into one party, on `dungeon` at `tier`. Returns the pages (host first). */
  async function party(classes, dungeon = 'kiln', tier = 1) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await ctx.route(/supabase\.co/, (r) => r.abort());
    const P = [];
    for (const [i, cls] of classes.entries()) {
      const p = await ctx.newPage(); const tag = i ? 'guest' + i : 'host';
      p.on('pageerror', (e) => { if (!/can not be found here/.test(e.message)) errs.push(tag + ': ' + e.message); });
      await p.goto(`http://127.0.0.1:${srv.address().port}/?localparty=1&seed=9&god=1`); await p.waitForTimeout(300);
      await tab(p, 'hero'); await p.click(`[data-cls="${cls}"]`); await tab(p, 'delve');
      // Tier unlocks are per class, so they're set after picking the class.
      if (tier > 1) {
        await p.evaluate((t) => { const h = window.__ember.hero(); h.maxTier = Math.max(h.maxTier, t); h.level = Math.max(h.level, t * 3); localStorage.setItem('horders.hero.v1', JSON.stringify(h)); }, tier);
        await p.reload(); await p.waitForTimeout(400);
      }
      P.push(p);
    }
    const [A] = P;
    if (dungeon !== 'kiln') { await A.click(`[data-d="${dungeon}"]`); await A.click(`[data-t="${tier}"]`).catch(() => {}); }
    const soloBlocked = await A.$eval('#startBtn', (x) => x.disabled);
    await tab(A, 'group'); await A.click('#hostBtn');
    const code = (await A.textContent('#partyCode')).trim();
    for (const g of P.slice(1)) { await tab(g, 'group'); await g.fill('#joinCode', code); await g.click('#joinBtn'); }
    await A.waitForFunction((n) => document.querySelectorAll('#coop li').length >= n, P.length, { timeout: 20000 }).catch(() => {});
    await tab(A, 'delve');
    return { P, ctx, soloBlocked };
  }

  /** Starts the run, plays the host with autopilot, calls `each(host)` every 0.4 s, and waits for the end. */
  async function play(P, { each, dropAt, dropWhen, dropWho } = {}) {
    const [A] = P;
    await A.click('#startBtn');
    for (const g of P.slice(1)) await g.waitForFunction(() => window.__ember.scene()?.world?.tick > 0, null, { timeout: 20000 });
    await A.evaluate(() => { const s = window.__ember.scene(); s.autopilot = true; s.warp = 3; });
    const live = new Set(P.map((_, i) => i)); const t0 = Date.now(); let dropped = false;
    while (Date.now() - t0 < 600000) {
      for (const i of live) { const p = P[i]; if (await p.isVisible('#draft').catch(() => false)) await p.click('#cards .card').catch(() => {}); }
      await A.waitForTimeout(400);
      const st = await world(A, 'return { state: w.state, phase: w.phase, t: w.time };');
      if (st.state === 'ended') break;
      if (!dropped && ((dropAt && st.phase === 'fight' && st.t > dropAt) || (dropWhen && await dropWhen(A)))) { dropped = true; const k = dropWho ? dropWho() : P.length - 1; await P[k].close(); live.delete(k); }
      if (each) await each(A, P, live);
    }
    await A.waitForTimeout(2500);
    const ends = [];
    for (const i of live) ends.push(await P[i].isVisible('#end') && (await P[i].evaluate(() => window.__ember.hero().runs)) === 1);
    return { ends, victory: await world(A, 'return w.victory;'), live };
  }

  // 1. The Hammerdeep solo block.
  {
    const { ctx, soloBlocked } = await party(['bulwark', 'lumen'], 'hammerdeep', 4);
    ok(soloBlocked, 'the Hammerdeep blocks a solo hero');
    await ctx.close();
  }
  // 2. Parties of 2, 3 and 4.
  for (const n of [2, 3, 4]) {
    const { P, ctx } = await party(['bulwark', 'lumen', 'duskblade', 'emberwright'].slice(0, n));
    const r = await play(P);
    ok(r.ends.length === n && r.ends.every(Boolean), `a party of ${n} finishes the Kiln; every hero gets the end screen and a run`);
    await ctx.close();
  }
  // 3. A guest drops mid-fight.
  {
    const { P, ctx } = await party(['bulwark', 'lumen', 'emberwright']);
    const r = await play(P, { dropAt: 20 });
    ok(r.live.size === 2 && r.ends.every(Boolean), 'a guest drops mid-fight; the host and the other guest still reach the end screen');
    await ctx.close();
  }
  // 4. Hammerdeep boss revive.
  {
    const { P, ctx } = await party(['bulwark', 'lumen', 'emberwright'], 'hammerdeep', 4);
    let downed1 = -1, downed2 = -1, minLeft = Infinity, revived1 = false, revived2 = false;
    const r = await play(P, {
      each: async (A) => {
        const s = await world(A, `if (!w.bossUp) return null;
          if (a.d1 < 0) { w.heroPlayer(1).hp = 0; return { d1: w.time }; }
          if (a.d2 < 0 && w.time - a.d1 > 14) { w.heroPlayer(2).hp = 0; return { d2: w.time }; }
          return { left: w.revivesLeft, hp1: w.heroPlayer(1).hp, hp2: w.heroPlayer(2).hp };`, { d1: downed1, d2: downed2 });
        if (!s) return;
        if (s.d1 !== undefined) downed1 = s.d1;
        else if (s.d2 !== undefined) downed2 = s.d2;
        else { minLeft = Math.min(minLeft, s.left); if (s.hp1 > 0) revived1 = true; if (downed2 >= 0 && s.hp2 > 0) revived2 = true; }
      },
    });
    ok(downed1 >= 0 && downed2 >= 0, 'Hammerdeep: two guests were downed at the boss');
    ok(revived1 !== revived2 && minLeft === 0, 'Hammerdeep: exactly one downed hero was picked up during the boss fight (one pick-up per boss fight)');
    ok(r.ends.every(Boolean), 'Hammerdeep: every hero gets the end screen');
    await P[1].screenshot({ path: path.join(dir, 'coopsweep-hammerdeep-guest.png') }).catch(() => {});
    await ctx.close();
  }
  // 5. The raid's tank swap on a guest.
  if (RAID) {
    const { P, ctx } = await party(['bulwark', 'bulwark', 'lumen', 'emberwright'], 'crucible', 8);
    let swap = false;
    await play(P, { each: async (A, P) => { if (!swap) swap = await P[1].evaluate(() => document.getElementById('banner').classList.contains('show') && document.getElementById('bannerTitle').textContent === 'Swap tanks!'); } });
    ok(swap, 'raid: "Swap tanks!" shows on the guest tank (needs the party to reach Grandmother Slag before Burnout; rerun if it wiped in the openers)');
    await ctx.close();
  }
  // 6. The Pressworks: a guest drops mid-Downstroke (the shared soak telegraph, owner -3).
  if (PRESS) {
    const { P, ctx } = await party(['bulwark', 'lumen', 'emberwright'], 'pressworks', 10);
    let dropT = -1, ticksAfter = 0, lastTick = 0;
    const r = await play(P, {
      dropWhen: async (A) => {
        const s = await world(A, 'return w.telegraphs.some((t) => t.alive && t.kind === "soak" && t.owner === -3) ? { t: w.time, tick: w.tick } : null;');
        if (s) { dropT = s.t; lastTick = s.tick; }
        return !!s;
      },
      // Guests stand still, so tier 10 trash outlasts Burnout before Oskel; trash is set to 1 hp until he's up.
      each: async (A) => { await world(A, 'if (!w.bossUp) for (const e of w.enemies) if (e.alive && e.def.rank !== "boss") e.hp = Math.min(e.hp, 1);'); if (dropT >= 0) { const tick = await world(A, 'return w.tick;'); if (tick > lastTick) ticksAfter++; lastTick = tick; } },
    });
    ok(dropT >= 0, `Pressworks: a guest dropped while a Downstroke was up (t=${dropT.toFixed(1)} s)`);
    ok(ticksAfter > 5, `Pressworks: the host's run kept ticking after the drop (${ticksAfter} samples advanced)`);
    ok(r.live.size === 2 && r.ends.every(Boolean), `Pressworks: the host and the other guest reach the end screen (${r.victory ? 'win' : 'loss'})`);
    await ctx.close();
  }
  // 7. The Hoard: a guest leaves while swallowed, or while the Craw stands with someone else inside.
  if (HOARD) {
    for (const mode of ['swallowed', 'craw']) {
      const { P, ctx } = await party(['bulwark', 'lumen', 'emberwright', 'duskblade'], 'hoard', 9);
      let who = -1, dropT = -1, finishAt = -1, theme = null;
      const r = await play(P, {
        // Guests stand still, so trash is set to 1 hp and Old Vorhulm starts in phase 2 (Swallow).
        dropWhen: async (A) => {
          const s = await world(A, `if (!w.bossUp) { for (const e of w.enemies) if (e.alive && e.def.rank !== "boss") e.hp = Math.min(e.hp, 1); return null; }
            const b = w.enemies.find((e) => e.alive && e.def.rank === "boss"); if (b && b.hp > b.maxHp * 0.59) b.hp = b.maxHp * 0.59;
            const k = [1, 2, 3].find((i) => (w.heroPlayer(i).swallowT ?? 0) > 0);
            const craw = w.enemies.some((e) => e.alive && e.kind === "craw");
            return k === undefined || !craw ? null : { k, t: w.time };`);
          if (!s) return false;
          if (theme === null) theme = await P[1].evaluate(() => window.__ember.audio.music?.theme ?? null);
          who = mode === 'swallowed' ? s.k : [1, 2, 3].find((i) => i !== s.k); dropT = s.t;
          return true;
        },
        dropWho: () => who,
        // Twenty seconds after the drop (the swallowed hero is out by then either way), he is finished off.
        each: async (A) => { if (dropT < 0) return; finishAt = await world(A, 'if (w.time > a + 20) { const b = w.enemies.find((e) => e.alive && e.def.rank === "boss"); if (b) b.hp = 1; return w.time; } return -1;', dropT); },
      });
      const inside = await world(P[0], 'return [0, 1, 2, 3].filter((i) => (w.heroPlayer(i).swallowT ?? 0) > 0);').catch(() => ['?']);
      const label = mode === 'swallowed' ? 'a guest drops while swallowed' : 'a guest drops while the Craw stands with someone else inside';
      ok(dropT >= 0, `Hoard: ${label} (guest ${who}, t=${dropT.toFixed(1)} s)`);
      ok(r.live.size === 3 && r.ends.every(Boolean), `Hoard: after that drop the other three reach the end screen (${r.victory ? 'win' : 'loss'})`);
      ok(inside.length === 0, `Hoard: nobody is left inside at the end ${JSON.stringify(inside)}`);
      ok(theme === 'hoard', `Hoard: a guest hears the Hoard theme (${theme})`);
      await ctx.close();
    }
  }
  // 8. The Smeltery: the guest the Colossus is about to Wheel onto leaves mid-cast.
  if (SMELT) {
    const { P, ctx } = await party(['bulwark', 'lumen', 'emberwright', 'duskblade'], 'smeltery', 10);
    let who = -1, dropT = -1, theme = null, step = 0; const banners = [];
    const banner = async (q) => q.evaluate(() => document.getElementById('banner').classList.contains('show') ? document.getElementById('bannerTitle').textContent : '');
    const r = await play(P, {
      // Guests stand still, so trash is set to 1 hp and the Colossus starts in phase 2 (Wheel).
      dropWhen: async (A) => {
        const s = await world(A, `if (!w.bossUp) { for (const e of w.enemies) if (e.alive && e.def.rank !== "boss") e.hp = Math.min(e.hp, 1); return null; }
          const b = w.enemies.find((e) => e.alive && e.kind === "colossus"); if (!b) return null;
          // Phase 12 W3: this case tests the Wheel, so it holds him to that version (Plate Shift casts plateShift instead).
          w.bossVariant = "wheel";
          if (b.hp > b.maxHp * 0.59) b.hp = b.maxHp * 0.59;
          if (b.castId !== "wheel") return { cast: false };
          let pick = -1, most = -1;
          for (let k = 1; k < w.heroes.length; k++) if (!w.isTank(k) && w.heroPlayer(k).hp > 0 && (w.colDmg[k] ?? 0) > most) { most = w.colDmg[k] ?? 0; pick = k; }
          return { cast: true, pick, t: w.time };`);
        if (!s) return false;
        if (theme === null) theme = await P[1].evaluate(() => window.__ember.audio.music?.theme ?? null);
        if (!step) { const t = await banner(P[1]); if (/^Phase 2/.test(t)) { banners.push(t); step = 1; } }
        if (!s.cast || s.pick < 1) return false;
        who = s.pick; dropT = s.t;
        return true;
      },
      dropWho: () => who,
      // Ten seconds after the drop he goes to Meltdown (29%), and ten after that he is finished off.
      each: async (A, P, live) => {
        if (dropT < 0) return;
        const t = await world(A, 'return w.time;');
        const watcher = [...live].find((i) => i > 0);
        if (step < 2 && t > dropT + 10) { await world(A, 'const b = w.enemies.find((e) => e.alive && e.kind === "colossus"); if (b) b.hp = Math.min(b.hp, b.maxHp * 0.29);'); step = 2; }
        else if (step === 2) { const b = await banner(P[watcher]); if (/^Phase 3/.test(b)) { banners.push(b); step = 3; } }
        if (t > dropT + 20) await world(A, 'const b = w.enemies.find((e) => e.alive && e.kind === "colossus"); if (b) b.hp = 1;');
      },
    });
    ok(dropT >= 0, `Smeltery: the guest Wheel was turning on dropped mid-cast (guest ${who}, t=${dropT.toFixed(1)} s)`);
    ok(r.live.size === 3 && r.ends.every(Boolean), `Smeltery: the other three reach the end screen (${r.victory ? 'win' : 'loss'})`);
    ok(banners.length === 2, `Smeltery: a guest saw both phase banners ${JSON.stringify(banners)}`);
    ok(theme === 'smeltery', `Smeltery: a guest hears the Smeltery theme (${theme})`);
    await ctx.close();
  }
  ok(!errs.length, `no page errors ${JSON.stringify(errs)}`);
  await b.close(); srv.close();
})();
