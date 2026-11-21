import { weekOf } from '../sim/content/omens';
import { bountyFor, dayOf } from '../sim/content/bounty';
import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Hud } from './ui';
import { Hub } from './hub';
import { loadHero, resetHero, saveHero } from './save';
import { applyRun, equippedItems, HeroProfile, newerHero, gritFor, rekeyDrops, takePotion } from '../sim/hero';
import { CLASSES } from '../sim/content/classes';
import { CoopSession, HeroCard } from './net/coop';
import { Lobby, LISTEN_MS, makeLobby, pickParty, roleOf, shouldMerge } from './net/lobby';
import { MAX_PARTY } from './net/party';
import { CLASS_ICON, glyph } from './icons';
import { mountDisplayOptions } from './settings';
import { cloud, queueCloudSave, SUPABASE } from './cloud';
import { World, WorldOptions } from '../sim/world';
import { audio } from './audio';
import { installSoundControls } from './audio/controls';

const el = (id: string) => document.getElementById(id)!;
audio.install();
installSoundControls();
// The hub plays its own theme whenever the main menu is showing.
{
  const title = document.getElementById('title')!;
  const follow = () => { if (!title.hidden) audio.theme('hub'); };
  new MutationObserver(follow).observe(title, { attributes: true, attributeFilter: ['hidden'] });
  follow();
}
const params = new URLSearchParams(location.search);
let stress = params.has('stress');
const hud = new Hud();
hud.showPerf = stress || params.has('debug');
let hero: HeroProfile = loadHero();
const save = () => {
  saveHero(hero);
  queueCloudSave(() => hero);
};
const hub = new Hub(() => hero, save);
hub.tier = hero.maxTier;
hub.render();

// Pull the cloud save (if any) and keep whichever copy has made more progress.
void (async () => {
  const remote = await cloud.loadHero();
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
const DPR = params.has('lowres') ? 1 : Math.min(params.has('hires') ? 3 : 2, Math.max(1, window.devicePixelRatio || 1));
document.documentElement.style.setProperty('--dpr', String(DPR));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#120b0a',
  scale: { mode: Phaser.Scale.NONE, width: window.innerWidth * DPR, height: window.innerHeight * DPR, zoom: 1 / DPR },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  banner: false,
});
// NONE scale mode: follow the window ourselves so the backing store stays at device resolution.
const fit = () => game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);

function seed(): number {
  const s = params.get('seed');
  return s ? Number(s) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
}

let runSeed = 0;
let runApplied = true;
let lastBounty = false;

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
  const rewards = applyRun(hero, runSeed, summary, w.eliteKilled, drops, equipped);
  save();
  hub.render();
  const shadow = summary.shadowDamage ?? 0;
  void strikeBoss(summary.damageDealt - shadow, summary.time - (summary.shadowTime ?? 0), shadow, summary.shadowTime ?? 0);
  return rewards;
}

/** Sends a finished delve's damage to the shared world boss. */
async function strikeBoss(damage: number, seconds: number, shadowDamage: number, shadowSeconds: number): Promise<void> {
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
        + `<div style="margin-top:6px">Your delve struck <b>${r.name}</b>${r.shadow ? ` (${r.shadow.toLocaleString()} from the shadow fight, counted triple)` : ''}. It has ${r.hp.toLocaleString()} health left.</div>`);
  } else if (r.reason === 'too_soon') {
    out.innerHTML = card('Recovering', 'The world boss is recovering. Your next delve can strike it again.');
  }
  await hub.refreshBoss();
}

function startRun(bounty = false): void {
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
    dungeon: hub.dungeon,
    grit: gritFor(hero, hub.dungeon, hub.tier),
    firstClear: hub.tier >= hero.maxTier,
    cls: hero.cls ?? 'emberwright',
    // Only offer the shadow fight when the world boss is actually reachable.
    worldBoss: cloud.online && hub.boss ? hub.boss.name : undefined,
    bossOmen: hub.bossOmen(),
  };
  // A brewed potion goes into this delve and is used up (the bounty never takes one).
  if (!bounty && !stress && hero.potion) {
    opts.potion = takePotion(hero);
    save();
  }
  if (bounty) {
    // Same fights, spawns and twist for everyone today; only the tier is the hero's own.
    const b = bountyFor(dayOf(Date.now()), hero.maxTier);
    runSeed = b.seed;
    Object.assign(opts, { seed: b.seed, tier: b.tier, dungeon: b.dungeon, route: [...b.route], omens: [b.twist], bounty: b.day, grit: 0 });
  }
  lastBounty = bounty;
  const hosting = coop?.role === 'host' && coop.roster.length > 1 && !stress;
  // ?botparty=bulwark,lumen,duskblade: bot allies in a local party, for performance checks (tools/partyperf.cjs).
  const botParty = params.get('botparty')?.split(',').filter((c): c is keyof typeof CLASSES => c in CLASSES).slice(0, 3);
  if (!hosting && botParty?.length) Object.assign(opts, { party: botParty.map((cls) => ({ cls })), partySize: 1 + botParty.length });
  const runOpts = hosting ? coop!.startRun(opts) : opts;
  syncLobby();
  game.scene.start('game', {
    opts: runOpts,
    hud,
    coop: hosting ? coop! : undefined,
    onEnd: (w: World) => {
      const rewards = finishRun(w);
      hud.showEnd(w, rewards, hero);
    },
  });
}

game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.add('game', GameScene, false);
  if (stress) startRun();
});

el('startBtn').addEventListener('click', () => {
  stress = params.has('stress');
  hud.showPerf = stress || params.has('debug');
  startRun();
});
el('stressLink').addEventListener('click', (e) => {
  e.preventDefault();
  stress = true;
  hud.showPerf = true;
  startRun();
});
el('resetBtn').addEventListener('click', () => {
  hero = resetHero();
  hub.tier = 1;
  save();
  hub.render();
});
el('againBtn').addEventListener('click', () => startRun(lastBounty));
hub.onBounty = () => {
  stress = false;
  startRun(true);
};
el('menuBtn').addEventListener('click', () => {
  if (coop?.role === 'host') coop.endRun();
  syncLobby();
  game.scene.stop('game');
  el('end').hidden = true;
  hud.hideRun();
  hub.render();
  el('title').hidden = false;
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
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (!el('title').hidden && el('bag').hidden) startRun();
  else if (!el('end').hidden) startRun();
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
  audio,
};

// ------------------------------------------------------------------ co-op

let coop: CoopSession | null = null;
let coopNote = '';

function myCard(): HeroCard {
  const cls = hero.cls ?? 'emberwright';
  return { name: `${CLASSES[cls].name} ${hero.level}`, cls, level: hero.level, gear: equippedItems(hero), passives: { ...hero.passives } };
}

/** Party size at the last roster update, for the join and leave chimes. */
let rosterSize = 0;

function leaveParty(note = ''): void {
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
  lobby.advertise(!coop!.running && n < MAX_PARTY ? { code: coop!.code, n, max: MAX_PARTY, name: coop!.mine.name, roles: coop!.roster.map((r) => roleOf(CLASSES[r.hero.cls].role)) } : null);
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
  const pick = pickParty(l.list().filter((a) => !skip.includes(a.code)), undefined, roleOf(CLASSES[myCard().cls].role));
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
    if (game.scene.getScene('game')) game.scene.stop('game');
    el('end').hidden = true;
    el('title').hidden = true;
    runSeed = opts.seed;
    runApplied = false;
    lastBounty = false;
    game.scene.start('game', {
      opts,
      hud,
      coop: coop!,
      onEnd: (w: World) => {
        const rewards = finishRun(w);
        hud.showEnd(w, rewards, hero);
      },
    });
    void me;
  },
  onEnded: (reason: 'menu' | 'hostLeft' | 'refused') => {
    if (reason === 'menu') {
      if (!el('end').hidden || game.scene.isActive('game')) {
        const scene = game.scene.getScene('game') as GameScene | null;
        if (scene?.world && scene.world.state !== 'ended') finishRun(scene.world);
        backToMenu();
      }
      return;
    }
    const scene = game.scene.getScene('game') as GameScene | null;
    if (scene?.world && game.scene.isActive('game') && scene.world.state !== 'ended') {
      finishRun(scene.world);
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
  hubRender();
  coopButton();
};
renderCoop();
