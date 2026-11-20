import { weekOf } from '../sim/content/omens';
import { bountyFor, dayOf } from '../sim/content/bounty';
import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { Hud } from './ui';
import { Hub } from './hub';
import { loadHero, resetHero, saveHero } from './save';
import { applyRun, equippedItems, HeroProfile, newerHero, gritFor } from '../sim/hero';
import { cloud, queueCloudSave } from './cloud';
import { World, WorldOptions } from '../sim/world';

const el = (id: string) => document.getElementById(id)!;
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
  const summary = w.summary();
  const rewards = applyRun(hero, runSeed, summary, w.eliteKilled, w.runDrops, w.runEquipped);
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
    cls: hero.cls ?? 'emberwright',
    // Only offer the shadow fight when the world boss is actually reachable.
    worldBoss: cloud.online && hub.boss ? hub.boss.name : undefined,
    bossOmen: hub.bossOmen(),
  };
  if (bounty) {
    // Same fights, spawns and twist for everyone today; only the tier is the hero's own.
    const b = bountyFor(dayOf(Date.now()), hero.maxTier);
    runSeed = b.seed;
    Object.assign(opts, { seed: b.seed, tier: b.tier, dungeon: b.dungeon, route: [...b.route], omens: [b.twist], bounty: b.day, grit: 0 });
  }
  lastBounty = bounty;
  game.scene.start('game', {
    opts,
    hud,
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
  game.scene.stop('game');
  el('end').hidden = true;
  hud.hideRun();
  hub.render();
  el('title').hidden = false;
});
el('quitBtn').addEventListener('click', () => {
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
};
