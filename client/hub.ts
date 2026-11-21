/** Title-screen hero hub: level, gear, passive points, tier select and bags. */
import {
  brewBlocker, brewPotion, collectionOf, keyLevelOf, keysOpen, wearCosmetic,
  HeroProfile, characterOf, switchClass, PASSIVES, PassiveId, equip, equippedItems, gearScore, heroMaxLevel, heroXpToNext, itemScore,
  grantBossReward, pointsAvailable, salvage, spendPoint, gritFor,
} from '../sim/hero';
import { BossStatus, KeyBoard, cloud } from './cloud';
import { POTIONS, POTION_IDS, PotionId, potionCost } from '../sim/content/potions';
import { CLASSES, CLASS_IDS } from '../sim/content/classes';
import { Item, MYTHICS, RARITY, SLOTS, Slot, WEAPON_FX } from '../sim/content/items';
import { BOOK, COLLECTION_REWARDS, MYTHIC_IDS, WEAPON_FX_IDS, rewardProgress } from '../sim/content/collections';
import { SETS } from '../sim/content/sets';
import { GLOWS, SEASON, seasonDef, seasonLevel, seasonNumber, seasonRewards, seasonState, seasonWeeks } from '../sim/content/season';
import { itemHtml, setsWorn } from './ui';
import { GRIT } from '../sim/content/scaling';
import { DUNGEONS, DUNGEON_IDS, DungeonId, partyBlocker, partyLabel } from '../sim/content/dungeon';
import { OMENS, OMEN_FROM_TIER, OMEN_TUNING, OmenId, omensFor, weekOf } from '../sim/content/omens';
import { BOUNTY, bountyEmbers, bountyFor, dayOf } from '../sim/content/bounty';
import { weekState, weeklyText, weeklyTitle, WEEKLY_QUESTS } from '../sim/content/weekly';
import { KEYS, keyEmbers, keyOmens, keyScale, keyTier } from '../sim/content/keys';
import { canTemper, canUpgrade, temperItem, upgradeItem } from '../sim/forge';
import { setTip } from './tips';
import { HELP } from '../sim/content/help';
import { BOOK_ICON, CLASS_ICON, MYTHIC_ICON, POTION_ICON, SET_COLOR, SET_ICON, SLOT_ICON, WEAPON_FX_ICON, glyph, omenTile } from './icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** "+3% damage per point" at rank 4 reads "+12% damage". */
function passiveNow(text: string, rank: number): string {
  const m = /^([+-]?)(\d+(?:\.\d+)?)(%?)\s+(.*?)\s+per point$/.exec(text);
  if (!m) return text;
  if (rank === 0) return `${m[1]}${m[2]}${m[3]} ${m[4]} each`;
  const v = Math.round(Number(m[2]) * rank * 10) / 10;
  return `${m[1]}${v}${m[3]} ${m[4]}`;
}
const KIT_KEY = 'horders.ui.kit';
function readKitOpen(): boolean {
  try {
    const v = localStorage.getItem(KIT_KEY);
    if (v === '1' || v === '0') return v === '1';
  } catch { /* storage blocked */ }
  return typeof matchMedia === 'function' && matchMedia('(min-width: 900px) and (min-height: 600px)').matches;
}
/** Phones and small tablets get the tabbed hub (docs/design/mobile-ux.md §3.1); wide screens keep two columns. */
const TABS_MQ = '(max-width: 899px), (max-height: 599px)';
export type HubTab = 'delve' | 'hero' | 'bags' | 'group';
const SEEN_KEY = 'horders.ui.seen';
/** Item ids each class has already seen in its bags, for the Bags badge. */
function readSeen(): Record<string, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}
const SLOT_LABEL: Record<Slot, string> = { weapon: 'Weapon', head: 'Head', chest: 'Chest', hands: 'Hands', ring: 'Ring', trinket: 'Trinket' };

/** A role's class glyph in a small tinted tile (the Bulwark is the tank, the Lumen the healer). */
function roleTile(cls: 'bulwark' | 'lumen', size: number): string {
  const ic = CLASS_ICON[cls];
  return `<span class="gtile" style="--gc:${ic.color}">${glyph(ic.d, size)}</span>`;
}

/** The shared bottom sheet (docs/design/mobile-ux.md §3.6). Content is game data only. */
export function openSheet(title: string, html: string): void {
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  const sheet = $('sheet');
  delete sheet.dataset.prep;
  sheet.hidden = false;
}

export class Hub {
  tier = 1;
  dungeon: DungeonId = 'kiln';
  boss: BossStatus | null = null;
  bossNote = '';
  private claiming = false;
  /** Set by main: starts today's bounty run. */
  onBounty: () => void = () => {};
  /** Set by main: starts a Delver's Key run in the picked dungeon. */
  onKey: () => void = () => {};
  /** Set by main: the classes in your party (empty when you play alone). */
  partyClasses: string[] = [];
  /** Gear and talents fold into one summary row on phones; open by default on wide screens. */
  private kitOpen = readKitOpen();
  /** The open hub tab in tab mode (the Bags tab is the bag overlay). */
  tab: HubTab = 'delve';
  private tabs = typeof matchMedia === 'function' ? matchMedia(TABS_MQ) : null;
  private seen = readSeen();

  constructor(private hero: () => HeroProfile, private save: () => void) {
    const closeBag = () => {
      $('bag').hidden = true;
      this.render();
    };
    $('bagClose').addEventListener('click', closeBag);
    $('bagBack').addEventListener('click', closeBag);
    $('bagBtn').addEventListener('click', () => this.openBag());

    // Tabs: the bar shows while the hub or the bags are on screen, in tab mode only.
    const apply = () => {
      document.body.classList.toggle('tabs', !!this.tabs?.matches);
      this.render();
    };
    this.tabs?.addEventListener('change', apply);
    document.body.classList.toggle('tabs', !!this.tabs?.matches);
    $('tabbar').querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => this.go(b.dataset.tab as HubTab)));
    const follow = () => { $('tabbar').hidden = $('title').hidden && $('bag').hidden; this.syncTabbar(); };
    const mo = new MutationObserver(follow);
    mo.observe($('title'), { attributes: true, attributeFilter: ['hidden'] });
    mo.observe($('bag'), { attributes: true, attributeFilter: ['hidden'] });
    follow();
    $('heroStrip').addEventListener('click', () => this.go('hero'));

    // Settings sheet: display options, how to play, reset.
    const sheet = $('settings');
    const snd = $('bagBtn').parentElement;
    if (snd && snd !== $('title').querySelector('.hub-top')) snd.append($('setBtn'));
    $('setBtn').addEventListener('click', () => { sheet.hidden = false; });
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
    sheet.querySelector('.sheet-x')!.addEventListener('click', () => { sheet.hidden = true; });
    const gen = $('sheet');
    gen.addEventListener('click', (e) => { if (e.target === gen) gen.hidden = true; });
    gen.querySelector('.sheet-x')!.addEventListener('click', () => { gen.hidden = true; });
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!gen.hidden) gen.hidden = true;
      else if (!sheet.hidden) sheet.hidden = true;
    });
  }

  /** Opens a hub tab. Bags is the bag overlay; the others are panes of the hub. */
  go(tab: HubTab): void {
    if (tab === 'bags') {
      this.openBag();
      return;
    }
    this.tab = tab;
    if (!$('bag').hidden) $('bag').hidden = true;
    $('title').scrollTop = 0;
    this.render();
  }

  private syncTabbar(): void {
    const on: HubTab = !$('bag').hidden ? 'bags' : this.tab;
    $('tabbar').querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      const yes = b.dataset.tab === on;
      b.classList.toggle('on', yes);
      if (yes) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  /** Items in this hero's bags that the player hasn't opened the bags to see yet. */
  private newItems(): number {
    const h = this.hero();
    const key = h.cls ?? 'emberwright';
    const seen = this.seen[key];
    if (!seen) {
      // First visit with this build: everything already held counts as seen.
      this.markSeen();
      return 0;
    }
    const set = new Set(seen);
    return h.inventory.filter((i) => !set.has(i.id)).length;
  }

  private markSeen(): void {
    const h = this.hero();
    this.seen[h.cls ?? 'emberwright'] = h.inventory.map((i) => i.id);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(this.seen)); } catch { /* private mode */ }
  }

  private renderTabs(): void {
    const h = this.hero();
    $('title').querySelector<HTMLElement>('.hub')!.dataset.tab = this.tab;
    const pts = pointsAvailable(h);
    $('heroBadge').hidden = pts === 0;
    $('heroBadge').title = pts ? `${pts} talent ${pts === 1 ? 'point' : 'points'} to spend` : '';
    const fresh = $('bag').hidden ? this.newItems() : 0;
    $('bagBadge').hidden = fresh === 0;
    $('bagBadge').textContent = fresh > 9 ? '9+' : String(fresh);
    $('groupBadge').hidden = !(this.boss?.unclaimed.length);
    this.syncTabbar();
  }

  render(): void {
    const h = this.hero();
    this.tier = Math.min(Math.max(1, this.tier), h.maxTier);
    const pts = pointsAvailable(h);
    const atCap = h.level >= heroMaxLevel();
    const need = heroXpToNext(h.level);
    const xpPct = atCap ? 100 : (100 * h.xp) / need;
    const cls = h.cls ?? 'emberwright';
    $('emberCount').textContent = h.embers.toLocaleString();
    $('bagCount').textContent = String(h.inventory.length);

    // Hero card: level and XP, the six gear slots, and talent points.
    const items = equippedItems(h);
    const gear = SLOTS.map((slot) => {
      const it = items.find((i) => i.slot === slot);
      return it
        ? `<div class="slot" data-slot="${slot}" style="--rc:${RARITY[it.rarity].color}"><div class="sl"><span>${SLOT_LABEL[slot]}</span><span>${it.set ? `<span class="setmark" style="color:${SET_COLOR}" title="Set piece">${glyph(SET_ICON[it.set], 11)}</span>` : ''}${it.ilvl}</span></div><div class="nm">${it.name}</div></div>`
        : `<div class="slot empty"><div class="sl"><span>${SLOT_LABEL[slot]}</span></div><div class="nm">Empty</div></div>`;
    }).join('');
    const passives = (Object.keys(PASSIVES) as PassiveId[]).map((id) => {
      const def = PASSIVES[id];
      const r = h.passives[id] ?? 0;
      const can = pts > 0 && r < def.max;
      return `<button data-p="${id}" class="tal ${can ? 'can' : ''} ${r ? 'has' : ''}" aria-disabled="${!can}">`
        + `<span class="tn"><b>${def.name}</b><em>${r}/${def.max}</em></span><span class="te">${passiveNow(def.text, r)}</span>${can ? '<i aria-hidden="true">+</i>' : ''}</button>`;
    }).join('');
    const ci = CLASS_ICON[cls];
    const worn = items.length;
    $('heroCard').innerHTML = `
      <div class="who"><span class="gtile" style="--gc:${ci.color}">${glyph(ci.d, 30)}</span>
        <div><b>${CLASSES[cls].name}</b>${h.wear?.title ? `<div class="worn-title">${h.wear.title}</div>` : ''}<div class="sub"><span class="lv">Lv ${h.level}</span><span>${CLASSES[cls].role}</span></div></div></div>
      <div class="meter" title="Hero experience"><div style="width:${xpPct}%"></div></div>
      <div class="kv"><span>${atCap ? 'Max level' : `${h.xp.toLocaleString()} / ${need.toLocaleString()} XP`}</span><span class="xp">${atCap ? '' : `${(need - h.xp).toLocaleString()} to Lv ${h.level + 1}`}</span></div>
      ${h.runs > 0 ? this.collectionButton() : ''}
      <details class="kit" ${this.kitOpen || this.tabs?.matches ? 'open' : ''}>
        <summary><span class="ks">Gear <b>${gearScore(h)}</b></span><span class="ks">${worn}/${SLOTS.length} worn</span>`
          + `<span class="ks ${pts ? 'pts' : ''}">${pts ? `${pts} talent ${pts === 1 ? 'point' : 'points'}` : 'Talents'}</span><i class="chev" aria-hidden="true"></i></summary>
        <div class="kit-cols"><div>
        <div class="sec-h"><span>Gear</span><span class="gold">Gear score ${gearScore(h)}</span></div>
        <div class="gear">${gear}</div>
        </div><div>
        <div class="sec-h"><span>Talents</span><span class="${pts ? 'gold' : 'muted'}">${pts ? `${pts} unspent` : `${h.wins} wins / ${h.runs} delves`}</span></div>
        <div class="tal-help">${HELP.heroTalents} Hold a talent for details.</div>
        <div class="passives">${passives}</div>
        </div></div>
      </details>`;
    const worn2 = setsWorn(h);
    $('heroCard').querySelector<HTMLButtonElement>('[data-book]')?.addEventListener('click', () => openSheet('Collection', this.collectionLine()));
    $('heroCard').querySelectorAll<HTMLElement>('.slot[data-slot]').forEach((el) => {
      const it = items.find((i) => i.slot === el.dataset.slot);
      if (it) setTip(el, () => itemHtml(it, '', worn2));
    });
    // Delve tab's hero strip: class, level and XP in one row; tap for the Hero tab.
    $('heroStrip').innerHTML = `<span class="gtile" style="--gc:${ci.color}">${glyph(ci.d, 22)}</span>`
      + `<span class="hs-main"><span class="hs-name"><b>${CLASSES[cls].name}</b><span class="lv">Lv ${h.level}</span></span>`
      + `<span class="meter" style="display:block"><span style="display:block;width:${xpPct}%"></span></span></span>`
      + (pts ? `<span class="hs-pts" title="${pts} talent ${pts === 1 ? 'point' : 'points'} to spend">${pts}<span class="hs-pw"> ${pts === 1 ? 'point' : 'points'}</span></span>` : '') + '<i class="chev" aria-hidden="true"></i>';
    $('heroStrip').setAttribute('aria-label', `${CLASSES[cls].name}, level ${h.level}. Open hero`);
    const kit = $('heroCard').querySelector<HTMLDetailsElement>('details.kit')!;
    kit.addEventListener('toggle', () => {
      if (this.tabs?.matches) return;
      this.kitOpen = kit.open;
      try { localStorage.setItem(KIT_KEY, kit.open ? '1' : '0'); } catch { /* private mode: keep it for this visit */ }
    });
    $('heroCard').querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => {
      const id = b.dataset.p as PassiveId;
      const def = PASSIVES[id];
      const r = h.passives[id] ?? 0;
      setTip(b, () => `<b>${def.name}</b> · ${r}/${def.max}<br>${def.tip}<br><span class="tip-m">Now: ${r ? passiveNow(def.text, r) : 'nothing yet'}${r < def.max ? ` · next point: ${passiveNow(def.text, r + 1)}` : ' · maxed'}</span>`
        + (pts > 0 && r < def.max ? '<br><span class="tip-g">Tap to spend a point.</span>' : pts ? '' : '<br><span class="tip-m">Earn points by levelling this hero.</span>'));
    });
    $('heroCard').querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        if (spendPoint(h, b.dataset.p as PassiveId)) {
          this.save();
          this.render();
        }
      }));

    $('classes').innerHTML = CLASS_IDS.map((id) => {
      const c = CLASSES[id];
      const ch = characterOf(h, id);
      const ic = CLASS_ICON[id];
      return `<button class="cls ${id === cls ? 'active' : ''}" style="--gc:${ic.color}" aria-pressed="${id === cls}" data-cls="${id}" title="${c.role}. ${c.blurb}">`
        + `<span class="gtile" style="width:40px;height:40px">${glyph(ic.d, 24)}</span><b>${c.name}</b><span class="cl">${ch ? `Lv ${ch.level}` : c.role}</span></button>`;
    }).join('');
    $('classes').querySelectorAll<HTMLButtonElement>('[data-cls]').forEach((b) =>
      b.addEventListener('click', () => {
        // Each class is its own hero, with its own level, talents, gear and bags.
        switchClass(h, b.dataset.cls as typeof cls);
        this.tier = h.maxTier;
        this.save();
        this.render();
      }));

    // Delve setup. The Foundry unlocks once tier 4 is unlocked.
    if (h.maxTier < DUNGEONS[this.dungeon].unlockTier) this.dungeon = 'kiln';
    const dungeons = DUNGEON_IDS.map((id) => {
      const d = DUNGEONS[id];
      const locked = h.maxTier < d.unlockTier;
      const { label } = partyLabel(id, this.classes());
      return `<button data-d="${id}" class="dg ${id === this.dungeon ? 'on' : ''}" ${locked ? 'disabled' : ''} aria-pressed="${id === this.dungeon}" title="${d.name}: ${d.blurb}${locked ? ` Unlocks at tier ${d.unlockTier}.` : ''} ${label}.">`
        + `${locked ? `<span class="lock">Tier ${d.unlockTier} to unlock</span>` : ''}<b>${d.name}</b><span>${d.blurb}</span>`
        + `<span class="style ${d.style}">${d.style === 'group' ? `<span class="roles">${roleTile('bulwark', 14)}${roleTile('lumen', 14)}</span>` : ''}${label}</span></button>`;
    }).join('');
    const tiers: string[] = [];
    for (let t = 1; t <= h.maxTier; t++) tiers.push(`<button data-t="${t}" class="${t === this.tier ? 'on' : ''}" aria-pressed="${t === this.tier}">${t}</button>`);
    const omens = omensFor(this.tier, weekOf(Date.now()));
    $('tiers').innerHTML = `<div class="dungeons">${dungeons}</div>`
      // One tier unlocked: nothing to choose yet, so the row waits until tier 2 (tab mode hides it via .solo-tier).
      + `<div class="${h.maxTier === 1 ? 'solo-tier' : ''}"><div class="sec-h"><span>Difficulty</span><span class="muted">Tier ${this.tier}${omens.length ? ` · ${omens.length} ${omens.length === 1 ? 'Omen' : 'Omens'}` : ''}</span></div>`
      + `<div class="tierrow">${tiers.join('')}</div></div>`
      + (h.maxTier === 1 ? '<div class="hint">Beat the Kiln Mother to unlock tier 2.</div>' : '')
      + (h.runs === 0 ? `<div class="firstrun" data-tip="Every fight you clear is a level, a talent and a loot bag. Your hero keeps the gear."><b>New here?</b> Tap Delve to start. Drag anywhere to move; you attack on your own. Hold anything to see what it does.</div>` : '')
      + this.partyLine() + this.gritLine() + this.prepChips(omens)
      + `<div class="prep-full">${this.omenLine(omens)}${this.potionLine()}${this.bountyLine()}${this.keyLine()}${this.weeklyLine()}${this.seasonLine()}</div>`;
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        this.dungeon = b.dataset.d as DungeonId;
        this.render();
      }));
    this.bindPrep($('tiers'));
    $('tiers').querySelector<HTMLButtonElement>('[data-group]')?.addEventListener('click', () => this.go('group'));
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-prep]').forEach((b) =>
      b.addEventListener('click', () => this.openPrep(b.dataset.prep as 'omens' | 'potion' | 'bounty' | 'weekly' | 'key' | 'season', omens)));
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tier = Number(b.dataset.t);
        this.render();
      }));
    // A long tier row scrolls: keep the picked tier on screen.
    const row = $('tiers').querySelector<HTMLElement>('.tierrow');
    const on = row?.querySelector<HTMLElement>('button.on');
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollLeft += on.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - on.offsetWidth) / 2;
    // The dungeon carousel (tab mode) redraws at its start: bring the picked dungeon back into view.
    const dgs = $('tiers').querySelector<HTMLElement>('.dungeons');
    const dgOn = dgs?.querySelector<HTMLElement>('.dg.on');
    if (dgs && dgOn && dgs.scrollWidth > dgs.clientWidth) dgs.scrollLeft = dgOn.offsetLeft - dgs.offsetLeft - 16;
    const blocked = this.partyBlocker();
    const start = $('startBtn') as HTMLButtonElement;
    start.disabled = !!blocked;
    start.textContent = blocked || `Delve · ${DUNGEONS[this.dungeon].name.replace(/^The /, '')} ${this.tier}`;
    this.renderBoss();
    this.renderTabs();
  }

  /** Bounty and potion buttons, wherever they're drawn (the hub or a sheet). */
  private bindPrep(root: HTMLElement): void {
    const h = this.hero();
    root.querySelector<HTMLButtonElement>('[data-bounty]')?.addEventListener('click', () => { $('sheet').hidden = true; this.onBounty(); });
    root.querySelector<HTMLButtonElement>('[data-key]')?.addEventListener('click', () => { $('sheet').hidden = true; this.onKey(); });
    root.querySelectorAll<HTMLButtonElement>('[data-wear]').forEach((b) =>
      b.addEventListener('click', () => {
        const kind = b.dataset.wear as 'title' | 'glow';
        const id = b.dataset.id || undefined;
        if (wearCosmetic(h, kind, h.wear?.[kind] === id ? undefined : id)) {
          this.save();
          this.render();
          if (!$('sheet').hidden && $('sheet').dataset.prep === 'season') this.openPrep('season', []);
        }
      }));
    root.querySelectorAll<HTMLButtonElement>('[data-potion]').forEach((b) =>
      b.addEventListener('click', () => {
        if (brewPotion(h, b.dataset.potion as PotionId)) {
          this.save();
          this.render();
          if (!$('sheet').hidden && $('sheet').dataset.prep === 'potion') this.openPrep('potion', []);
        }
      }));
  }

  /** Tab mode: Omens, the potion and the bounty fold into one row of chips that open sheets. */
  private prepChips(omens: OmenId[]): string {
    const h = this.hero();
    const chips: string[] = [];
    if (omens.length) {
      chips.push(`<button class="prep-chip" data-prep="omens" data-sfx="open">${omenTile(omens[0], 22)}<span>${omens.length} ${omens.length === 1 ? 'Omen' : 'Omens'}</span></button>`);
    }
    const pot = h.potion ? POTION_ICON[h.potion] : null;
    // Potions cost embers, which come from salvage: the chip waits until after the first delve.
    if (h.runs > 0 || h.potion) chips.push(`<button class="prep-chip ${h.potion ? 'on' : ''}" data-prep="potion" data-sfx="open">`
      + `<span class="gtile" style="--gc:${pot ? pot.color : 'var(--muted)'};width:24px;height:24px">${glyph((pot ?? POTION_ICON[POTION_IDS[0]]).d, 16)}</span>`
      + `<span>${h.potion ? POTIONS[h.potion].name : 'Potion'}</span></button>`);
    if (h.maxTier >= BOUNTY.unlockTier) {
      const day = dayOf(Date.now());
      const paid = h.bountyDay === day;
      const b = bountyFor(day, h.maxTier);
      chips.push(`<button class="prep-chip bounty-chip" data-prep="bounty" data-sfx="open"><span class="star" aria-hidden="true">★</span>`
        + `<span>Bounty${paid ? '' : ` <b>+${bountyEmbers(b.tier)}</b>`}</span></button>`);
    }
    if (this.keyOpen()) {
      chips.push(`<button class="prep-chip" data-prep="key" data-sfx="open"><span class="star" aria-hidden="true">⚿</span>`
        + `<span>Key <b>+${keyLevelOf(h, this.dungeon)}</b></span></button>`);
    }
    // Weekly quests wait until after the first delve, like the potion.
    if (h.runs > 0) {
      const wk = weekState(h.weekly, weekOf(Date.now()), h.maxTier);
      const n = wk.quests.filter((q) => q.done).length;
      chips.push(`<button class="prep-chip ${n === wk.quests.length ? 'on' : ''}" data-prep="weekly" data-sfx="open"><span class="star" aria-hidden="true">◆</span>`
        + `<span>Weekly <b>${n}/${wk.quests.length}</b></span></button>`);
    }
    // P2: the season track, after the first delve like the weekly quests.
    if (h.runs > 0) {
      const st = seasonState(h.season, weekOf(Date.now()));
      chips.push(`<button class="prep-chip" data-prep="season" data-sfx="open"><span class="star" aria-hidden="true">✦</span>`
        + `<span>Season <b>${seasonLevel(st.marks)}</b></span></button>`);
    }
    // In a party: a chip with the head count that opens the Group tab.
    if (this.partyClasses.length > 1) {
      chips.unshift(`<button class="prep-chip on" data-group data-sfx="open"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5M15 14.6c3 .1 5.2 1.9 5.8 5.4"/></svg><span>Party <b>${this.partyClasses.length}/4</b></span></button>`);
    }
    return `<div class="prep">${chips.join('')}</div>`;
  }

  /** Opens the sheet for one prep chip. */
  private openPrep(kind: 'omens' | 'potion' | 'bounty' | 'weekly' | 'key' | 'season', omens: OmenId[]): void {
    const titles = { omens: "This week's Omens", potion: 'Potion', bounty: 'Daily bounty', weekly: 'Weekly quests', key: "Delver's Key", season: this.seasonTitle() };
    const body = kind === 'omens'
      ? `<div class="omens">${(omens.length ? omens : omensFor(this.tier, weekOf(Date.now()))).map((o) => this.omenRow(o)).join('')}</div><div class="hint">Each Omen adds loot. They change every week.</div>`
      : kind === 'potion' ? this.potionLine() : kind === 'weekly' ? this.weeklyLine() : kind === 'season' ? this.seasonLine() : kind === 'key' ? this.keyLine() : this.bountyLine();
    openSheet(titles[kind], body);
    $('sheet').dataset.prep = kind;
    this.bindPrep($('sheetBody'));
  }

  /** P3: Delver's Keys are open for this hero, in the picked dungeon, outside a party. */
  private keyOpen(): boolean {
    return keysOpen(this.hero()) && DUNGEONS[this.dungeon].style === 'solo' && this.partyClasses.length <= 1;
  }

  /** P3 leaderboards by dungeon: undefined = not asked yet, null = unreachable (or the table isn't there yet). */
  private keyBoards = new Map<string, KeyBoard | null | 'loading'>();

  /** A key was submitted: fetch that dungeon's board again on the next render. */
  keyBoardStale(dungeon: string): void {
    this.keyBoards.delete(dungeon);
    this.render();
  }

  /** The top five for the picked dungeon, and your rank; nothing while loading or offline. */
  private keyBoardHtml(): string {
    const d = this.dungeon;
    const b = this.keyBoards.get(d);
    if (b === undefined) {
      this.keyBoards.set(d, 'loading');
      void cloud.topKeys(d, 5).then((r) => {
        this.keyBoards.set(d, r && Array.isArray(r.top) ? r : null);
        if (this.dungeon === d) this.render();
      });
      return '';
    }
    if (!b || b === 'loading' || !b.top.length) return '';
    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const time = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const row = (r: { rank: number; name: string; cls: string; level: number; seconds: number }, you = false) =>
      `<li${you ? ' class="you"' : ''}><span class="kr">${r.rank}</span><b>${esc(r.name)}</b><span class="kl">+${r.level}</span><span class="kt">${time(r.seconds)}</span></li>`;
    const mine = b.me && !b.top.some((r) => r.rank === b.me!.rank && r.name === b.me!.name) ? row(b.me, true) : '';
    return `<div class="key-board"><div class="lbl">Leaderboard</div><ol>${b.top.map((r) => row(r, !!b.me && r.rank === b.me.rank && r.name === b.me.name)).join('')}${mine}</ol></div>`;
  }

  /** P3: the picked dungeon's Delver's Key: its level, what it adds, and the par time. */
  private keyLine(): string {
    if (!this.keyOpen()) return '';
    const h = this.hero();
    const level = keyLevelOf(h, this.dungeon);
    const tier = keyTier(h.maxTier);
    const om = keyOmens(tier, weekOf(Date.now()), level);
    const best = h.keyBest?.[this.dungeon];
    const sc = keyScale(level);
    const par = Math.round(KEYS.par / 60);
    const fast = Math.round((KEYS.par * KEYS.fast) / 60 * 10) / 10;
    // A key badge with its level, the run it opens, what each level adds, and how the key moves.
    return `<div class="box key"><div class="lbl">Delver's Key${best ? `<span class="key-best">Best +${best}</span>` : ''}</div>`
      + `<div class="key-head"><div class="key-badge" aria-hidden="true"><span class="kg">⚿</span><b>+${level}</b></div>`
      + `<div class="key-run"><div class="ttl">${DUNGEONS[this.dungeon].name} +${level}</div>`
      + `<div class="key-sub">Tier ${tier} · ${om.length} Omens ${om.map((o) => omenTile(o, 20)).join('')}</div></div></div>`
      + `<div class="key-stats"><span>Foe health <b>+${Math.round((sc.hp - 1) * 100)}%</b></span><span>Foe damage <b>+${Math.round((sc.dmg - 1) * 100)}%</b></span><span>Par <b>${par} min</b></span></div>`
      + `<div class="key-ladder"><span class="up2">▲▲ +2 inside ${fast} min</span><span class="up1">▲ +1 inside ${par} min</span><span class="dn">▼ −1 on a loss</span></div>`
      + `<div class="row2"><span>Win <span class="pay">+${keyEmbers(level, true)} embers</span></span><button class="sbtn gold" data-key>Use the key</button></div>`
      + `${this.keyBoardHtml()}</div>`;
  }

  /** P2: the season sheet's title, e.g. "Season 1: the Hollow Tide". */
  private seasonTitle(): string {
    const id = seasonState(this.hero().season, weekOf(Date.now())).id;
    return `Season ${seasonNumber(id)}: ${seasonDef(id).name}`;
  }

  /** P2: the season track: level, marks, the first win of the day, rewards, and what to wear. */
  private seasonLine(): string {
    const h = this.hero();
    if (h.runs === 0) return '';
    const week = weekOf(Date.now());
    const st = seasonState(h.season, week);
    const def = seasonDef(st.id);
    const lvl = seasonLevel(st.marks);
    const maxed = lvl >= SEASON.levels;
    const into = st.marks - lvl * SEASON.marksPerLevel;
    const pct = maxed ? 100 : (100 * into) / SEASON.marksPerLevel;
    const end = seasonWeeks(st.id)[1] * 7 - dayOf(Date.now());
    const today = st.firstWinDay === dayOf(Date.now());
    const rewards = seasonRewards(st.id).map((r) => {
      const got = lvl >= r.level;
      const what = r.kind === 'glow' ? `<span class="swatch" style="--sw:${r.glow.color}"></span>${r.glow.name} glow` : `Title: <b>${r.title}</b>`;
      return `<div class="sr${got ? ' got' : ''}"><span class="sr-lv">${r.level}</span><span class="sr-what">${what}</span><span class="sr-st">${got ? '✓' : ''}</span></div>`;
    }).join('');
    const titles = h.titles ?? [];
    const glows = (h.glows ?? []).map((g) => GLOWS[g]).filter(Boolean);
    const wearT = titles.map((t) => `<button class="wear${h.wear?.title === t ? ' on' : ''}" data-wear="title" data-id="${t}">${t}</button>`).join('');
    const wearG = glows.map((g) => `<button class="wear${h.wear?.glow === g.id ? ' on' : ''}" data-wear="glow" data-id="${g.id}"><span class="swatch" style="--sw:${g.color}"></span>${g.name}</button>`).join('');
    return `<div class="box season"><div class="lbl">Season ${seasonNumber(st.id)}: ${def.name}<span class="wq-count">Lv ${lvl}</span></div>`
      + `<div class="wq-bar"><i style="width:${pct.toFixed(1)}%"></i></div>`
      + `<div class="kv"><span><b>Lv ${lvl}</b> · ${maxed ? 'Track complete' : `${into} / ${SEASON.marksPerLevel} marks to Lv ${lvl + 1}`}</span><span class="muted">Ends in ${end} ${end === 1 ? 'day' : 'days'}</span></div>`
      + `<div class="hint">${today ? 'First win of the day: done. Come back tomorrow for another' : `Your first win today pays <b>+${SEASON.firstWin}</b> marks`}. A win pays ${SEASON.win}, a loss ${SEASON.lossBase} plus ${SEASON.lossPerFight} a fight, each weekly quest ${SEASON.weekly}.</div>`
      + `<div class="sec-h"><span>Rewards</span><span class="muted">Looks only</span></div>${rewards}`
      + (titles.length || glows.length ? `<div class="sec-h"><span>Wear</span><span class="muted">Tap again to take off</span></div>`
        + (titles.length ? `<div class="wears">${wearT}</div>` : '') + (glows.length ? `<div class="wears">${wearG}</div>` : '') : '')
      + `</div>`;
  }

  /** P4: the hero card's one-line Collection button, with the book's count. */
  private collectionButton(): string {
    const have = collectionOf(this.hero());
    const total = BOOK.sets.length * BOOK.sets[0].entries.length + BOOK.mythics.length + BOOK.weaponFx.length;
    const n = [...have].length;
    return `<button class="bookbtn" data-book data-sfx="open"><span class="crest" aria-hidden="true">${glyph(BOOK_ICON, 16)}</span><span>Collection</span><b>${n}/${total}</b><i class="chev" aria-hidden="true"></i></button>`;
  }

  /** P4: the collection book, shared by every class: sets, Mythics, weapon effects, and the rewards for finishing them. */
  private collectionLine(): string {
    const have = collectionOf(this.hero());
    const pip = (on: boolean, slot: Slot): string => `<span class="bk-pip${on ? ' on' : ''}" title="${SLOT_LABEL[slot]}${on ? '' : ' (not found yet)'}">${glyph(SLOT_ICON[slot as keyof typeof SLOT_ICON], 12)}${SLOT_LABEL[slot]}</span>`;
    const sets = BOOK.sets.map((st) => {
      const def = SETS[st.id];
      const n = st.entries.filter((e) => have.has(e)).length;
      return `<div class="bk-row${n === st.entries.length ? ' full' : ''}" style="--gc:${SET_COLOR}"><span class="bk-name"><span class="gtile${n ? '' : ' dim'}">${glyph(SET_ICON[st.id], 16)}</span><span><b>${def.name}</b> <span class="muted">${DUNGEONS[def.dungeon].name}</span></span></span>`
        + `<span class="bk-pips">${st.entries.map((e) => pip(have.has(e), e.split(':')[2] as Slot)).join('')}</span></div>`;
    }).join('');
    // Tiles: the glyph in its colour once found; a dim outline (the shape, not the name) until then.
    const tile = (on: boolean, color: string, d: string, name: string, cls?: string): string =>
      `<div class="bk-item${on ? ' on' : ''}" style="--gc:${color}"><span class="gtile">${glyph(d, 17)}</span><span class="bk-txt">${on ? name : '???'}`
      + `<span class="muted">${cls ? CLASSES[cls as keyof typeof CLASSES].name : 'Any class'}</span></span></div>`;
    const mythics = MYTHIC_IDS.map((m) => tile(have.has(`mythic:${m}`), RARITY.mythic.color, MYTHIC_ICON[m], MYTHICS[m].name, MYTHICS[m].cls)).join('');
    const fx = WEAPON_FX_IDS.map((f) => tile(have.has(`fx:${f}`), CLASS_ICON[WEAPON_FX[f].cls].color, WEAPON_FX_ICON[f], WEAPON_FX[f].name, WEAPON_FX[f].cls)).join('');
    const paid = new Set(this.hero().collectionPaid ?? []);
    const rewards = COLLECTION_REWARDS.map((r) => {
      const n = rewardProgress(r, have);
      const done = paid.has(r.id);
      return `<div class="wq${done ? ' done' : ''}"><span class="pip" aria-hidden="true">${done ? '✓' : '❖'}</span><div class="wq-main">`
        + `<div class="wq-top"><b>${r.name}</b><span>${done ? 'Done' : `<span class="pay">+${r.embers}</span>`}</span></div>`
        + (r.title ? `<div class="wq-txt">Title: ${r.title}</div>` : '')
        + `<div class="wq-bar"><i style="width:${((100 * n) / r.need).toFixed(1)}%"></i></div><div class="wq-n">${n} / ${r.need}</div></div></div>`;
    }).join('');
    return `<div class="box book"><div class="lbl">Sets</div>${sets}`
      + `<div class="lbl">Mythics</div><div class="bk-grid">${mythics}</div>`
      + `<div class="lbl">Weapon effects</div><div class="bk-grid">${fx}</div>`
      + `<div class="lbl">Rewards</div>${rewards}`
      + `<div class="hint">Shared by every class. A find counts once it reaches your bags, even if you salvage it later. Rewards pay embers to the class you're playing.</div></div>`;
  }

  /** P1: this week's three quests, the same for everyone, and the title for all three. */
  private weeklyLine(): string {
    const h = this.hero();
    if (h.runs === 0) return '';
    const week = weekOf(Date.now());
    const wk = weekState(h.weekly, week, h.maxTier);
    // Each quest: a diamond that fills when done, its name and reward, what it asks, and a progress bar.
    const rows = wk.quests.map((q) => {
      const pct = q.done ? 100 : Math.max(0, Math.min(100, (100 * q.progress) / Math.max(1, q.goal)));
      return `<div class="wq${q.done ? ' done' : ''}"><span class="pip" aria-hidden="true">${q.done ? '✓' : '◆'}</span><div class="wq-main">`
        + `<div class="wq-top"><b>${WEEKLY_QUESTS[q.id].name}</b><span>${q.done ? 'Done' : `<span class="pay">+${q.embers}</span>`}</span></div>`
        + `<div class="wq-txt">${weeklyText(q)}</div>`
        + `<div class="wq-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${q.goal}" aria-valuenow="${Math.min(q.progress, q.goal)}"><i style="width:${pct.toFixed(1)}%"></i></div>`
        + `${q.done ? '' : `<div class="wq-n">${q.progress.toLocaleString()} / ${q.goal.toLocaleString()}</div>`}</div></div>`;
    }).join('');
    const title = weeklyTitle(week);
    const n = wk.quests.filter((q) => q.done).length;
    return `<div class="box weekly"><div class="lbl">Weekly quests <span class="wq-count">${n}/${wk.quests.length}</span></div>${rows}`
      + `<div class="wq-title${wk.titled ? ' earned' : ''}"><span class="crest" aria-hidden="true">❖</span><span>${wk.titled ? `Title earned: <b>${title}</b>` : `Finish all three for the title <b>${title}</b>`}</span></div>`
      + `<div class="hint">New quests every week.</div></div>`;
  }

  /** Today's bounty: the same fights and twist for every player. */
  private bountyLine(): string {
    const h = this.hero();
    if (h.maxTier < BOUNTY.unlockTier) return '';
    const day = dayOf(Date.now());
    const b = bountyFor(day, h.maxTier);
    const paid = h.bountyDay === day;
    const twist = OMENS[b.twist];
    return `<div class="box bounty"><div class="lbl">Daily bounty</div>`
      + `<div class="ttl">${DUNGEONS[b.dungeon].name}, tier ${b.tier} · 3 fights</div>`
      + `<div class="tw" title="${twist.tip}">${omenTile(b.twist, 30)}<div>Twist: <b>${twist.name}</b>. ${twist.text}</div></div>`
      + `<div class="row2">${paid ? '<span class="muted">Paid today. Replay it for practice.</span>' : `<span>First win today <span class="pay">+${bountyEmbers(b.tier)} embers</span></span>`}`
      + `<button class="sbtn gold" data-bounty>${paid ? 'Replay bounty' : 'Take the bounty'}</button></div></div>`;
  }

  /** Grit after losses in a row on the picked dungeon and tier. */
  /** Alchemy: brew one potion for the next delve (not used by the daily bounty). */
  private potionLine(): string {
    const h = this.hero();
    const cards = POTION_IDS.map((id) => {
      const p = POTIONS[id];
      const on = h.potion === id;
      const why = brewBlocker(h, id);
      return `<button data-potion="${id}" class="pot ${on ? 'on' : ''}" ${why && !on ? 'disabled' : ''} aria-pressed="${on}" title="${why ?? ''}">`
        + `<span class="gtile" style="--gc:${POTION_ICON[id].color};width:40px;height:40px">${glyph(POTION_ICON[id].d, 26)}</span><b>${p.name}</b><span>${p.blurb}</span><em>${on ? 'Brewed' : `${potionCost(id, h.maxTier)} embers`}</em></button>`;
    }).join('');
    const brewed = h.potion ? `${POTIONS[h.potion].name} ready` : 'none brewed';
    return `<div class="sec-h"><span>Potion</span><span class="muted">${brewed} · ${h.embers} embers</span></div>`
      + `<div class="pots">${cards}</div>`
      + '<div class="hint">One potion per delve, used up when you start. Brewing another pours the first away.</div>';
  }

  /** Classes in the delve: the party's, or just yours. */
  private classes(): string[] {
    return this.partyClasses.length ? this.partyClasses : [this.hero().cls ?? 'emberwright'];
  }

  /** Why the picked dungeon can't start with this party, or ''. */
  partyBlocker(): string {
    return partyBlocker(this.dungeon, this.classes().length);
  }

  /** Group dungeons: which roles the party has, and what it still needs. */
  private partyLine(): string {
    if (DUNGEONS[this.dungeon].style !== 'group') return '';
    const { missing } = partyLabel(this.dungeon, this.classes());
    const chip = (role: 'tank' | 'healer', cls: 'bulwark' | 'lumen', name: string): string => {
      const ok = !missing.includes(role);
      return `<span class="rolechip ${ok ? 'ok' : 'need'}" style="--gc:${CLASS_ICON[cls].color}">${roleTile(cls, 14)}${name} ${ok ? '✓' : '✗'}</span>`;
    };
    const need = missing.length ? `Needs: ${missing.map((r) => (r === 'tank' ? 'Tank' : 'Healer')).join(' and ')}. ` : '';
    return `<div class="partyroles"><div class="chips"><span class="muted">Party</span>${chip('tank', 'bulwark', 'Tank')}${chip('healer', 'lumen', 'Healer')}</div>`
      + `<div class="hint">${need}Invite friends with Party, or open it to Quick join.</div></div>`;
  }

  private gritLine(): string {
    const n = gritFor(this.hero(), this.dungeon, this.tier);
    if (!n) return '';
    const pct = Math.round(n * GRIT.perStack * 100);
    return `<div class="grit">Grit ×${n}: +${pct}% damage and health here until you win.</div>`;
  }

  private omenRow(id: OmenId, cls = 'box omen'): string {
    const o = OMENS[id];
    return `<div class="${cls}" title="${o.tip}">${omenTile(id)}<div><b>${o.name}</b><div>${o.text}</div></div></div>`;
  }

  /** This week's Omens for the picked tier, or a hint about when they start. */
  private omenLine(omens: OmenId[]): string {
    if (!omens.length) return this.hero().maxTier >= OMEN_FROM_TIER - 1 ? `<div class="hint">From tier ${OMEN_FROM_TIER}, fights carry Omens that change each week.</div>` : '';
    return `<div class="sec-h"><span>This week's Omens</span><span class="muted">More loot for each</span></div><div class="omens">${omens.map((o) => this.omenRow(o)).join('')}</div>`;
  }

  /** The living boss's Omen, which every delve carries while it lives. */
  bossOmen(): OmenId | undefined {
    const o = this.boss?.omen;
    return cloud.online && o && o in OMENS ? (o as OmenId) : undefined;
  }

  private bossOmenLine(b: BossStatus): string {
    if (!b.omen || !(b.omen in OMENS)) return '';
    return this.omenRow(b.omen as OmenId, 'omen') + `<p>Every delve carries its Omen while it lives, for ${Math.round(OMEN_TUNING.bossOmenLuck * 100)}% more loot.</p>`;
  }

  /** Fetches the shared world boss and redraws its panel. */
  async refreshBoss(): Promise<void> {
    const b = await cloud.bossStatus();
    if (b) this.boss = b;
    this.renderBoss();
  }

  renderBoss(): void {
    const el = $('worldBoss');
    const b = this.boss;
    $('saveNote').textContent = cloud.online ? 'Your hero saves to the cloud and this browser.' : 'Your hero saves in this browser.';
    if (!b) {
      el.innerHTML = `<div class="top"><span class="lbl">World boss</span><span>${cloud.online === false ? 'Offline' : 'Looking for it…'}</span></div>`
        + (cloud.online === false ? '<p>The shared world boss needs the online build. Your delves still count here.</p>' : '');
      return;
    }
    const pct = Math.max(0, Math.min(100, (100 * b.hp) / b.max_hp));
    const claims = b.unclaimed.map((u) =>
      `<button class="primary" data-claim="${u.boss_id}" data-dmg="${u.damage}" ${this.claiming ? 'disabled' : ''}>Claim reward: ${u.name} fell</button>`).join('');
    el.innerHTML = `
      <div class="top"><span class="lbl">World boss</span><span>${b.fighters} ${b.fighters === 1 ? 'hero' : 'heroes'} fighting</span></div>
      <div class="ttl">${b.name}, ${b.title}</div>
      <div class="meter danger" title="${b.hp.toLocaleString()} / ${b.max_hp.toLocaleString()}"><div style="width:${pct}%"></div></div>
      <div class="kv"><span>${Math.round(pct)}% remaining · ${b.hp.toLocaleString()} health</span><span>You: ${b.my_damage.toLocaleString()} damage</span></div>
      ${this.bossOmenLine(b)}
      <p>Every delve you finish strikes it with the damage you dealt. When it falls, everyone who struck it gets an Epic reward.</p>
      ${claims}${this.bossNote ? `<p style="color:var(--gold)">${this.bossNote}</p>` : ''}`;
    $('groupBadge').hidden = !b.unclaimed.length;
    // Tab mode hides the card's explanations (CSS); a long press on the card shows them.
    const om = b.omen && b.omen in OMENS ? OMENS[b.omen as OmenId] : undefined;
    setTip(el, () => `<b>${b.name}</b><br>Every delve you finish strikes it with the damage you dealt. When it falls, everyone who struck it gets an Epic reward.`
      + (om ? `<br><span class="tip-m">While it lives, every delve carries ${om.name} for ${Math.round(OMEN_TUNING.bossOmenLuck * 100)}% more loot.</span>` : ''));
    el.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) =>
      btn.addEventListener('click', () => void this.claim(Number(btn.dataset.claim))));
  }

  private async claim(bossId: number): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    this.renderBoss();
    const r = await cloud.claim(bossId);
    this.claiming = false;
    if (r?.ok) {
      const reward = grantBossReward(this.hero(), bossId, r.damage ?? 0);
      this.save();
      this.bossNote = `Reward claimed: ${reward.item.name} and ${reward.embers} embers. Check your bags.`;
      this.render();
    } else {
      this.bossNote = r ? 'That reward was already claimed.' : 'Could not reach the server. Try again in a moment.';
    }
    await this.refreshBoss();
  }

  /** Items new since the bags were last opened, kept while the bag stays open. */
  private freshIds = new Set<string>();

  /** Equip, Salvage, Upgrade and Temper buttons for one item. */
  private itemActs(it: Item, isWorn: boolean): string {
    const h = this.hero();
    const up = canUpgrade(h, it);
    const tm = canTemper(h, it);
    const forge = `<button class="sbtn" data-u="${it.id}" ${up.ok ? '' : 'disabled'} title="${up.ok ? 'Raise item level by 1' : up.reason}">Upgrade<span class="cost">${up.cost}</span></button>`
      + (it.stats.length > 1 ? `<button class="sbtn" data-tm="${it.id}" ${tm.ok ? '' : 'disabled'} title="${tm.ok ? 'Reroll the weakest bonus stat' : tm.reason}">Temper<span class="cost">${tm.cost}</span></button>` : '');
    return (isWorn ? '' : `<button class="sbtn eq" data-e="${it.id}">Equip</button><button class="sbtn danger" data-s="${it.id}" title="Break it down for ${RARITY[it.rarity].salvage} embers">Salvage +${RARITY[it.rarity].salvage}</button>`) + forge;
  }

  /** Wires item action buttons under root; after() runs once the hero changed. */
  private bindActs(root: HTMLElement, after: (id: string, gone: boolean) => void): void {
    const h = this.hero();
    const act = (sel: string, key: string, fn: (id: string) => unknown, gone = false) =>
      root.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset[key]!;
        if (fn(id) === false) return;
        this.save();
        after(id, gone);
      }));
    act('[data-e]', 'e', (id) => equip(h, id));
    act('[data-s]', 's', (id) => salvage(h, id), true);
    act('[data-u]', 'u', (id) => upgradeItem(h, id));
    act('[data-tm]', 'tm', (id) => temperItem(h, id));
  }

  /** Phones: one item's full card, what you wear in that slot, and its actions, in a sheet. */
  private openItem(id: string): void {
    const h = this.hero();
    const it = h.inventory.find((i) => i.id === id);
    if (!it) { $('sheet').hidden = true; return; }
    const wornIds = new Set(Object.values(h.equipped));
    const isWorn = wornIds.has(it.id);
    const sets = setsWorn(h);
    const cur = isWorn ? undefined : equippedItems(h).find((i) => i.slot === it.slot);
    const body = `<div class="item sheet-item" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it, isWorn ? '<span class="tagE">Equipped</span>' : '', sets)}</div>`
      + (cur ? `<div class="sec-h"><span>Wearing now</span><span class="muted">Gear score ${itemScore(it) >= itemScore(cur) ? `<b class="up">+${Math.round(itemScore(it) - itemScore(cur))}</b>` : `<b class="down">${Math.round(itemScore(it) - itemScore(cur))}</b>`}</span></div>`
        + `<div class="item sheet-item cur" style="--rc:${RARITY[cur.rarity].color}">${itemHtml(cur, '', sets)}</div>` : '')
      + `<div class="sheet-acts">${this.itemActs(it, isWorn)}</div>`
      + '<div class="hint">Upgrade raises item level. Temper rerolls the weakest bonus stat. Salvage breaks spare gear into embers.</div>';
    openSheet(SLOT_LABEL[it.slot], body);
    $('sheet').dataset.item = it.id;
    this.bindActs($('sheetBody'), (done, gone) => {
      this.openBag();
      if (gone) $('sheet').hidden = true;
      else this.openItem(done);
    });
  }

  openBag(): void {
    const h = this.hero();
    if ($('bag').hidden) {
      const key = h.cls ?? 'emberwright';
      const seen = new Set(this.seen[key] ?? h.inventory.map((i) => i.id));
      this.freshIds = new Set(h.inventory.filter((i) => !seen.has(i.id)).map((i) => i.id));
    }
    this.markSeen();
    $('bagBadge').hidden = true;
    const worn = new Set(Object.values(h.equipped));
    const sorted = [...h.inventory].sort((a, b) => (worn.has(b.id) ? 1 : 0) - (worn.has(a.id) ? 1 : 0) || itemScore(b) - itemScore(a));
    $('bagSub').textContent = `${h.inventory.length} ${h.inventory.length === 1 ? 'item' : 'items'} · ${worn.size} equipped`;
    $('bagEmbers').textContent = h.embers.toLocaleString();
    const wornSets = setsWorn(h);
    const grid = !!this.tabs?.matches;
    $('bagList').classList.toggle('grid', grid);
    if (grid) {
      // Phones: icon tiles, tap one for its card and actions (docs/design/mobile-ux.md §3.4).
      const tile = (it: Item) => {
        const r = RARITY[it.rarity];
        return `<button class="itile${worn.has(it.id) ? ' worn' : ''}" data-i="${it.id}" style="--rc:${r.color}" aria-label="${it.name}, ${r.name} ${SLOT_LABEL[it.slot]}, item level ${it.ilvl}${worn.has(it.id) ? ', equipped' : ''}">`
          + `<span class="ig">${glyph(SLOT_ICON[it.slot], 26)}</span><span class="il">${it.ilvl}</span>`
          + (it.set ? `<span class="is" style="color:${SET_COLOR}">${glyph(SET_ICON[it.set], 11)}</span>` : '')
          + (worn.has(it.id) ? '<span class="ie">E</span>' : '') + (this.freshIds.has(it.id) ? '<i class="inew" aria-hidden="true"></i>' : '') + '</button>';
      };
      const wornItems = sorted.filter((i) => worn.has(i.id));
      const spare = sorted.filter((i) => !worn.has(i.id));
      $('bagList').innerHTML = `<div class="sec-h"><span>Equipped</span><span class="gold">Gear score ${gearScore(h)}</span></div>`
        + (wornItems.length ? `<div class="igrid">${wornItems.map(tile).join('')}</div>` : '<div class="muted small">Nothing yet. Equip loot from your bag.</div>')
        + `<div class="sec-h"><span>Bag</span><span class="muted">${spare.length ? 'Tap an item · hold for stats' : ''}</span></div>`
        + (spare.length ? `<div class="igrid">${spare.map(tile).join('')}</div>` : '<div class="muted small">Nothing spare. Loot drops during delves.</div>');
      $('bagList').querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => {
        const it = h.inventory.find((i) => i.id === b.dataset.i)!;
        setTip(b, () => itemHtml(it, '', wornSets));
        b.addEventListener('click', () => this.openItem(it.id));
      });
    } else {
      $('bagList').innerHTML = sorted.map((it) => {
        const isWorn = worn.has(it.id);
        return `<div class="item" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it, isWorn ? '<span class="tagE">Equipped</span>' : '', wornSets)}<div class="acts">${this.itemActs(it, isWorn)}</div></div>`;
      }).join('') || '<div class="muted">Your bags are empty. Loot drops during delves.</div>';
      this.bindActs($('bagList'), () => this.openBag());
    }
    $('bag').hidden = false;
  }
}
