import { weekOf } from '../sim/content/omens';
import { keyOmens, keyTier } from '../sim/content/keys';
import { bountyFor, dayOf } from '../sim/content/bounty';
import { heatFor } from '../sim/content/heat';
import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Hud } from './ui';
import { installTips } from './tips';
import { Hub } from './hub';
import { loadHero, resetHero, saveHero } from './save';
import { metIn, recordSeen } from '../sim/seen';
import { altOn, applyRun, equippedItems, HeroProfile, newerHero, gritFor, rekeyDrops, takePotion, potionWorksIn, keyLevelOf, keysOpen, shareEmbers } from '../sim/hero';
import { DUNGEONS, raidCountsTriple } from '../sim/content/dungeon';
import { CLASSES } from '../sim/content/classes';
import { standInGear } from '../sim/content/botfill';
import { CoopSession, HeroCard } from './net/coop';
import { Lobby, LISTEN_MS, makeLobby, pickParty, roleOf, shouldMerge } from './net/lobby';
import { MAX_PARTY } from './net/party';
import { CLASS_ICON, glyph } from './icons';
import { hd2dMounted, hd2dWanted, loadHd2d, lookWanted, prefetchHd2d } from './hd2d/api';
import { display, hallsWanted, mountDisplayOptions, onDisplayChange } from './settings';
import { cloud, queueCloudSave, SUPABASE } from './cloud';
import { World, WorldOptions } from '../sim/world';
import { audio } from './audio';
import { installSoundControls } from './audio/controls';
import { hubThemeFor } from './audio/music';
import { SEASONS, seasonOf } from '../sim/content/season';

const el = (id: string) => document.getElementById(id)!;
audio.install();
installSoundControls();
// The hub plays its own theme whenever the main menu is showing.
{
  const title = document.getElementById('title')!;
  const follow = () => { if (!title.hidden) audio.theme(hubThemeFor(seasonOf(weekOf(Date.now())), SEASONS.length)); };
  new MutationObserver(follow).observe(title, { attributes: true, attributeFilter: ['hidden'] });
  follow();
}
const params = new URLSearchParams(location.search);
let stress = params.has('stress');
installTips();
const hud = new Hud();
hud.showPerf = stress || params.has('debug');
let hero: HeroProfile = loadHero();
const save = () => {
  saveHero(hero);
  queueCloudSave(() => hero);
};
hud.onGearChange = save;
hud.tipSeen = (id) => !!hero.tipsSeen?.includes(id);
hud.markTip = (id) => { if (hero.tipsSeen?.includes(id)) return; (hero.tipsSeen ??= []).push(id); save(); };
const hub = new Hub(() => hero, save);
hub.tier = hero.maxTier;
hub.render();

// Pull the cloud save (if any) and keep whichever copy has made more progress.
void (async () => {
  const loaded = await cloud.loadHero();
  // P5: a cloud save from before the shared purse folds its per-class embers in too.
  const remote = loaded && loaded.version === 1 && Array.isArray(loaded.inventory) ? shareEmbers(loaded) : loaded;
  if (remote && remote.version === 1 && Array.isArray(remote.inventory)) {
    const best = newerHero(hero, remote);
    if (best === remote && el('title').hidden === false) {
      hero = { ...hero, ...remote };
      saveHero(hero);
      hub.tier = hero.maxTier;
    } else if (best !== remote) {
      void cloud.saveHero(hero);
    }
  } else if (cloud.online) {
    void cloud.saveHero(hero);
  }
  hub.render();
  await hub.refreshBoss();
})();

// Render at device resolution, capped at 2x for fill-rate; ?lowres=1 opts out and
// ?hires=1 lifts the cap to 3x (store screenshots, tools/storeshots.cjs).
// The Battery saver graphics setting also renders at 1x. On Auto, a phone that still runs
// slow with the light effects steps the render scale down (autoScale, see lowerRes below).
let autoScale = 1;
const fullDpr = () => (params.has('lowres') || display.graphics === 'saver' ? 1
  : Math.max(1, Math.min(params.has('hires') ? 3 : 2, Math.max(1, window.devicePixelRatio || 1)) * (display.graphics === 'auto' ? autoScale : 1)));
let DPR = fullDpr();
document.documentElement.style.setProperty('--dpr', String(DPR));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#120b0a',
  // The 3D look lays this canvas's floor layer on its 3D floor (the floor bridge), which needs a see-through canvas.
  // #game paints the same dark colour behind it, so the 2D look is unchanged.
  transparent: hd2dWanted(),
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth * DPR, height: window.innerHeight * DPR, zoom: 1 / DPR },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60, limit: display.graphics === 'saver' ? 30 : 0 },
  banner: false,
});
// NONE scale mode: follow the window ourselves so the backing store stays at device resolution.
const fit = () => game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
// Display settings that live outside the scene: render scale, frame cap and button side.
const applyDisplay = () => {
  document.body.classList.toggle('lefty', display.hand === 'left');
  document.body.classList.toggle('saver', display.graphics === 'saver');
  document.body.classList.toggle('text-large', display.text === 'large');
  const next = fullDpr();
  if (next !== DPR) {
    DPR = next;
    document.documentElement.style.setProperty('--dpr', String(DPR));
    game.scale.setZoom(1 / DPR);
    fit();
  }
  const limit = display.graphics === 'saver' ? 30 : 0;
  if (game.loop.fpsLimit !== limit) game.loop.setFPSLimit(limit);
};
applyDisplay();
onDisplayChange(applyDisplay);
/**
 * The Look setting (3D or 2D) is fixed for a page load (hd2dWanted), so a new choice reloads the page, but only on the
 * main menu and outside a party (a reload would leave it). Picked mid-run or in a party, it applies on the next load.
 */
const reloadForLook = () => {
  if (lookWanted(display.look) === hd2dWanted() || el('title').hidden || coop) return;
  location.reload();
};
onDisplayChange(reloadForLook);
/**
 * L2: Graphics on Auto, and a run still under 36 fps with the light effects already on. Most
 * phones that slow are limited by pixels drawn (tools/partyperf.cjs: 18 fps at 2x against 47 at
 * 1x under software WebGL), so draw fewer: 2x, then 1.5x, then 1x. It holds for the session.
 * Returns false once there is nothing left to lower.
 */
game.registry.set('lowerRes', (): boolean => {
  if (display.graphics !== 'auto' || DPR <= 1) return false;
  autoScale = autoScale > 0.75 ? 0.75 : 0.5;
  applyDisplay();
  return DPR > 1;
});
// The hub is an opaque screen over the canvas, so nothing the game draws there can be seen.
// The game loop sleeps while it shows (tools/hubperf.cjs: the idle hub's main-thread time on a
// phone drops from about a third to the CSS embers alone) and wakes when a run takes over.
{
  const title = document.getElementById('title')!;
  const follow = () => {
    if (title.hidden) {
      if (!game.loop.running) { game.loop.resetDelta(); game.loop.wake(); }
    } else game.loop.sleep();
  };
  new MutationObserver(follow).observe(title, { attributes: true, attributeFilter: ['hidden'] });
  // Phaser starts its loop after boot, so the first check waits for its first frame.
  game.events.once('poststep', follow);
}

function seed(): number {
  const s = params.get('seed');
  return s ? Number(s) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
}

let runSeed = 0;
let runApplied = true;
let lastBounty = false;
let lastKey = false;

/** Banks a finished (or abandoned) run into the saved hero, once. */
function finishRun(w: World) {
  if (runApplied || w.stress) return undefined;
  runApplied = true;
  let summary = w.summary();
  let drops = w.runDrops;
  let equipped = w.runEquipped;
  if (coop?.role === 'guest') {
    // Drops carry the host's item ids: give them ours. And a delve the host
    // chose above your own ladder unlocks at most your next tier.
    ({ drops, equipped } = rekeyDrops(hero, drops, equipped));
    summary = { ...summary, tier: Math.min(summary.tier ?? 1, hero.maxTier) };
  }
  const topBefore = hero.maxTier;
  const rewards = applyRun(hero, runSeed, summary, w.eliteKilled, drops, equipped);
  // A win that opens the next tier moves the delve up to it, when you were on your top tier (a playtester's new player
  // replayed tier 1 five times: the tier was only picked at page load). A lower tier you chose to replay stays picked.
  if (hero.maxTier > topBefore && hub.tier === topBefore) hub.tier = hero.maxTier;
  // Phase 15 Y4: what this delve met goes in the Seen log; the end screen marks the first meetings.
  rewards.seenNew = recordSeen(hero, metIn(w));
  save();
  hub.render();
  // P3: a beaten key goes on the dungeon's leaderboard (solo key runs only).
  if (summary.victory && summary.keyLevel && summary.dungeon && !coop) void submitKey(summary.dungeon, summary.keyLevel, summary.time);
  // R7: a won daily bounty goes on that day's board for its tier (solo runs only).
  if (summary.victory && summary.bounty !== undefined && summary.dungeon && !coop) void submitBounty(summary.bounty, summary.tier ?? 1, summary.dungeon, summary.time);
  const shadow = summary.shadowDamage ?? 0;
  if (raidCountsTriple(summary.dungeon, hub.boss?.name)) {
    void strikeBoss(summary.damageDealt - shadow, summary.time - (summary.shadowTime ?? 0), shadow, summary.shadowTime ?? 0);
  } else {
    // W3: this raid's boss isn't the live world boss, so its hits count once, as ordinary delve damage.
    void strikeBoss(summary.damageDealt, summary.time, 0, 0, DUNGEONS[summary.dungeon!].worldBoss);
  }
  return rewards;
}

/** Records a daily bounty win's time on that day's board (solo runs only). */
async function submitBounty(day: number, tier: number, dungeon: string, seconds: number): Promise<void> {
  const r = await cloud.submitBounty(day, tier, dungeon, hero.cls ?? 'emberwright', seconds, myCard().name);
  if (r?.ok) hub.bountyBoardStale();
}

/** Records a timed key clear on the Delver's Keys leaderboard (solo runs only). */
async function submitKey(dungeon: string, level: number, seconds: number): Promise<void> {
  const r = await cloud.submitKey(dungeon, hero.cls ?? 'emberwright', level, seconds, weekOf(Date.now()), myCard().name);
  if (r?.ok) hub.keyBoardStale(dungeon);
}

/** Sends a finished delve's damage to the shared world boss. */
async function strikeBoss(damage: number, seconds: number, shadowDamage: number, shadowSeconds: number, offBoss?: string): Promise<void> {
  const out = el('endBoss');
  out.innerHTML = '';
  if (damage + shadowDamage <= 0) return;
  const r = await cloud.strike(damage, seconds, shadowDamage, shadowSeconds);
  const card = (right: string, body: string) => `<div class="top"><b>World boss</b><span>${right}</span></div>${body}`;
  if (!r) {
    out.innerHTML = cloud.online === false ? card('Offline', 'This delve only counted locally.') : '';
  } else if (r.ok) {
    out.innerHTML = r.defeated
      ? card('Killing blow!', `<b style="color:var(--gold)">Your delve felled ${r.name}!</b> Claim your reward from the main menu.`)
      : card(`−${(r.dealt ?? 0).toLocaleString()}`, `<div class="meter danger"><div style="width:${Math.max(0, Math.min(100, (100 * r.hp) / r.max_hp))}%"></div></div>`
        + `<div style="margin-top:6px">Your delve struck <b>${r.name}</b>${r.shadow ? ` (${r.shadow.toLocaleString()} from the shadow fight or the raid, counted triple)` : ''}. It has ${r.hp.toLocaleString()} health left.</div>`
        + (offBoss ? `<div class="muted" style="margin-top:4px">${offBoss} isn't the world boss this week, so the raid's hits counted once, not triple.</div>` : ''));
  } else if (r.reason === 'too_soon') {
    out.innerHTML = card('Recovering', 'The world boss is recovering. Your next delve can strike it again.');
  }
  await hub.refreshBoss();
}

function startRun(bounty = false, key = false): void {
  // In someone else's party, the host starts the delves.
  if (coop?.role === 'guest') return;
  // A group dungeon needs a party (the hub shows why and disables Delve).
  if (!bounty && !stress && hub.partyBlocker()) return;
  if (game.scene.getScene('game')) game.scene.stop('game');
  runSeed = seed();
  hub.bossNote = "";
  runApplied = false;
  const opts: WorldOptions = {
    seed: runSeed,
    stress,
    invulnerable: params.has('god'),
    gear: equippedItems(hero),
    passives: hero.passives,
    heroLevel: hero.level,
    nextItemId: hero.nextItemId,
    tier: hub.tier,
    week: weekOf(Date.now()),
    day: dayOf(Date.now()),
    dungeon: hub.dungeon,
    grit: gritFor(hero, hub.dungeon, hub.tier),
    firstClear: hub.tier >= hero.maxTier,
    // L1: this character's first delve gets the teaching route (the sim checks Kiln, tier 1, solo).
    firstDelve: !stress && (hero.runs ?? 0) === 0,
    cls: hero.cls ?? 'emberwright',
    stance: hero.stance,
    alt: altOn(hero),
    // Only offer the shadow fight when the world boss is actually reachable.
    worldBoss: cloud.online && hub.boss ? hub.boss.name : undefined,
    bossOmen: hub.bossOmen(),
  };
  // A brewed potion goes into this delve and is used up (the bounty never takes one).
  // A Rising Draught stays brewed through a group dungeon, where it does nothing (potionWorksIn).
  if (!bounty && !stress && hero.potion && potionWorksIn(hero.potion, opts.dungeon)) {
    opts.potion = takePotion(hero);
    save();
  }
  if (bounty) {
    // Same fights, spawns and twist for everyone today; only the tier is the hero's own.
    const b = bountyFor(dayOf(Date.now()), hero.maxTier);
    runSeed = b.seed;
    Object.assign(opts, { seed: b.seed, tier: b.tier, dungeon: b.dungeon, route: [...b.route], omens: [b.twist], bounty: b.day, grit: 0 });
  }
  // P3: a Delver's Key run, solo only: the key's tier, Omens and level for the picked dungeon.
  key = key && !bounty && !stress && keysOpen(hero) && DUNGEONS[hub.dungeon].style === 'solo' && !(coop && coop.roster.length > 1);
  if (key) {
    const level = keyLevelOf(hero, hub.dungeon);
    const tier = keyTier(hero.maxTier);
    Object.assign(opts, { tier, omens: keyOmens(tier, weekOf(Date.now()), level), keyLevel: level, grit: 0, firstClear: false });
  }
  // V4 / Phase 14 X1: today's Heat in the picked dungeon; the sim keeps it only in a solo dungeon, and never for a bounty or key run.
  if (!bounty && !key) opts.heat = heatFor(dayOf(Date.now()), hub.dungeon);
  lastBounty = bounty;
  lastKey = key;
  const hosting = coop?.role === 'host' && coop.roster.length > 1 && !stress;
  // ?botparty=bulwark,lumen,duskblade: bot allies in a local party, for performance checks (tools/partyperf.cjs).
  const botParty = params.get('botparty')?.split(',').filter((c): c is keyof typeof CLASSES => c in CLASSES).slice(0, 3);
  // They are bots, so they count as a bot fill: the same loot limits, and no party quest.
  if (!hosting && botParty?.length) Object.assign(opts, { party: botParty.map((cls) => ({ cls })), partySize: 1 + botParty.length, fillBots: botParty.length });
  // Fill with bots (sim/content/botfill): bot allies in stand-in copies of this hero's gear.
  // V7: an online party's host can fill too (up to BOT_FILL.partySize); guests never start runs.
  const fill = !botParty?.length && !bounty && !stress && (hosting || !(coop && coop.roster.length > 1)) ? hub.fillParty() : [];
  if (fill.length) {
    const gear = standInGear(equippedItems(hero));
    Object.assign(opts, { party: fill.map((cls) => ({ cls, name: `${CLASSES[cls].name} (bot)`, gear, passives: hero.passives })), partySize: 1 + fill.length, fillBots: fill.length });
  }
  // Phase 18 Halls: the default wherever a dungeon has a map (hallsFor). H4: the map now reaches guests (netsync's
  // Snapshot.halls), but hosted online co-op only plays it with ?hallsbeta=1 until QA has played it there.
  if (hallsWanted() && !stress && (!hosting || params.get('hallsbeta') === '1')) {
    opts.halls = true;
    // H2c: ?hallsmap=a plays H1's hand-made map instead of the generated one (for comparing).
    if (new URLSearchParams(location.search).get('hallsmap') === 'a') opts.hallsTemplate = true;
    // H3: ?hallsbeta=1 also maps the dungeons whose Halls aren't on for players yet (HALLS_BETA).
    if (new URLSearchParams(location.search).get('hallsbeta') === '1') opts.hallsBeta = true;
  }
  // BOSSV2 (design 25 Nov; Steve okayed it 25 Nov 06:41Z): the three-stage Kiln Mother and the new Gorge, on by default
  // in local play (the first delve keeps the old fight, in World). Hosted online co-op keeps today's fight until QA
  // has played it there (design, 25 Nov), so a host opts in with ?bossv2=1; ?bossv2=0 turns it off for comparing.
  if (hosting ? params.get('bossv2') === '1' : params.get('bossv2') !== '0') opts.bossV2 = true;
  // ONDRELV2 (design, 25 Nov): the staged Ondrel, off until design has measured it, so solo and host both opt in.
  if (params.get('ondrelv2') === '1') opts.ondrelV2 = true;
  const runOpts = hosting ? coop!.startRun(opts) : opts;
  syncLobby();
  game.scene.start('game', {
    opts: runOpts,
    hud,
    glow: hero.wear?.glow,
    trail: wornTrail(hero),
    coop: hosting ? coop! : undefined,
    onEnd: (w: World) => {
      const rewards = finishRun(w);
      hud.showEnd(w, rewards, hero);
      audio.rewards(rewards);
    },
  });
}

game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.add('game', GameScene, false);
  if (stress) startRun();
  // HD-2D look test: fetch the 3D file quietly once the title is up, so Delve waits less.
  prefetchHd2d();
});

el('startBtn').addEventListener('click', () => {
  stress = params.has('stress');
  hud.showPerf = stress || params.has('debug');
  // HD-2D look test: the 3D file loads the first time you press Delve (a short loading screen), never before.
  if (hd2dWanted() && !hd2dMounted()) { void loadHd2d(DUNGEONS[hub.dungeon]?.name).then(() => startRun()); return; }
  startRun();
});
el('stressLink').addEventListener('click', (e) => {
  e.preventDefault();
  stress = true;
  hud.showPerf = true;
  startRun();
});
// Reset wipes the hero for good, so it takes a second tap within a few seconds.
let resetArmed: ReturnType<typeof setTimeout> | null = null;
el('resetBtn').addEventListener('click', () => {
  const btn = el('resetBtn');
  if (!resetArmed) {
    btn.textContent = 'Tap again to erase your hero';
    resetArmed = setTimeout(() => { resetArmed = null; btn.textContent = 'Reset hero'; }, 4000);
    return;
  }
  clearTimeout(resetArmed);
  resetArmed = null;
  btn.textContent = 'Reset hero';
  hero = resetHero();
  hub.tier = 1;
  save();
  hub.render();
});
el('againBtn').addEventListener('click', () => startRun(lastBounty, lastKey));
// A claimed world boss reward is an Epic: the hub's biggest chime (it respects mute like every sound).
hub.onClaimed = () => audio.play('bossClaim');
hub.onBounty = () => {
  stress = false;
  startRun(true);
};
hub.onKey = () => {
  stress = false;
  startRun(false, true);
};
el('menuBtn').addEventListener('click', () => {
  if (coop?.role === 'host') coop.endRun();
  syncLobby();
  game.scene.stop('game');
  el('end').hidden = true;
  hud.hideRun();
  hub.render();
  el('title').hidden = false;
  reloadForLook();
});
el('quitBtn').addEventListener('click', () => {
  if (coop?.role === 'host') coop.endRun();
  syncLobby();
  // Leaving early still keeps the loot and experience earned so far.
  const scene = game.scene.getScene('game') as GameScene | null;
  if (scene?.world) finishRun(scene.world);
  game.scene.stop('game');
  el('pause').hidden = true;
  hud.hideRun();
  el('title').hidden = false;
  reloadForLook();
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!el('title').hidden && el('bag').hidden) startRun();
  // Enter on the end screen is "Delve again": the same kind of run (a key or bounty run repeats as one).
  else if (!el('end').hidden) startRun(lastBounty, lastKey);
});

// Pause automatically when the tab or app goes to the background.
document.addEventListener('visibilitychange', () => {
  const scene = game.scene.getScene('game') as GameScene | null;
  if (document.hidden && scene && game.scene.isActive('game')) scene.togglePause(true);
});

mountDisplayOptions(el('pauseOpts'));
mountDisplayOptions(el('hubOpts'));

// Hook for automated checks.
(window as unknown as { __ember: unknown }).__ember = {
  scene: () => game.scene.getScene('game') as GameScene | null,
  hero: () => hero,
  hub: () => hub,
  audio,
  /** For tools/cooprejoincheck.cjs: the co-op session, to cut its link. */
  coop: () => coop,
};

// ------------------------------------------------------------------ co-op

let coop: CoopSession | null = null;
let coopNote = '';

/** The season trail this hero wears and the stage earned, for the party to see. */
function wornTrail(h: HeroProfile): HeroCard['trail'] {
  const id = h.wear?.trail;
  const stage = id ? h.trails?.[id] ?? 0 : 0;
  return id && stage >= 1 ? { id, stage } : undefined;
}

function myCard(): HeroCard {
  const cls = hero.cls ?? 'emberwright';
  return { name: `${CLASSES[cls].name} ${hero.level}`, cls, stance: cls === 'slagbinder' ? hero.stance : undefined, alt: altOn(hero), level: hero.level, gear: equippedItems(hero), passives: { ...hero.passives }, title: hero.wear?.title, glow: hero.wear?.glow, trail: wornTrail(hero), potion: hero.potion, pid: playerId() };
}

/** This device's player id, kept in storage so a dropped guest can rejoin their delve (CoopSession.resume). */
let pidCache = '';
function playerId(): string {
  if (pidCache) return pidCache;
  const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);
  try {
    const kept = localStorage.getItem(PID_KEY);
    pidCache = kept && /^[a-z0-9]{8,16}$/.test(kept) ? kept : fresh();
    localStorage.setItem(PID_KEY, pidCache);
  } catch {
    pidCache = fresh(); // private mode: one id for this visit
  }
  return pidCache;
}
const PID_KEY = 'horders.pid';

/**
 * A guest whose link to the host drops mid-delve tries to rejoin the same party a
 * few times before giving up; the host hands their hero back (CoopSession.resume).
 */
const REJOIN_TRIES = 3;
const REJOIN_WAIT_MS = 8000;
let rejoin: { code: string; tries: number; timer: number } | null = null;

function tryRejoin(code: string): void {
  coop?.close();
  coop = null;
  rejoin ??= { code, tries: 0, timer: 0 };
  clearTimeout(rejoin.timer);
  if (rejoin.tries >= REJOIN_TRIES) { giveUpRejoin(); return; }
  rejoin.tries++;
  hud.banner('Connection lost', `Reconnecting to the party (${rejoin.tries} of ${REJOIN_TRIES})`);
  coop = CoopSession.join(code, myCard(), SUPABASE.url, SUPABASE.key, coopEvents);
  rejoin.timer = window.setTimeout(() => tryRejoin(code), REJOIN_WAIT_MS);
}

/** Snapshots come several times a second; this long without one mid-delve means the host is gone or cut off. */
const HOST_QUIET_MS = 10000;
window.setInterval(() => {
  if (coop?.role !== 'guest' || rejoin || coop.quietMs < HOST_QUIET_MS) return;
  const scene = game.scene.getScene('game') as GameScene | null;
  if (scene?.world && game.scene.isActive('game') && scene.world.state !== 'ended') coopEvents.onEnded('hostLeft');
}, 1000);

function giveUpRejoin(): void {
  if (rejoin) clearTimeout(rejoin.timer);
  rejoin = null;
  const scene = game.scene.getScene('game') as GameScene | null;
  if (scene?.world && game.scene.isActive('game') && scene.world.state !== 'ended') {
    finishRun(scene.world);
    backToMenu();
  }
  leaveParty('Lost the connection to the party.');
}

/** Party size at the last roster update, for the join and leave chimes. */
let rosterSize = 0;

function leaveParty(note = ''): void {
  if (rejoin) { clearTimeout(rejoin.timer); rejoin = null; }
  rosterSize = 0;
  coop?.close();
  coop = null;
  coopNote = note;
  coopOpen = false;
  coopQuick = false;
  syncLobby();
  renderCoop();
}

// Quick join: open parties advertise in a shared lobby (client/net/lobby.ts).
/** The host's party shows up for Quick join. */
let coopOpen = false;
/** This party came from Quick join, so it may fold into another lone open party. */
let coopQuick = false;
let lobby: Lobby | null = null;
let seeking = false;

/** Advertise the host's party while it is open, between delves and not full; otherwise drop the ad. */
function syncLobby(): void {
  const advertising = coop?.role === 'host' && coopOpen;
  if (!advertising) {
    if (lobby && !seeking) {
      lobby.close();
      lobby = null;
    }
    return;
  }
  if (!lobby) {
    lobby = makeLobby(SUPABASE.url, SUPABASE.key);
    lobby.onChange = foldLoneParty;
    lobby.ready.catch(() => {
      coopNote = 'Quick join is unreachable right now. Friends can still join with your code.';
      renderCoop();
    });
  }
  const n = coop!.roster.length;
  lobby.advertise(!coop!.running && n < MAX_PARTY ? { code: coop!.code, n, max: MAX_PARTY, name: coop!.mine.name, roles: coop!.roster.map((r) => roleOf(CLASSES[r.hero.cls].role, r.hero.stance)) } : null);
}

/** Two quick-join players who both found nothing each opened a party: the one with the larger code joins the other. */
function foldLoneParty(): void {
  if (!lobby || !coop || coop.role !== 'host' || !coopQuick || coop.running || coop.roster.length !== 1) return;
  const into = shouldMerge({ code: coop.code, n: 1, max: MAX_PARTY, name: '' }, lobby.list());
  if (!into) return;
  coop.close();
  coopOpen = false;
  audio.play('matchFound');
  joinParty(into.code, `Joined ${into.name}'s party.`);
  coopQuick = true;
  syncLobby();
}

function joinParty(code: string, note = ''): void {
  coop = CoopSession.join(code, myCard(), SUPABASE.url, SUPABASE.key, coopEvents);
  coopNote = note;
  renderCoop();
}

/** Join the best open party with a free spot; if there is none, open one for the next player. */
async function quickJoin(skip: string[] = []): Promise<void> {
  if (seeking || coop) return;
  seeking = true;
  coopNote = 'Looking for an open party...';
  renderCoop();
  const l = lobby ?? makeLobby(SUPABASE.url, SUPABASE.key);
  lobby = l;
  try {
    await l.ready;
    await new Promise((r) => setTimeout(r, LISTEN_MS));
  } catch {
    seeking = false;
    l.close();
    lobby = null;
    coopNote = 'Quick join is unreachable right now. Try a party code instead.';
    renderCoop();
    return;
  }
  seeking = false;
  if (coop) return;
  const pick = pickParty(l.list().filter((a) => !skip.includes(a.code)), undefined, roleOf(CLASSES[myCard().cls].role, myCard().stance));
  quickSkip = skip;
  if (pick) {
    coopQuick = true;
    audio.play('matchFound');
    joinParty(pick.code, `Joined ${pick.name}'s party.`);
    syncLobby();
    return;
  }
  coop = CoopSession.host(myCard(), SUPABASE.url, SUPABASE.key, coopEvents);
  coopOpen = true;
  coopQuick = true;
  coopNote = 'No open party yet, so yours is open. The next player to press Quick join lands here.';
  lobby.onChange = foldLoneParty;
  syncLobby();
  renderCoop();
}
/** Codes a quick join already found full, so a retry skips them. */
let quickSkip: string[] = [];

function backToMenu(): void {
  game.scene.stop('game');
  el('end').hidden = true;
  el('pause').hidden = true;
  el('draft').hidden = true;
  hud.hideRun();
  hub.render();
  el('title').hidden = false;
}

const coopEvents = {
  onRoster: () => {
    // A chime when someone joins or leaves your party (not for your own arrival).
    const n = coop?.roster.length ?? 0;
    if (rosterSize && n > rosterSize) audio.play('partyJoin');
    else if (rosterSize && n && n < rosterSize) audio.play('partyLeave');
    rosterSize = n;
    renderCoop();
  },
  onStart: (opts: WorldOptions, me: number) => {
    if (rejoin) { clearTimeout(rejoin.timer); rejoin = null; }
    if (game.scene.getScene('game')) game.scene.stop('game');
    el('end').hidden = true;
    el('title').hidden = true;
    runSeed = opts.seed;
    runApplied = false;
    lastBounty = false;
    lastKey = false;
    // A guest's brewed potion went into this delve with their card, so it is used up here (never by a bounty).
    if (opts.bounty === undefined && hero.potion && opts.party?.[me - 1]?.potion === hero.potion && potionWorksIn(hero.potion, opts.dungeon)) {
      takePotion(hero);
      save();
    }
    game.scene.start('game', {
      opts,
      hud,
      glow: hero.wear?.glow,
      trail: wornTrail(hero),
      coop: coop!,
      onEnd: (w: World) => {
        const rewards = finishRun(w);
        hud.showEnd(w, rewards, hero);
        audio.rewards(rewards);
      },
    });
  },
  onEnded: (reason: 'menu' | 'hostLeft' | 'hostClosed' | 'refused') => {
    if (reason === 'menu') {
      if (!el('end').hidden || game.scene.isActive('game')) {
        const scene = game.scene.getScene('game') as GameScene | null;
        if (scene?.world && scene.world.state !== 'ended') finishRun(scene.world);
        backToMenu();
      }
      return;
    }
    const scene = game.scene.getScene('game') as GameScene | null;
    const midDelve = !!scene?.world && game.scene.isActive('game') && scene.world.state !== 'ended';
    // Mid-delve, a lost host link (or a refused rejoin) is first retried: the host keeps our hero.
    if (coop?.role === 'guest' && reason !== 'hostClosed' && (rejoin || (reason === 'hostLeft' && midDelve))) {
      tryRejoin(coop.code);
      return;
    }
    if (midDelve) {
      finishRun(scene!.world);
      backToMenu();
    }
    const was = coop;
    const quick = coopQuick && was?.role === 'guest';
    leaveParty(reason === 'refused' ? 'That party is full (4 heroes at most).' : 'The host left the party.');
    // Quick join lost a race for the last spot: look again, skipping that party.
    if (quick && reason === 'refused' && was) void quickJoin([...quickSkip, was.code]);
  },
};

/** Hero names arrive from other players over the network, so never trust them as HTML. */
function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function renderCoop(): void {
  const box = el('coop');
  hub.render();
  if (!coop) {
    box.innerHTML = `<div class="top"><b class="ttl">Play together</b><span class="muted">Up to ${MAX_PARTY} heroes</span></div>
      <div class="muted">One delve, shared fights. Each of you keeps your own loot.</div>
      ${coopNote ? `<div class="cnote">${coopNote}</div>` : ''}
      <div class="row2"><button id="quickBtn" class="quick">${glyph('M13 2 4 14h7l-1 8 9-12h-7Z', 16)}Quick join</button><button id="hostBtn" class="sbtn">Host a party</button></div>
      <div class="row2 joinrow">
      <input id="joinCode" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Party code"><button id="joinBtn" class="sbtn">Join</button></div>`;
    (el('quickBtn') as HTMLButtonElement).disabled = seeking;
    el('quickBtn').addEventListener('click', () => void quickJoin());
    el('hostBtn').addEventListener('click', () => {
      if (seeking) return;
      coop = CoopSession.host(myCard(), SUPABASE.url, SUPABASE.key, coopEvents);
      coopNote = '';
      renderCoop();
    });
    const join = () => {
      const code = (el('joinCode') as HTMLInputElement).value.trim().toUpperCase();
      if (code.length !== 5 || seeking) return;
      coopQuick = false;
      joinParty(code);
    };
    el('joinBtn').addEventListener('click', join);
    el('joinCode').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if ((e as KeyboardEvent).key === 'Enter') join();
    });
    return;
  }
  // Seats: one per hero (an <li>, which the co-op checks count), then the open seats.
  const roster = coop.roster;
  const seat = (r: (typeof roster)[number]): string => {
    const ic = CLASS_ICON[r.hero.cls] ?? CLASS_ICON.emberwright;
    return `<li class="seat" style="--gc:${ic.color}"><span class="gtile">${glyph(ic.d, 20)}</span><b>${esc(r.hero.name)}</b>${r.you ? '<span class="you">(you)</span>' : ''}</li>`;
  };
  const open = Array.from({ length: Math.max(0, MAX_PARTY - roster.length) }, () => '<div class="seat empty"><span class="gtile">+</span><span>Open seat</span></div>').join('');
  const seats = `<div class="seats"><ul>${roster.map(seat).join('')}</ul>${open}</div>`;
  const linked = roster.length > 1;
  box.innerHTML = coop.role === 'host'
    ? `<div class="top"><b class="ttl">Your party</b><span class="muted">${roster.length} of ${MAX_PARTY}</span></div>
       <div class="codechip"><span class="muted">Party code</span><b class="code" id="partyCode">${coop.code}</b></div>
       ${seats}<div class="muted">${linked ? 'Press Delve together when everyone is in.' : 'Share the code, or open the party to anyone.'}</div>
       <label class="open"><input type="checkbox" id="openBox"${coopOpen ? ' checked' : ''}> Open to anyone (Quick join)</label>
       ${coopNote ? `<div class="cnote">${coopNote}</div>` : ''}
       <div class="row2"><button id="leaveBtn" class="sbtn danger">Leave party</button></div>`
    : `<div class="top"><b class="ttl">Party ${coop.code}</b><span class="muted">${roster.length} of ${MAX_PARTY}</span></div>
       ${seats}<div class="muted">${linked ? 'The host starts the delve.' : 'Connecting to the host...'}</div>
       ${coopNote ? `<div class="cnote">${coopNote}</div>` : ''}
       <div class="row2"><button id="leaveBtn" class="sbtn danger">Leave party</button></div>`;
  el('leaveBtn').addEventListener('click', () => leaveParty());
  el('openBox')?.addEventListener('change', (e) => {
    coopOpen = (e.target as HTMLInputElement).checked;
    if (!coopOpen) coopQuick = false;
    syncLobby();
  });
  syncLobby();
}
/** The Delve button follows the party: guests wait, a host with company delves together. */
function coopButton(): void {
  const b = el('startBtn') as HTMLButtonElement;
  b.disabled = coop?.role === 'guest' || !!hub.partyBlocker();
  if (coop?.role === 'guest') b.textContent = 'Waiting for the host';
  else if (coop?.role === 'host' && coop.roster.length > 1) b.textContent = b.textContent!.replace(/^Delve/, 'Delve together');
  // The end screen's "Delve again" did nothing for a guest: only the host starts delves.
  const again = el('againBtn') as HTMLButtonElement;
  again.disabled = coop?.role === 'guest';
  again.textContent = coop?.role === 'guest' ? 'Waiting for the host' : 'Delve again';
}
const hubRender = hub.render.bind(hub);
hub.render = () => {
  // Group dungeons need the party's classes for their labels and the party-size check.
  hub.partyClasses = coop && coop.roster.length > 1 ? coop.roster.map((r) => r.hero.cls) : [];
  hub.partyStances = coop && coop.roster.length > 1 ? coop.roster.map((r) => r.hero.stance) : [];
  hub.hosting = !!coop && coop.role === 'host' && coop.roster.length > 1;
  hubRender();
  coopButton();
  // The hero may have changed (gear, a level, a brewed potion): the host starts the next delve with this card.
  coop?.updateMine(myCard());
};
renderCoop();
