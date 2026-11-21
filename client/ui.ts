/** HTML overlay: HUD, talent drafts, banners, menus and the touch joystick. */
import { World, REVIVE_SECONDS } from '../sim/world';
import { AFFIXES } from '../sim/content/named';
import { BRANCH_NAMES, Branch, CAPSTONE_RANKS, ClassId, MAX_HEAT, TALENTS, TalentId } from '../sim/content/emberwright';
import { CLASSES } from '../sim/content/classes';
import { ENCOUNTERS } from '../sim/content/dungeon';
import { Item, MYTHICS, WEAPON_FX, RARITY, STATS } from '../sim/content/items';
import { SETS } from '../sim/content/sets';
import { ABILITY_GLYPH, CLASS_ICON, INTERRUPT_SLOT, SET_COLOR, SET_ICON, glyph, omenTile } from './icons';
import { OMENS, OmenId } from '../sim/content/omens';
import { setTip } from './tips';
import { Coach } from './coach';
import { HELP } from '../sim/content/help';
import { HeroProfile, RunRewards, equippedItems, heroMaxLevel, heroXpToNext } from '../sim/hero';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Every branch needs a colour (draft card border and title, end-screen chips): typed so a new branch can't be missed. */
const BRANCH_COLOR: Record<Branch, string> = {
  wildfire: '#ff7a2f',
  kindling: '#ffc861',
  ashguard: '#9db7d8',
  general: '#c9b8a8',
  bloodletting: '#e0465a',
  tempo: '#b58cff',
  guard: '#8fc7a8',
  // Bulwark
  bastion: '#a9bccf',
  retribution: '#e8a33c',
  vanguard: '#e0735a',
  // Lumen
  dawn: '#ffd98a',
  grace: '#7fe0c4',
  choir: '#c7a6ff',
};

export interface RunHandlers {
  onPick: (i: number) => void;
  onPause: () => void;
  onStick: (x: number, y: number) => void;
  onCast: (slot: number) => void;
}

/** How many pieces of each verb set a hero wears. */
export function setsWorn(h: HeroProfile): Partial<Record<string, number>> {
  const n: Partial<Record<string, number>> = {};
  for (const it of equippedItems(h)) if (it.set) n[it.set] = (n[it.set] ?? 0) + 1;
  return n;
}

/** `worn`: the hero's set piece counts, so the card can light the bonuses already active. */
export function itemHtml(it: Item, extra = '', worn?: Partial<Record<string, number>>): string {
  const c = RARITY[it.rarity].color;
  const stats = it.stats.map((s) => STATS[s.stat].format(s.value)).join(' · ');
  const myth = it.mythic ? `<div class="st" style="color:${c}">${MYTHICS[it.mythic].name}: ${MYTHICS[it.mythic].text}</div>` : '';
  const fx = it.weaponFx ? `<div class="st" style="color:${c}">${WEAPON_FX[it.weaponFx].name}: ${WEAPON_FX[it.weaponFx].text}</div>` : '';
  const set = it.set ? SETS[it.set] : undefined;
  const have = set && worn ? worn[set.id] ?? 0 : 0;
  const setHtml = set
    ? `<div class="st set setb" style="--gc:${SET_COLOR}"><div class="sh"><span class="gtile">${glyph(SET_ICON[set.id], 14)}</span><b>${set.name} set</b><span class="verb">${set.verb}</span>${worn ? `<span class="pips" title="${have} of 3 worn">${[0, 1, 2].map((k) => `<i${k < have ? ' class="on"' : ''}></i>`).join('')}</span>` : ''}</div>`
      + set.bonus.map((b, k) => `<div class="sb${worn && have >= k + 2 ? ' on' : ''}"><em>${k + 2}</em>${b}</div>`).join('')
      + '</div>'
    : '';
  const slot = it.slot[0].toUpperCase() + it.slot.slice(1);
  return `<div class="info" style="--rc:${c}"><span class="nm">${it.name}</span>${extra}<div class="st">${slot} · iLvl ${it.ilvl} · ${RARITY[it.rarity].name}</div><div class="st">${stats}</div>${fx}${myth}${setHtml}</div>`;
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
    if (matchMedia('(pointer: coarse)').matches) $('draftHint').textContent = 'Tap a card to pick it. Hold it for details.';
    $('draftTitle').setAttribute('data-tip', HELP.runTalents);
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
    const icons = ABILITY_GLYPH[cls];
    bar.style.setProperty('--ac', CLASS_ICON[cls].color);
    def.abilities.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = i === INTERRUPT_SLOT ? 'ab kick' : 'ab';
      b.setAttribute('aria-label', `${a.name} (${a.key})`);
      b.dataset.tipTouch = 'off';
      b.title = `${a.name} (${a.key})${a.cost ? ` · ${a.cost} ${def.resource}` : ''}: ${a.text}`;
      b.innerHTML = `${glyph(icons[i], 30)}<span class="k">${a.key}</span><span class="n">${a.name}</span><span class="cd"></span>`;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handlers?.onCast(i);
      });
      bar.appendChild(b);
      this.abButtons.push(b);
    });
    // The pause menu lists the same abilities, where a hold can explain them without casting.
    const pabs = $('pauseAbilities');
    pabs.style.setProperty('--ac', CLASS_ICON[cls].color);
    pabs.innerHTML = def.abilities.map((a, i) => `<div class="pab" role="button" tabindex="0">${glyph(icons[i], 24)}<b>${a.name}</b></div>`).join('')
      + `<div class="pabs-hint" style="grid-column:1/-1">${matchMedia('(pointer: coarse)').matches ? 'Hold' : 'Hover'} an ability for what it does.</div>`;
    pabs.querySelectorAll('.pab').forEach((el, i) => {
      const a = def.abilities[i];
      setTip(el, () => `<b>${a.name}</b><br>${a.text}<br><span class="tip-m">${[a.cost ? `${a.cost} ${def.resource}` : 'Free', `${a.cooldown}s cooldown`, i === INTERRUPT_SLOT ? 'Interrupts casts' : ''].filter(Boolean).join(' · ')}</span>`);
    });
  }

  private abButtons: HTMLButtonElement[] = [];
  private coach = new Coach();

  /** The pause menu names this delve's Omens; hold or hover one for what it does. */
  private showOmens(w: World): void {
    const box = $('pauseOmens');
    const ids = (w.omens ?? []) as OmenId[];
    box.hidden = !ids.length;
    if (!ids.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="po-h">${ids.length === 1 ? 'Omen' : 'Omens'} this delve</div>`
      + ids.map((id) => `<div class="po" data-omen="${id}">${omenTile(id, 28)}<span><b>${OMENS[id].name}</b><i>${OMENS[id].tip}</i></span></div>`).join('');
    box.querySelectorAll<HTMLElement>('[data-omen]').forEach((el) => {
      const o = OMENS[el.dataset.omen as OmenId];
      setTip(el, () => `<b>${o.name}</b><br>${o.text}<br><span class="tip-g">${o.tip}</span>`);
    });
  }

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
    this.showOmens(w);
    this.buildParty(w);
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
    // G6: downed in a party, the health text says how to get back up and how far along it is.
    const rev = p.hp <= 0 && w.heroes.length > 1 ? Math.min(1, (p.reviveT ?? 0) / REVIVE_SECONDS) : -1;
    $('hpText').textContent = rev < 0 ? `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}` : rev > 0 ? `Reviving ${Math.round(rev * 100)}%` : 'Down · an ally can revive you';
    this.tickParty(w);
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
    $('heatText').innerHTML = `<span>${w.classDef.resource}</span><b>${Math.floor(p.heat)}</b>`;
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
    if (!$('pause').hidden || !$('draft').hidden) this.coach.hide();
    else this.coach.tick(w, this.abButtons);

    this.updateTarget(w);
    this.updateQuests(w);
    this.updateBuffs(w);
    this.stackTop();

    if (this.showPerf) {
      $('perf').textContent = `${fps.avg.toFixed(0)} fps · p95 ${fps.p95ms.toFixed(1)} ms · ${w.aliveEnemies} enemies`;
    }
    if (this.bannerTimer && now > this.bannerTimer) {
      $('banner').classList.remove('show');
      this.bannerTimer = 0;
    }
  }

  private narrow = matchMedia('(max-width: 560px)');
  private phone = matchMedia('(max-width: 560px), (max-height: 520px)');
  /** Phone-sized screen: shorter banners, icon-only HUD. */
  get compact(): boolean { return this.phone.matches; }
  private stacked = '';

  /**
   * Phones: the target frame spans the screen, so it used to sit on top of the
   * buff chips (Kiln Brand's "stand in the gold circle!", Ward, Bastion) and the
   * route line. Stack them instead: buffs, the target frame, the route, then party frames.
   */
  private stackTop(): void {
    const target = $('target');
    const quests = $('quests');
    const party = $('party');
    let key = '';
    let tTop = 0;
    let qTop = 0;
    if (this.narrow.matches) {
      tTop = Math.round($('buffs').getBoundingClientRect().bottom + 6);
      qTop = Math.max(118, target.hidden ? tTop : Math.round(tTop + target.offsetHeight + 6));
      key = `${tTop}:${qTop}:${quests.offsetHeight}:${target.hidden}:${party.hidden}`;
    }
    if (key === this.stacked) return;
    this.stacked = key;
    target.style.top = key ? `${tTop}px` : '';
    quests.style.top = key ? `${qTop}px` : '';
    // Co-op party frames go under the route line.
    const above = quests.offsetHeight ? quests : target.hidden ? $('buffs') : target;
    party.style.top = key ? `${Math.max(150, Math.round(above.getBoundingClientRect().bottom + 6))}px` : '';
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
      $('hud').classList.remove('vsboss', 'tgt');
      return;
    }
    const e = w.enemies[i];
    box.hidden = false;
    // Phones hide the route line while a target frame shows: the frame and "Fight 3 of 5" already say where you are.
    $('hud').classList.toggle('vsboss', e.def.rank === 'boss');
    $('hud').classList.add('tgt');
    box.style.setProperty('--tcolor', RANK_COLOR[e.def.rank]);
    const shadow = e.kind === 'worldShadow';
    $('tName').textContent = shadow && w.worldBoss ? `Shadow of ${w.worldBoss}` : e.named >= 0 ? w.namedName(i) : e.def.name;
    $('tTitle').textContent = e.named >= 0 ? `Named · ${AFFIXES[e.affix]}` : e.def.title ?? (e.def.stationary ? 'Objective' : '');
    const extra = e.kind === 'maelra' && w.temper > 0 ? ` · Temper ×${w.temper}` : e.kind === 'glassWarden' && e.aux2 > 0 ? 'Mirrored' : e.ward > 0 ? 'Warded' : '';
    const state = e.def.rank === 'boss' ? (w.bossEnraged ? 'Enraged' : `Phase ${w.bossPhase} of 3`) : e.stunT > 0 ? 'Stunned' : '';
    // Join with a dot ("Enraged · Warded"); Maelra's Temper already brings its own.
    $('tPhase').textContent = state && extra && !extra.startsWith(' · ') ? `${state} · ${extra}` : state + extra;
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
    // Gold soak circles: the Kiln Mother's Brand, or a group boss's vents (owner -2), which need one hero in each.
    const soak = w.telegraphs.find((t) => t.alive && t.kind === 'soak');
    if (soak) out.push(`<span class="buff debuff">${soak.owner === -2 ? 'Vents open: someone in each gold circle!' : 'Kiln Brand: stand in the gold circle!'}</span>`);
    if (p.shieldT > 0) out.push('<span class="buff" style="--bc:#8fd8ff">Shielded</span>');
    if (p.hasteT > 0) out.push('<span class="buff" style="--bc:#ffb04a">Blazing Speed</span>');
    if (p.bastionT > 0) out.push('<span class="buff" style="--bc:#ffd27a">Bastion</span>');
    if (p.sanctT > 0) out.push('<span class="buff" style="--bc:#ffd27a">Sanctuary</span>');
    if (p.brilliance >= 1) out.push(`<span class="buff" style="--bc:#fff2b0">Brilliance ${Math.floor(p.brilliance)}</span>`);
    if (p.ward > 0.5) out.push(`<span class="buff" style="--bc:#dfe7f2">Ward ${Math.ceil(p.ward)}</span>`);
    if (p.heat >= w.abilityCost(2) && p.cds[2] <= 0) out.push(`<span class="buff" style="--bc:#ff8a3d">${w.abilities[2].name} ready</span>`);
    // Verb sets: show the timed bonuses while they run.
    if ((p.kbT ?? 0) > 0) out.push(`<span class="buff" style="--bc:${SET_COLOR}">Kilnbreaker +10%</span>`);
    if (p.surge) out.push(`<span class="buff" style="--bc:${SET_COLOR}">Tidewalker surge</span>`);
    if ((p.gwT ?? 0) > 0) out.push(`<span class="buff" style="--bc:${SET_COLOR}">Glarewarden +10%</span>`);
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
    // Phones show the short form on one line (".ts"); the rarity is in the colour.
    el.innerHTML = `<b>${it.name}</b> <span class="sub tr">${RARITY[it.rarity].name}</span>`
      + `<div class="sub tl">${equipped ? `Equipped, upgrade +${delta}` : 'Sent to your bags'}</div>`
      + `<span class="sub ts">${equipped ? `\u25B2 +${delta}` : 'to bags'}</span>`;
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
      $('draftLevel').textContent = 'Level up';
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
      btn.innerHTML = `<div class="key">${i + 1}</div><div class="branch">${BRANCH_NAMES[def.branch]}${def.capstone ? '<span class="cap">Capstone</span>' : ''}</div><div class="name">${def.name}</div><div class="text">${def.text}</div><div class="rank">${rank}</div>${progress}`;
      btn.addEventListener('click', () => this.handlers?.onPick(i));
      const tip = (def as { tip?: string }).tip ?? def.text;
      const why = def.capstone ? `Capstone: needs ${CAPSTONE_RANKS} ranks in ${BRANCH_NAMES[def.branch]}.`
        : def.branch !== 'general' ? `${CAPSTONE_RANKS} ranks in ${BRANCH_NAMES[def.branch]} unlock its capstone.` : '';
      setTip(btn, () => `<b>${def.name}</b>${rank ? ` · ${rank}` : ''}<br>${tip}${why ? `<br><span class="tip-m">${why}</span>` : ''}<br><span class="tip-m">${HELP.bothKinds}</span>`);
      cards.appendChild(btn);
    });
    $('draftLevel').textContent = `Level ${w.player.level}${w.player.pendingLevels > 1 ? ` · ${w.player.pendingLevels} picks` : ''}`;
    $('draftTitle').textContent = 'Choose a talent';
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

  /** Co-op party frames: one row per ally, with class glyph, name and health. */
  private partyRows: { hero: number; el: HTMLElement; fill: HTMLElement; tag: HTMLElement; down: boolean; reviving: boolean }[] = [];

  private buildParty(w: World): void {
    const box = $('party');
    this.partyRows = [];
    const rows: string[] = [];
    for (let j = 0; j < w.heroes.length; j++) {
      if (j === w.acting) continue;
      const h = w.heroes[j];
      const ic = CLASS_ICON[h.cls];
      rows.push(`<div class="pf" data-h="${j}" style="--gc:${ic.color}"><span class="gtile">${glyph(ic.d, 14)}</span><div class="pfb"><div class="pfn"><b></b><i>Down</i></div><div class="pfbar"><div></div></div></div></div>`);
    }
    box.innerHTML = rows.join('');
    box.hidden = rows.length === 0;
    box.querySelectorAll<HTMLElement>('.pf').forEach((el) => {
      const hero = Number(el.dataset.h);
      el.querySelector('b')!.textContent = w.heroes[hero].name;
      this.partyRows.push({ hero, el, fill: el.querySelector('.pfbar div') as HTMLElement, tag: el.querySelector('.pfn i') as HTMLElement, down: false, reviving: false });
    });
  }

  private tickParty(w: World): void {
    for (const r of this.partyRows) {
      const q = w.heroData(r.hero).player;
      const down = q.hp <= 0;
      // G6: while a hero is down, their bar shows the revive filling instead of health.
      const rev = down ? Math.min(1, (q.reviveT ?? 0) / REVIVE_SECONDS) : 0;
      r.fill.style.width = `${down ? 100 * rev : (100 * Math.max(0, q.hp)) / q.maxHp}%`;
      if (down !== r.down) {
        r.down = down;
        r.el.classList.toggle('down', down);
      }
      const reviving = rev > 0;
      if (reviving !== r.reviving) {
        r.reviving = reviving;
        r.el.classList.toggle('reviving', reviving);
        r.tag.textContent = reviving ? 'Reviving' : 'Down';
      }
    }
  }

  hideRun(): void {
    // Quitting from the pause menu during a talent draft (Esc, or the app going
    // to the background) used to leave the draft over the hub and block every tap.
    this.hideDraft();
    $('hud').hidden = true;
    $('actionbar').hidden = true;
    $('target').hidden = true;
  }

  showEnd(w: World, rewards?: RunRewards, hero?: HeroProfile): void {
    const s = w.summary();
    this.coach.hide();
    $('draft').hidden = true;
    $('actionbar').hidden = true;
    $('target').hidden = true;
    let xp = '';
    let loot = '';
    if (rewards && hero) {
      const atCap = hero.level >= heroMaxLevel();
      const need = heroXpToNext(hero.level);
      const pct = atCap ? 100 : (100 * hero.xp) / need;
      // The run ends on the boss's killing blow, before the clear is counted; the
      // world boss's shadow fight is a bonus, not one of the delve's fights.
      const fights = w.route.filter((r) => r !== 'worldShadow').length;
      const notes = [`Fights cleared: ${s.victory ? fights : Math.min(w.encounter, fights)} of ${fights}`];
      if (rewards.levelsGained) notes.unshift(`<b>Hero level ${hero.level}!</b>`);
      if (!rewards.items.length) notes.push('No loot this time');
      if (rewards.bountyEmbers) notes.push(`<b>Daily bounty paid: +${rewards.bountyEmbers} embers</b>`);
      xp = `<div class="top"><b>Hero XP</b><span>+${rewards.heroXp.toLocaleString()}</span></div>`
        + `<div class="meter"><div style="width:${pct}%"></div></div>`
        + `<div class="kv"><span>Level ${hero.level}</span><span>${atCap ? 'Max level' : `${hero.xp.toLocaleString()} / ${need.toLocaleString()} XP`}</span></div>`
        + `<div class="note">${notes.join(' · ')}</div>`;
      const equipped = new Set(Object.values(hero.equipped));
      const n = rewards.items.length;
      const worn = rewards.items.filter((it) => equipped.has(it.id)).length;
      loot = !n ? '' : `<div class="top"><b>Loot</b><span>${n ? `${n} ${n === 1 ? 'item' : 'items'}${worn ? ` · ${worn} equipped` : ''}` : 'Nothing this time'}</span></div>`
        + rewards.items.map((it) => `<div class="item" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it, equipped.has(it.id) ? '<span class="tagE">Equipped</span>' : '', setsWorn(hero))}</div>`).join('');
    }
    $('endXp').innerHTML = xp;
    $('rewards').innerHTML = loot;
    // Phones show one line per item; the full card (stats, set bonuses) is a hold away.
    if (rewards && hero) {
      const equipped = new Set(Object.values(hero.equipped));
      const worn = setsWorn(hero);
      $('rewards').querySelectorAll<HTMLElement>('.item').forEach((el, k) => {
        const it = rewards.items[k];
        if (it) setTip(el, () => itemHtml(it, equipped.has(it.id) ? '<span class="tagE">Equipped</span>' : '', worn));
      });
    }
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
      // Six figures and up run past the box on a 320px phone, so those go compact (the hold tip has the full number).
      ['Damage', s.damageDealt >= 100_000 ? s.damageDealt.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 }) : s.damageDealt.toLocaleString(), s.damageDealt >= 100_000 ? `${s.damageDealt.toLocaleString()} damage` : ''],
    ].map(([k, v, tip]) => `<div${tip ? ` title="${tip}"` : ''}><b>${v}</b><span>${k}</span></div>`).join('');
    $('endTalents').innerHTML = (Object.keys(s.talents) as TalentId[])
      .map((id) => {
        const def = TALENTS[id];
        return `<span class="chip" style="--branch:${BRANCH_COLOR[def.branch]}" title="${(def as { tip?: string }).tip ?? def.text}">${def.name}${def.maxRank > 1 && def.maxRank < 99 ? ' ' + s.talents[id] : def.maxRank >= 99 ? ' x' + s.talents[id] : ''}</span>`;
      })
      .join('');
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
