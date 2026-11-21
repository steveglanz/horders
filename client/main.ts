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

// Render at device resolution, capped at 2x for fill-rate; ?lowres=1 opts out.
const DPR = params.has('lowres') ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
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
  game.scene.start('game', {
    opts: hosting ? coop!.startRun(opts) : opts,
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
  game.scene.stop('game');
  el('end').hidden = true;
  hud.hideRun();
  hub.render();
  el('title').hidden = false;
});
el('quitBtn').addEventListener('click', () => {
  if (coop?.role === 'host') coop.endRun();
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

function leaveParty(note = ''): void {
  coop?.close();
  coop = null;
  coopNote = note;
  renderCoop();
}

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
  onRoster: () => renderCoop(),
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
    leaveParty(reason === 'refused' ? 'That party is full (4 heroes at most).' : 'The host left the party.');
  },
};

function renderCoop(): void {
  const box = el('coop');
  hub.render();
  if (!coop) {
    box.innerHTML = `<div class="ttl">Play together</div>
      <div class="muted">Up to four heroes in one delve. Each of you keeps your own loot.</div>
      ${coopNote ? `<div style="margin-top:6px">${coopNote}</div>` : ''}
      <div class="row2"><button id="hostBtn">Host a party</button>
      <input id="joinCode" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Party code"><button id="joinBtn">Join</button></div>`;
    el('hostBtn').addEventListener('click', () => {
      coop = CoopSession.host(myCard(), SUPABASE.url, SUPABASE.key, coopEvents);
      coopNote = '';
      renderCoop();
    });
    const join = () => {
      const code = (el('joinCode') as HTMLInputElement).value.trim().toUpperCase();
      if (code.length !== 5) return;
      coop = CoopSession.join(code, myCard(), SUPABASE.url, SUPABASE.key, coopEvents);
      coopNote = '';
      renderCoop();
    };
    el('joinBtn').addEventListener('click', join);
    el('joinCode').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if ((e as KeyboardEvent).key === 'Enter') join();
    });
    return;
  }
  const people = coop.roster.map((r) => `<li>${r.hero.name}${r.you ? ' (you)' : ''}</li>`).join('');
  const linked = coop.roster.length > 1;
  box.innerHTML = coop.role === 'host'
    ? `<div class="ttl">Your party</div><div class="muted">Share this code with friends:</div><div class="code" id="partyCode">${coop.code}</div>
       <ul>${people}</ul><div class="muted">${linked ? 'Press Delve together when everyone is in.' : 'Waiting for someone to join.'}</div>
       <div class="row2"><button id="leaveBtn">Leave party</button></div>`
    : `<div class="ttl">Party ${coop.code}</div><ul>${people}</ul>
       <div class="muted">${linked ? 'The host starts the delve.' : 'Connecting to the host...'}</div>
       <div class="row2"><button id="leaveBtn">Leave party</button></div>`;
  el('leaveBtn').addEventListener('click', () => leaveParty());
}
/** The Delve button follows the party: guests wait, a host with company delves together. */
function coopButton(): void {
  const b = el('startBtn') as HTMLButtonElement;
  b.disabled = coop?.role === 'guest';
  if (coop?.role === 'guest') b.textContent = 'Waiting for the host';
  else if (coop?.role === 'host' && coop.roster.length > 1) b.textContent = b.textContent!.replace(/^Delve/, 'Delve together');
}
const hubRender = hub.render.bind(hub);
hub.render = () => {
  hubRender();
  coopButton();
};
renderCoop();
