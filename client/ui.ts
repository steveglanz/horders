/** HTML overlay: HUD, talent drafts, banners, menus and the touch joystick. */
import { World } from '../sim/world';
import { BRANCH_NAMES, CAPSTONE_RANKS, ClassId, MAX_HEAT, TALENTS, TalentId } from '../sim/content/emberwright';
import { CLASSES } from '../sim/content/classes';
import { ENCOUNTERS } from '../sim/content/dungeon';
import { Item, MYTHICS, RARITY, STATS } from '../sim/content/items';
import { HeroProfile, RunRewards, heroMaxLevel, heroXpToNext } from '../sim/hero';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const BRANCH_COLOR: Record<string, string> = {
  wildfire: '#ff7a2f',
  kindling: '#ffc861',
  ashguard: '#9db7d8',
  general: '#c9b8a8',
  bloodletting: '#e0465a',
  tempo: '#b58cff',
  guard: '#8fc7a8',
};

export interface RunHandlers {
  onPick: (i: number) => void;
  onPause: () => void;
  onStick: (x: number, y: number) => void;
  onCast: (slot: number) => void;
}

/** Simple original glyphs for the action bar, per class. */
const DUSK_ICONS = [
  // Rending Dash: a slash with motion lines.
  '<svg viewBox="0 0 32 32"><path d="M4 22 H14" stroke="#b58cff" stroke-width="3" stroke-linecap="round" opacity=".6"/><path d="M8 27 L28 5" stroke="#f1e6ff" stroke-width="4" stroke-linecap="round"/><path d="M20 26 L26 20" stroke="#e0465a" stroke-width="3" stroke-linecap="round"/></svg>',
  // Sidestep: a curved arrow.
  '<svg viewBox="0 0 32 32"><path d="M6 24 Q6 8 22 8" stroke="#8fc7a8" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M18 3 L25 8 L18 13" fill="#8fc7a8"/></svg>',
  // Execution: crossed blades.
  '<svg viewBox="0 0 32 32"><path d="M5 5 L27 27 M27 5 L5 27" stroke="#f1e6ff" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="#e0465a"/></svg>',
  // Kick: a boot heel.
  '<svg viewBox="0 0 32 32"><path d="M10 4 H18 V18 L27 22 V27 H8 Z" fill="#8fd8ff"/><path d="M8 23 H27" stroke="#fff" stroke-width="2"/></svg>',
];
const BULWARK_ICONS = [
  // Shield Slam: a shield with impact lines.
  '<svg viewBox="0 0 32 32"><path d="M16 4 L26 8 V16 C26 22 21 26 16 28 C11 26 6 22 6 16 V8 Z" fill="#7d8da6" stroke="#dfe7f2" stroke-width="2"/><path d="M27 6 L30 3 M28 12 H31 M27 18 L30 21" stroke="#ffd27a" stroke-width="2" stroke-linecap="round"/></svg>',
  // Charge: a shield with motion lines.
  '<svg viewBox="0 0 32 32"><path d="M2 12 H10 M2 18 H8 M2 24 H10" stroke="#dfe7f2" stroke-width="2.5" stroke-linecap="round" opacity=".6"/><path d="M20 5 L29 9 V16 C29 21 25 25 20 27 C15 25 11 21 11 16 V9 Z" fill="#7d8da6"/></svg>',
  // Bastion: a tower shield inside a ring.
  '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#ffd27a" stroke-width="2.5"/><path d="M16 7 L23 10 V16 C23 20 20 23 16 25 C12 23 9 20 9 16 V10 Z" fill="#dfe7f2"/></svg>',
  // Shield Toss: a spinning disc.
  '<svg viewBox="0 0 32 32"><circle cx="18" cy="16" r="9" fill="#8fd8ff"/><circle cx="18" cy="16" r="3.5" fill="#fff"/><path d="M3 12 A12 12 0 0 1 9 7 M3 20 A12 12 0 0 0 9 25" stroke="#8fd8ff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
];
const LUMEN_ICONS = [
  // Radiant Burst: a sun.
  '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="#fff2b0"/><path d="M16 2 V8 M16 24 V30 M2 16 H8 M24 16 H30 M6 6 L10 10 M22 22 L26 26 M26 6 L22 10 M10 22 L6 26" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round"/></svg>',
  // Glimmer Step: sparkles along a path.
  '<svg viewBox="0 0 32 32"><path d="M4 24 Q14 22 20 12" stroke="#fff2b0" stroke-width="2" fill="none" stroke-dasharray="3 3"/><path d="M24 4 L26 9 L31 11 L26 13 L24 18 L22 13 L17 11 L22 9 Z" fill="#fff2b0"/></svg>',
  // Sanctuary: a ring of light on the ground.
  '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="22" rx="13" ry="6" fill="none" stroke="#ffd27a" stroke-width="2.5"/><path d="M16 4 V18 M10 10 H22" stroke="#fff2b0" stroke-width="3" stroke-linecap="round"/></svg>',
  // Hush: a finger to the lips, as a crossed-out wave.
  '<svg viewBox="0 0 32 32"><path d="M5 16 Q9 9 13 16 T21 16 T29 16" stroke="#8fd8ff" stroke-width="2.5" fill="none"/><path d="M6 26 L26 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>',
];
const ICONS = [
  // Flame Wave: a fan of fire.
  '<svg viewBox="0 0 32 32"><path d="M4 26 L16 6 L28 26 Q16 20 4 26Z" fill="#ff8a3d"/><path d="M10 24 L16 13 L22 24 Q16 21 10 24Z" fill="#ffe08a"/></svg>',
  // Blink: a streak.
  '<svg viewBox="0 0 32 32"><path d="M3 20 H18" stroke="#ffc861" stroke-width="3" stroke-linecap="round" opacity=".5"/><path d="M8 14 H22" stroke="#ffc861" stroke-width="3" stroke-linecap="round" opacity=".7"/><circle cx="25" cy="16" r="5" fill="#fff0c0"/></svg>',
  // Combustion: a burst.
  '<svg viewBox="0 0 32 32"><path d="M16 2 L19 12 L29 9 L21 16 L29 23 L19 20 L16 30 L13 20 L3 23 L11 16 L3 9 L13 12Z" fill="#ff6a2f"/><circle cx="16" cy="16" r="5" fill="#fff3c4"/></svg>',
  // Quench: a droplet.
  '<svg viewBox="0 0 32 32"><path d="M16 3 C22 12 26 17 26 21 A10 10 0 0 1 6 21 C6 17 10 12 16 3Z" fill="#8fd8ff"/><path d="M12 20 A4 4 0 0 0 16 25" stroke="#fff" stroke-width="2" fill="none"/></svg>',
];

export function itemHtml(it: Item, extra = ''): string {
  const c = RARITY[it.rarity].color;
  const stats = it.stats.map((s) => STATS[s.stat].format(s.value)).join(' · ');
  const myth = it.mythic ? `<div class="st" style="color:${c}">${MYTHICS[it.mythic].name}: ${MYTHICS[it.mythic].text}</div>` : '';
  const slot = it.slot[0].toUpperCase() + it.slot.slice(1);
  return `<div class="info" style="--rc:${c}"><span class="nm">${it.name}</span>${extra}<div class="st">${slot} · iLvl ${it.ilvl} · ${RARITY[it.rarity].name}</div><div class="st">${stats}</div>${myth}</div>`;
}

const RANK_COLOR: Record<string, string> = { boss: '#ff3b6b', rare: '#9fd0ff', elite: '#ffc861', normal: '#c77dff' };

function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private handlers?: RunHandlers;
  private lastTick = 0;
  private draftShownFor = -1;
  private bannerTimer = 0;
  showPerf = false;

  constructor() {
    $('pauseBtn').addEventListener('click', () => this.handlers?.onPause());
    $('resumeBtn').addEventListener('click', () => this.handlers?.onPause());
    this.setupStick();
  }

  private barFor: ClassId | null = null;

  /** Builds the action bar for the class being played. */
  private buildBar(cls: ClassId): void {
    if (this.barFor === cls) return;
    this.barFor = cls;
    const bar = $('abilities');
    bar.innerHTML = '';
    this.abButtons = [];
    const def = CLASSES[cls];
    const icons = cls === 'duskblade' ? DUSK_ICONS : cls === 'bulwark' ? BULWARK_ICONS : cls === 'lumen' ? LUMEN_ICONS : ICONS;
    def.abilities.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'ab';
      b.setAttribute('aria-label', `${a.name} (${a.key})`);
      b.title = `${a.name} (${a.key})${a.cost ? ` · ${a.cost} ${def.resource}` : ''}: ${a.text}`;
      b.innerHTML = `${icons[i]}<span class="k">${a.key}</span><span class="n">${a.name}</span><span class="cd"></span>`;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handlers?.onCast(i);
      });
      bar.appendChild(b);
      this.abButtons.push(b);
    });
  }

  private abButtons: HTMLButtonElement[] = [];

  /** Briefly pulses an action button when it fires. */
  flashAbility(slot: number): void {
    const b = this.abButtons[slot];
    if (!b) return;
    b.classList.remove('flash');
    void b.offsetWidth;
    b.classList.add('flash');
  }

  bindRun(h: RunHandlers): void {
    this.handlers = h;
  }

  showRun(w: World): void {
    $('title').hidden = true;
    $('end').hidden = true;
    $('pause').hidden = true;
    $('draft').hidden = true;
    $('hud').hidden = false;
    $('actionbar').hidden = false;
    $('target').hidden = true;
    $('toasts').innerHTML = '';
    $('perf').hidden = !this.showPerf;
    this.buildBar(w.cls);
    $('heat').dataset.cls = w.cls;
    this.draftShownFor = -1;
    this.questKey = '';
    this.tick(w, { avg: 0, p95ms: 0 }, true);
  }

  tick(w: World, fps: { avg: number; p95ms: number }, force = false): void {
    const now = performance.now();
    if (!force && now - this.lastTick < 100) return;
    this.lastTick = now;
    const p = w.player;
    $('hpFill').style.width = `${(100 * Math.max(0, p.hp)) / p.maxHp}%`;
    $('hpText').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
    $('xpFill').style.width = `${(100 * p.xp) / p.xpToNext}%`;
    $('level').textContent = String(p.level);
    $('timer').textContent = fmt(w.time);
    $('kills').textContent = String(w.kills);
    $('killsLabel').textContent = w.stress ? 'kills' : 'slain';
    let next = '';
    if (w.stress) next = 'Stress test';
    else if (w.phase === 'choose') next = `Choose a path · ${Math.ceil(w.phaseT)}`;
    else if (w.phase === 'intro') next = `Fight ${w.encounter + 1} of ${w.route.length} in ${Math.ceil(w.phaseT)}`;
    else if (w.inShadow) next = `World boss shadow: ${Math.ceil(w.shadowLeft)}s left`;
    else if (w.bossEnraged) next = 'Boss enraged!';
    else next = `Fight ${w.encounter + 1} of ${w.route.length}`;
    $('next').textContent = next;

    // Heat and action bar.
    $('heatFill').style.width = `${(100 * p.heat) / MAX_HEAT}%`;
    $('heatText').textContent = `${Math.floor(p.heat)} ${w.classDef.resource}`;
    const kick = w.interruptTarget() >= 0;
    this.abButtons.forEach((b, i) => {
      // A stored Blink charge (Blazing Speed) makes the button ready while the cooldown runs.
      const cd = i === 1 && p.blinkCharges > 0 ? 0 : p.cds[i];
      const total = w.abilityCooldown(i);
      const gcd = !w.abilities[i].offGcd && p.gcd > 0 ? p.gcd / 0.4 : 0;
      const frac = cd > 0 ? cd / total : gcd;
      const cdEl = b.querySelector('.cd') as HTMLElement;
      cdEl.style.setProperty('--p', String(Math.min(1, frac)));
      cdEl.textContent = cd > 0.05 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '';
      b.classList.toggle('nores', p.heat < w.abilityCost(i));
      b.classList.toggle('hot', i === 3 && kick && cd <= 0);
    });

    this.updateTarget(w);
    this.updateQuests(w);
    this.updateBuffs(w);

    if (this.showPerf) {
      $('perf').textContent = `${fps.avg.toFixed(0)} fps · p95 ${fps.p95ms.toFixed(1)} ms · ${w.aliveEnemies} enemies`;
    }
    if (this.bannerTimer && now > this.bannerTimer) {
      $('banner').classList.remove('show');
      this.bannerTimer = 0;
    }
  }

  private targetIndex(w: World): number {
    if (w.bossIndex >= 0) {
      const b = w.enemies[w.bossIndex];
      if (b.alive && b.def.rank === 'boss') return w.bossIndex;
    }
    const p = w.player;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.alive || (e.def.rank === 'normal' && !e.def.stationary)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > 700) continue;
      const score = d - (e.castId && e.interruptible ? 1000 : 0) - (e.def.rank === 'rare' ? 200 : 0);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  private updateTarget(w: World): void {
    const i = this.targetIndex(w);
    const box = $('target');
    if (i < 0) {
      box.hidden = true;
      return;
    }
    const e = w.enemies[i];
    box.hidden = false;
    box.style.setProperty('--tcolor', RANK_COLOR[e.def.rank]);
    const shadow = e.kind === 'worldShadow';
    $('tName').textContent = shadow && w.worldBoss ? `Shadow of ${w.worldBoss}` : e.def.name;
    $('tTitle').textContent = e.def.title ?? (e.def.stationary ? 'Objective' : '');
    const extra = e.kind === 'maelra' && w.temper > 0 ? ` · Temper ×${w.temper}` : e.kind === 'glassWarden' && e.aux2 > 0 ? 'Mirrored' : e.ward > 0 ? 'Warded' : '';
    $('tPhase').textContent = (e.def.rank === 'boss' ? (w.bossEnraged ? 'Enraged' : `Phase ${w.bossPhase} of 3`) : e.stunT > 0 ? 'Stunned' : '') + extra;
    if (shadow) {
      // The shadow can't die: its bar is the clock, and the number is damage dealt.
      $('tFill').style.width = `${(100 * w.shadowLeft) / 60}%`;
      $('tPct').textContent = `${Math.ceil(w.shadowLeft)}s · ${Math.round(w.shadowDamage).toLocaleString()} dmg`;
    } else {
      const pct = Math.max(0, e.hp) / e.maxHp;
      $('tFill').style.width = `${100 * pct}%`;
      $('tPct').textContent = `${Math.ceil(pct * 100)}%`;
    }
    const cast = $('tCast');
    if (e.castId) {
      cast.hidden = false;
      cast.classList.toggle('kick', e.interruptible);
      $('tCastFill').style.width = `${(100 * e.castT) / e.castDur}%`;
      const touch = matchMedia('(pointer: coarse)').matches;
      $('tCastName').textContent = e.interruptible ? `${e.castName} · ${touch ? `tap ${w.abilities[3].name}!` : `press F to ${w.abilities[3].name}!`}` : e.castName;
    } else cast.hidden = true;
  }

  private questKey = '';

  /** The dungeon route, like an MMO dungeon's boss list. */
  private updateQuests(w: World): void {
    const key = `${w.encounter}:${w.phase}`;
    if (key === this.questKey) return;
    this.questKey = key;
    if (w.stress) { $('quests').innerHTML = ''; return; }
    $('quests').innerHTML = `<h3>${w.dungeonDef.name}</h3>` + w.route.map((id, i) => {
      const def = ENCOUNTERS[id];
      const done = i < w.encounter;
      const now = i === w.encounter;
      return `<div class="q${done ? ' done' : ''}${now ? ' now' : ''}"><div class="qn">${def.name}</div>${now ? `<div class="qp">${def.tip}</div>` : ''}</div>`;
    }).join('');
  }

  private updateBuffs(w: World): void {
    const p = w.player;
    const out: string[] = [];
    if (w.telegraphs.some((t) => t.alive && t.kind === 'soak')) out.push('<span class="buff debuff">Kiln Brand: stand in the gold circle!</span>');
    if (p.shieldT > 0) out.push('<span class="buff" style="--bc:#8fd8ff">Shielded</span>');
    if (p.hasteT > 0) out.push('<span class="buff" style="--bc:#ffb04a">Blazing Speed</span>');
    if (p.bastionT > 0) out.push('<span class="buff" style="--bc:#ffd27a">Bastion</span>');
    if (p.sanctT > 0) out.push('<span class="buff" style="--bc:#ffd27a">Sanctuary</span>');
    if (p.brilliance >= 1) out.push(`<span class="buff" style="--bc:#fff2b0">Brilliance ${Math.floor(p.brilliance)}</span>`);
    if (p.ward > 0.5) out.push(`<span class="buff" style="--bc:#dfe7f2">Ward ${Math.ceil(p.ward)}</span>`);
    if (p.heat >= w.abilityCost(2) && p.cds[2] <= 0) out.push(`<span class="buff" style="--bc:#ff8a3d">${w.abilities[2].name} ready</span>`);
    for (const m of w.loadout.mythics) {
      if (m === 'phoenixFeather' && w.revived) continue;
      out.push(`<span class="buff" style="--bc:#ff9a3d">${MYTHICS[m].name}</span>`);
    }
    const html = out.join('');
    if ($('buffs').innerHTML !== html) $('buffs').innerHTML = html;
  }

  /** Loot toast: what dropped and whether it was worn right away. */
  toast(it: Item, equipped: boolean, delta: number): void {
    const el = document.createElement('div');
    el.className = 'toast' + (equipped ? ' up' : '');
    el.style.setProperty('--rc', RARITY[it.rarity].color);
    el.innerHTML = `<b>${it.name}</b> <span class="sub">${RARITY[it.rarity].name}</span><div class="sub">${equipped ? `Equipped, upgrade +${delta}` : 'Sent to your bags'}</div>`;
    const box = $('toasts');
    box.prepend(el);
    while (box.children.length > 4) box.lastChild!.remove();
    setTimeout(() => el.remove(), 4500);
  }

  ding(text: string): void {
    const d = $('ding');
    d.textContent = text;
    d.classList.remove('show');
    void d.offsetWidth;
    d.classList.add('show');
    this.placeDing();
  }

  /** Keeps "Cleared!" clear of the encounter banner when both show at once. */
  private placeDing(): void {
    const d = $('ding');
    const b = $('banner');
    d.style.top = b.classList.contains('show') ? `${Math.round(b.getBoundingClientRect().bottom + 16)}px` : '';
  }

  showDraft(w: World): void {
    // Re-render only when a new set of choices appears.
    const key = w.player.level * 100 + w.player.pendingLevels + (w.choices.length ? 0 : 50);
    if (!$('draft').hidden && this.draftShownFor === key) return;
    this.draftShownFor = key;
    const cards = $('cards');
    cards.innerHTML = '';
    if (!w.choices.length) {
      // Co-op: you've picked; the run resumes when the rest of the party has.
      cards.innerHTML = '<div class="muted" style="padding:24px;text-align:center">Waiting for the rest of your party to pick their talents.</div>';
      $('draftTitle').textContent = 'Waiting for your party';
      $('draft').hidden = false;
      return;
    }
    w.choices.forEach((c, i) => {
      const def = TALENTS[c.id as TalentId];
      const color = BRANCH_COLOR[def.branch];
      const btn = document.createElement('button');
      btn.className = 'card' + (def.capstone ? ' capstone' : '');
      btn.style.setProperty('--branch', color);
      let progress = '';
      if (def.branch !== 'general' && !def.capstone) {
        const have = Math.min(CAPSTONE_RANKS, w.branchRanks(def.branch) + 1);
        progress = `<div class="progress">${BRANCH_NAMES[def.branch]} ${have}/${CAPSTONE_RANKS} toward capstone</div>`;
      }
      const rank = def.maxRank < 99 ? `Rank ${c.nextRank} of ${def.maxRank}` : '';
      btn.innerHTML = `<div class="key">${i + 1}</div><div class="branch">${BRANCH_NAMES[def.branch]}</div><div class="name">${def.name}</div><div class="text">${def.text}</div><div class="rank">${rank}</div>${progress}`;
      btn.addEventListener('click', () => this.handlers?.onPick(i));
      cards.appendChild(btn);
    });
    $('draftTitle').textContent = w.player.pendingLevels > 1 ? `Level up! (${w.player.pendingLevels} picks)` : 'Level up!';
    $('draft').hidden = false;
  }

  hideDraft(): void {
    if ($('draft').hidden) return;
    $('draft').hidden = true;
    this.draftShownFor = -1;
  }

  setPaused(p: boolean): void {
    $('pause').hidden = !p;
  }

  banner(title: string, sub: string): void {
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    $('banner').classList.add('show');
    this.bannerTimer = performance.now() + 3200;
    this.placeDing();
  }

  hideRun(): void {
    $('hud').hidden = true;
    $('actionbar').hidden = true;
    $('target').hidden = true;
  }

  showEnd(w: World, rewards?: RunRewards, hero?: HeroProfile): void {
    const s = w.summary();
    $('draft').hidden = true;
    $('actionbar').hidden = true;
    $('target').hidden = true;
    let xp = '';
    let loot = '';
    if (rewards && hero) {
      const atCap = hero.level >= heroMaxLevel();
      const need = heroXpToNext(hero.level);
      const pct = atCap ? 100 : (100 * hero.xp) / need;
      const notes = [`Fights cleared: ${Math.min(w.encounter, w.route.length)} of ${w.route.length}`];
      if (rewards.levelsGained) notes.unshift(`<b>Hero level ${hero.level}!</b>`);
      if (rewards.bountyEmbers) notes.push(`<b>Daily bounty paid: +${rewards.bountyEmbers} embers</b>`);
      xp = `<div class="top"><b>Hero XP</b><span>+${rewards.heroXp.toLocaleString()}</span></div>`
        + `<div class="meter"><div style="width:${pct}%"></div></div>`
        + `<div class="kv"><span>Level ${hero.level}</span><span>${atCap ? 'Max level' : `${hero.xp.toLocaleString()} / ${need.toLocaleString()} XP`}</span></div>`
        + `<div class="note">${notes.join(' · ')}</div>`;
      const equipped = new Set(Object.values(hero.equipped));
      const n = rewards.items.length;
      const worn = rewards.items.filter((it) => equipped.has(it.id)).length;
      loot = `<div class="top"><b>Loot</b><span>${n ? `${n} ${n === 1 ? 'item' : 'items'}${worn ? ` · ${worn} equipped` : ''}` : 'Nothing this time'}</span></div>`
        + rewards.items.map((it) => `<div class="item" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it, equipped.has(it.id) ? '<span class="tagE">Equipped</span>' : '')}</div>`).join('');
    }
    $('endXp').innerHTML = xp;
    $('rewards').innerHTML = loot;
    $('end').classList.toggle('win', s.victory);
    $('end').classList.toggle('loss', !s.victory);
    $('endTitle').textContent = s.victory ? 'Victory' : 'The Tide took you';
    $('endSub').textContent = s.victory
      ? `${ENCOUNTERS[w.dungeonDef.boss].name.split(',')[0]} falls. Emberhold will sing of this.`
      : w.bossSpawned
        ? `So close. ${ENCOUNTERS[w.dungeonDef.boss].name.split(',')[0]} still stands.`
        : `${w.encounterDef.name} bested you. Your gear and levels carry into the next delve.`;
    $('stats').innerHTML = [
      ['Time', fmt(s.time)],
      ['Level', String(s.level)],
      ['Slain', String(s.kills)],
      ['Damage', s.damageDealt.toLocaleString()],
    ].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    $('endTalents').innerHTML = (Object.keys(s.talents) as TalentId[])
      .map((id) => {
        const def = TALENTS[id];
        return `<span class="chip" style="--branch:${BRANCH_COLOR[def.branch]}">${def.name}${def.maxRank > 1 && def.maxRank < 99 ? ' ' + s.talents[id] : def.maxRank >= 99 ? ' x' + s.talents[id] : ''}</span>`;
      })
      .join('') || '<span class="muted">No talents taken</span>';
    $('end').hidden = false;
  }

  private setupStick(): void {
    const zone = $('touch');
    const base = $('stickBase');
    const knob = $('stickKnob');
    let id: number | null = null;
    let ox = 0;
    let oy = 0;
    const R = 56;
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      base.style.left = `${ox}px`;
      base.style.top = `${oy}px`;
      knob.style.transform = 'translate(-50%, -50%)';
      base.hidden = false;
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox;
      let dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Past 30% deflection the hero runs at full speed; below it, walks.
      const mag = Math.min(1, d / R);
      if (d < 4) this.handlers?.onStick(0, 0);
      else {
        const k = mag > 0.3 ? 1 / R / mag : 1 / R;
        this.handlers?.onStick(dx * k, dy * k);
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      base.hidden = true;
      this.handlers?.onStick(0, 0);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }
}
