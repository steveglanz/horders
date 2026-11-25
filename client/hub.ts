/** Title-screen hero hub: level, gear, passive points, tier select and bags. */
import {
  achievementView, brewBlocker, brewPotion, collectionOf, keyLevelOf, keysOpen, wearCosmetic,
  HeroProfile, characterOf, switchClass, lootUpgrades, equipBest, PASSIVES, PassiveId, equip, equippedItems, gearScore, heroMaxLevel, heroXpToNext, itemScore,
  grantBossReward, pointsAvailable, potionWorksIn, salvage, salvageAll, salvageAllPlan, spendPoint, gritFor,
} from '../sim/hero';
import { BossStatus, BountyBoard, KeyBoard, cloud } from './cloud';
import { POTIONS, POTION_IDS, PotionId, potionCost } from '../sim/content/potions';
import { ALT_ABILITIES, ALT_UNLOCK_LEVEL, CLASSES, CLASS_IDS } from '../sim/content/classes';
import { Item, MYTHICS, RARITY, SLOTS, Slot, WEAPON_FX } from '../sim/content/items';
import { ACHIEVEMENTS } from '../sim/content/achievements';
import { BOOK, COLLECTION_REWARDS, MYTHIC_IDS, WEAPON_FX_IDS, rewardProgress } from '../sim/content/collections';
import { SETS } from '../sim/content/sets';
import { GLOWS, SEASON, SEASONS, TRAILS, trailLabel, seasonDef, seasonLevel, seasonNumber, seasonRewards, seasonState, seasonWeeks } from '../sim/content/season';
import { SEASON_ART } from './seasonArt';
import { itemHtml, setsWorn } from './ui';
import { GRIT } from '../sim/content/scaling';
import { DUNGEONS, DUNGEON_IDS, DungeonId, partyBlocker, partyLabel } from '../sim/content/dungeon';
import { BOT_FILL, botFillBlocker, fillClasses } from '../sim/content/botfill';
import type { ClassId } from '../sim/content/emberwright';
import { OMENS, OMEN_FROM_TIER, OMEN_TUNING, OmenId, omensFor, weekOf } from '../sim/content/omens';
import { HEATS, heatApplies, heatFor } from '../sim/content/heat';
import { SEEN_KIND_NAME, seenIn, type SeenKind } from '../sim/seen';
import { BOUNTY, bountyEmbers, bountyFor, dayOf } from '../sim/content/bounty';
import { weekState, weeklyText, weeklyTitle, WEEKLY_QUESTS, type WeeklyQuest } from '../sim/content/weekly';
import { KEYS, keyEmbers, keyOmens, keyScale, keyTier } from '../sim/content/keys';
import { canTemper, canUpgrade, temperItem, upgradeItem } from '../sim/forge';
import { setTip } from './tips';
import { drawWorldBossPortrait } from './textures';
import { HELP } from '../sim/content/help';
import { BOOK_ICON, BOT_GLYPH, CLASS_ICON, glowMarkClass, MEDAL_ICON, medalTile, MYTHIC_ICON, POTION_ICON, SET_COLOR, SET_ICON, SLOT_ICON, WEAPON_FX_ICON, glyph, heatTile, omenTile, seenIcon, SEEN_GLYPH } from './icons';

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
  /** A world boss reward was claimed (an Epic): main.ts plays its chime. */
  onClaimed: () => void = () => {};
  /** Set by main: starts a Delver's Key run in the picked dungeon. */
  onKey: () => void = () => {};
  /** Set by main: the classes in your party (empty when you play alone). */
  partyClasses: string[] = [];
  /** The online party's Slagbinder stances, in partyClasses order (undefined for other classes). */
  partyStances: (string | undefined)[] = [];
  /** Fill with bots: a solo hero takes bot allies into a group dungeon (sim/content/botfill). */
  fillBots = false;
  /** Set by main: this player hosts an online party of 2 or more (V7: the host may fill with bots). */
  hosting = false;
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
    const changed = tab !== this.tab || !$('bag').hidden;
    this.tab = tab;
    if (!$('bag').hidden) $('bag').hidden = true;
    $('title').scrollTop = 0;
    this.render();
    // The new pane eases in instead of popping (phones only; see .tabswap in index.html).
    if (changed) { const t = $('title'); t.classList.remove('tabswap'); void t.offsetWidth; t.classList.add('tabswap'); }
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

  /** The gear score gain of the unseen items that beat what you wear (0 when none does). */
  private newUpgradeGain(): number {
    const h = this.hero();
    const set = new Set(this.seen[h.cls ?? 'emberwright'] ?? h.inventory.map((i) => i.id));
    return Math.round(lootUpgrades(h, h.inventory.filter((i) => !set.has(i.id))).reduce((a, u) => a + u.gain, 0));
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
    // Design (23 Nov): an unseen item that beats what you wear (the end screen's "Equip upgrade", lootUpgrades) marks
    // the tab with its gear score gain instead of a plain count, until it is worn or the bags are opened.
    const up = fresh ? this.newUpgradeGain() : 0;
    $('bagBadge').hidden = fresh === 0;
    $('bagBadge').classList.toggle('up', up > 0);
    $('bagBadge').textContent = up > 0 ? `+${up > 99 ? '99' : up}` : fresh > 9 ? '9+' : String(fresh);
    $('bagBadge').title = up > 0 ? `An upgrade to wear: gear score +${up}` : fresh ? `${fresh} new in your bags` : '';
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
      return `<button data-p="${id}" data-sfx="${can ? 'passive' : 'click'}" class="tal ${can ? 'can' : ''} ${r ? 'has' : ''}" aria-disabled="${!can}">`
        + `<span class="tn"><b>${def.name}</b><em>${r}/${def.max}</em></span><span class="te">${passiveNow(def.text, r)}</span>${can ? '<i aria-hidden="true">+</i>' : ''}</button>`;
    }).join('');
    const ci = CLASS_ICON[cls];
    const glow = h.wear?.glow ? GLOWS[h.wear.glow] : undefined;
    const worn = items.length;
    $('heroCard').innerHTML = `
      <div class="who"><span class="gtile${glow ? ' glowing' : ''}" style="--gc:${ci.color}${glow ? `;--glow:${glow.color}` : ''}"${glow ? ` title="Wearing ${glow.name}"` : ''}>${glyph(ci.d, 30)}</span>
        <div><b>${CLASSES[cls].name}</b>${h.wear?.title ? `<div class="worn-title">${h.wear.title}</div>` : ''}<div class="sub"><span class="lv">Lv ${h.level}</span><span>${CLASSES[cls].role}</span></div></div></div>
      <div class="meter" title="Hero experience"><div style="width:${xpPct}%"></div></div>
      <div class="kv"><span>${atCap ? 'Max level' : `${h.xp.toLocaleString()} / ${need.toLocaleString()} XP`}</span><span class="xp">${atCap ? '' : `${(need - h.xp).toLocaleString()} to Lv ${h.level + 1}`}</span></div>
      ${h.runs > 0 ? this.collectionButton() + this.deedsButton() : ''}
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
    $('heroCard').querySelector<HTMLButtonElement>('[data-deeds]')?.addEventListener('click', () => openSheet('Achievements', this.deedsLine()));
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
        const id = b.dataset.p as PassiveId;
        if (spendPoint(h, id)) {
          this.save();
          this.render();
          // The talent you raised flares, and its rank number ticks up.
          const t = $('heroCard').querySelector<HTMLElement>(`[data-p="${id}"]`);
          if (t) {
            t.classList.add('ranked');
            t.querySelector('em')?.classList.add('tick');
            setTimeout(() => { t.classList.remove('ranked'); t.querySelector('em')?.classList.remove('tick'); }, 900);
          }
        }
      }));

    $('classes').innerHTML = CLASS_IDS.map((id) => {
      const c = CLASSES[id];
      const ch = characterOf(h, id);
      const ic = CLASS_ICON[id];
      return `<button class="cls ${id === cls ? 'active' : ''}" style="--gc:${ic.color}" aria-pressed="${id === cls}" data-cls="${id}" title="${c.role}. ${c.blurb}">`
        + `<span class="gtile" style="width:40px;height:40px">${glyph(ic.d, 24)}</span><b>${c.name}</b><span class="cl">${ch ? `Lv ${ch.level}` : c.role}</span></button>`;
    }).join('')
      // The Slagbinder picks a stance before the run: Anvil tanks, Bellows fills a damage slot.
      + (cls === 'slagbinder'
        ? `<div class="stance" role="group" aria-label="Stance">${(['anvil', 'bellows'] as const).map((st) => {
          const on = (h.stance ?? 'bellows') === st;
          const tip = st === 'anvil' ? 'Anvil: you tank. Bosses stay on you, hits land 35% lighter (20% in a party), and Cooling Shell lasts longer. An off-tank: steady in the Hammerdeep, not yet a raid main tank.' : 'Bellows: you fill a damage slot. Plating is thicker and Interpose lasts longer. Alone, you deal 20% more damage; in a party, 30% less (15% less in the Flue).';
          return `<button data-stance="${st}" data-sfx="${st}Pick" class="${on ? 'on' : ''}" aria-pressed="${on}" title="${tip}">${st === 'anvil' ? 'Anvil · Tank' : 'Bellows · Damage'}</button>`;
        }).join('')}</div>`
        : '')
      // Ability option: from level 8, swap one action-bar slot for the class's option (kept per character).
      + (() => {
        const opt = ALT_ABILITIES[cls];
        const own = CLASSES[cls].abilities[opt.slot];
        // Before level 8 a plain note, not a button: "Muster · Lv 8" on a disabled button read as a mystery label (Steve, 25 Nov).
        if (h.level < ALT_UNLOCK_LEVEL) return `<p class="altlock" title="${opt.def.name}: ${opt.def.text}"><b>Level ${ALT_UNLOCK_LEVEL}:</b> swap ${own.name} for ${opt.def.name}</p>`;
        return `<div class="stance" role="group" aria-label="Ability option">${[false, true].map((on) => {
          const d = on ? opt.def : own;
          const sel = !!h.alt === on;
          return `<button data-alt="${on ? 1 : 0}" class="${sel ? 'on' : ''}" aria-pressed="${sel}" title="${d.name}: ${d.text}">${d.name}</button>`;
        }).join('')}</div>`;
      })();
    $('classes').querySelectorAll<HTMLButtonElement>('[data-alt]').forEach((b) =>
      b.addEventListener('click', () => {
        h.alt = b.dataset.alt === '1';
        this.save();
        this.render();
      }));
    $('classes').querySelectorAll<HTMLButtonElement>('[data-stance]').forEach((b) =>
      b.addEventListener('click', () => {
        h.stance = b.dataset.stance as 'anvil' | 'bellows';
        this.save();
        this.render();
      }));
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
    const sea = this.seasonArt();
    const dungeons = DUNGEON_IDS.map((id) => {
      const d = DUNGEONS[id];
      const featured = !!sea && sea.dungeon === id;
      const locked = h.maxTier < d.unlockTier;
      const { label } = partyLabel(id, this.members());
      return `<button data-d="${id}" class="dg ${id === this.dungeon ? 'on' : ''}${featured ? ' insea' : ''}" ${locked ? 'disabled' : ''} aria-pressed="${id === this.dungeon}"${featured ? ` style="${sea!.vars}"` : ''} title="${d.name}: ${d.blurb}${locked ? ` Unlocks at tier ${d.unlockTier}.` : ''} ${label}.${featured ? ` In season: +${SEASON.featured} marks a win.` : ''}">`
        + `${featured ? `<span class="insea-b"><i aria-hidden="true"></i>In season</span>` : ''}${locked ? `<span class="lock">Tier ${d.unlockTier} to unlock</span>` : ''}<b>${d.name}</b><span>${d.blurb}</span>`
        + `<span class="style ${d.style}">${d.style === 'group' ? `<span class="roles">${roleTile('bulwark', 14)}${roleTile('lumen', 14)}</span>` : ''}<span class="slbl">${label}</span></span></button>`;
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
      + `<div class="prep-full">${this.heatLine()}${this.omenLine(omens)}${this.potionLine()}${this.bountyLine()}${this.keyLine()}${this.weeklyLine()}${this.seasonLine()}${this.seenLine(true)}</div>`;
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        this.dungeon = b.dataset.d as DungeonId;
        this.render();
      }));
    this.bindPrep($('tiers'));
    $('tiers').querySelector<HTMLButtonElement>('[data-group]')?.addEventListener('click', () => this.go('group'));
    $('tiers').querySelector<HTMLButtonElement>('[data-fill]')?.addEventListener('click', () => {
      this.fillBots = !this.fillBots;
      this.render();
    });
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-prep]').forEach((b) =>
      b.addEventListener('click', () => this.openPrep(b.dataset.prep as 'heat' | 'omens' | 'potion' | 'bounty' | 'weekly' | 'key' | 'season' | 'seen', omens)));
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
    // Dots under the carousel say there are more delves to swipe to (QA, 23 Nov: at 360 px the next card was just cut
    // off), and which one you're looking at.
    if (dgs && dgs.scrollWidth > dgs.clientWidth + 4) {
      const cards = [...dgs.children] as HTMLElement[];
      const dots = document.createElement('div');
      dots.className = 'dg-dots';
      dots.setAttribute('aria-hidden', 'true');
      dots.innerHTML = cards.map(() => '<i></i>').join('');
      dgs.after(dots);
      const mark = () => {
        const x = dgs.scrollLeft + 24;
        let at = 0;
        cards.forEach((c, i) => { if (c.offsetLeft - dgs.offsetLeft <= x) at = i; });
        if (dgs.scrollLeft + dgs.clientWidth >= dgs.scrollWidth - 4) at = cards.length - 1;
        dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === at));
      };
      mark();
      dgs.addEventListener('scroll', mark, { passive: true });
    }
    const blocked = this.partyBlocker();
    const start = $('startBtn') as HTMLButtonElement;
    start.disabled = !!blocked;
    // A solo hero in a group dungeon: point at Fill with bots, which sits well above this button on a phone.
    start.textContent = (blocked && this.canFill() ? 'Needs a party or bots' : blocked) || `Delve · ${DUNGEONS[this.dungeon].name.replace(/^The /, '')} ${this.tier}`;
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
        const kind = b.dataset.wear as 'title' | 'glow' | 'trail';
        const id = b.dataset.id || undefined;
        if (wearCosmetic(h, kind, h.wear?.[kind] === id ? undefined : id)) {
          this.save();
          this.render();
          if (!$('sheet').hidden && $('sheet').dataset.prep === 'season') this.openPrep('season', []);
        }
      }));
    root.querySelectorAll<HTMLButtonElement>('[data-potion]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.potion as PotionId;
        if (brewPotion(h, id)) {
          this.save();
          this.render();
          if (!$('sheet').hidden && $('sheet').dataset.prep === 'potion') this.openPrep('potion', []);
          // R8: the fresh brew pours in: the flask flares and bubbles burst up out of it.
          document.querySelectorAll<HTMLElement>(`[data-potion="${id}"]`).forEach((el) => {
            el.classList.remove('poured');
            void el.offsetWidth;
            el.classList.add('poured');
          });
        }
      }));
  }

  /** Tab mode: Omens, the potion and the bounty fold into one row of chips that open sheets. */
  private prepChips(omens: OmenId[]): string {
    const h = this.hero();
    const chips: string[] = [];
    // V4: today's Heat (every solo dungeon since Phase 14 X1) gets a chip too; on phones the full line is folded away.
    const heat = this.heatToday();
    if (heat) chips.push(`<button class="prep-chip" data-prep="heat" data-sfx="open" aria-label="Today's Heat: ${heat.name}">${heatTile(heat.id, 22)}<span>${heat.name}</span></button>`);
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
    // Phase 15 Y4: the Seen log for the picked dungeon, after the first delve like the weekly quests.
    if (h.runs > 0) {
      const sn = seenIn(h, this.dungeon);
      chips.push(`<button class="prep-chip ${sn.seen === sn.total ? 'on' : ''}" data-prep="seen" data-sfx="open" aria-label="Seen log: ${sn.seen} of ${sn.total} met"><span class="star seen-eye" aria-hidden="true">${glyph(SEEN_GLYPH, 18)}</span>`
        + `<span>Seen <b>${sn.seen}/${sn.total}</b></span></button>`);
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
  private openPrep(kind: 'heat' | 'omens' | 'potion' | 'bounty' | 'weekly' | 'key' | 'season' | 'seen', omens: OmenId[]): void {
    const titles = { seen: `Seen in ${DUNGEONS[this.dungeon].name}`, heat: "Today's Heat", omens: "This week's Omens", potion: 'Potion', bounty: 'Daily bounty', weekly: 'Weekly quests', key: "Delver's Key", season: this.seasonTitle() };
    const body = kind === 'heat' ? this.heatLine().replace(/^<div class="sec-h">.*?<\/div>/, '') + '<div class="hint">A twist on this dungeon, the same for everyone. Each solo dungeon has its own, and it changes every day.</div>'
      : kind === 'omens'
      ? `<div class="omens">${(omens.length ? omens : omensFor(this.tier, weekOf(Date.now()))).map((o) => this.omenRow(o)).join('')}</div><div class="hint">Each Omen adds loot. They change every week.</div>`
      : kind === 'seen' ? this.seenLine(false)
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

  /** R7: today's bounty board by `day:tier`: undefined = not asked yet, null = unreachable (or before migration 0006). */
  private bountyBoards = new Map<string, BountyBoard | null | 'loading'>();

  /** A bounty time was submitted: fetch the boards again on the next render. */
  bountyBoardStale(): void {
    this.bountyBoards.clear();
    this.render();
  }

  /** Today's five fastest clears at this hero's bounty tier, and your rank; nothing while loading or offline. */
  private bountyBoardHtml(day: number, tier: number): string {
    const k = `${day}:${tier}`;
    const b = this.bountyBoards.get(k);
    if (b === undefined) {
      this.bountyBoards.set(k, 'loading');
      void cloud.topBounty(tier, 5).then((r) => {
        this.bountyBoards.set(k, r && Array.isArray(r.top) ? r : null);
        this.render();
      });
      return '';
    }
    if (!b || b === 'loading' || !b.top.length) return '';
    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const time = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const isMe = (r: { rank: number; name: string }) => !!b.me && r.rank === b.me.rank && r.name === b.me.name;
    const row = (r: { rank: number; name: string; seconds: number }, you = false) =>
      `<li${you ? ' class="you"' : ''}><span class="kr">${r.rank}</span><b>${esc(r.name)}</b><span class="kl"></span><span class="kt">${time(r.seconds)}</span></li>`;
    const mine = b.me && !b.top.some(isMe) ? row(b.me, true) : '';
    return `<div class="key-board"><div class="lbl">Today's fastest, tier ${tier}</div><ol>${b.top.map((r) => row(r, isMe(r))).join('')}${mine}</ol></div>`;
  }

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
    // A board per season (keys.md): the server says which season it ranks; the all-time board before 0005 has none.
    const title = typeof b.season === 'number' ? `Season ${seasonNumber(b.season)} leaderboard` : 'Leaderboard';
    const ever = this.hero().keyBest?.[d];
    const everLine = typeof b.season === 'number' && ever ? `<div class="hint muted">Your best ever: +${ever}</div>` : '';
    return `<div class="key-board"><div class="lbl">${title}</div><ol>${b.top.map((r) => row(r, !!b.me && r.rank === b.me.rank && r.name === b.me.name)).join('')}${mine}</ol>${everLine}</div>`;
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

  /** The current season's dungeon and its art colours as CSS vars, once the hero has played (as the season box). */
  private seasonArt(): { dungeon: string; vars: string; banner?: string } | undefined {
    const h = this.hero();
    if (h.runs === 0) return undefined;
    const id = seasonState(h.season, weekOf(Date.now())).id;
    const art = SEASON_ART[((id % SEASONS.length) + SEASONS.length) % SEASONS.length];
    return { dungeon: seasonDef(id).dungeon, vars: art ? `--sa:${art.accent};--sh:${art.hi};--sd:${art.deep}` : '', banner: art?.banner };
  }

  private bannerN = 0;

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
      const what = r.kind === 'glow' ? `<span class="swatch${glowMarkClass(r.glow.id)}" style="--sw:${r.glow.color}"></span>${r.glow.name}${/glow$/i.test(r.glow.name) ? '' : ' glow'}` : r.kind === 'trail' ? `<span class="swatch trail" style="--sw:${r.trail.color}"></span>${trailLabel(r.trail, r.stage)} trail` : `<span>Title: <b>${r.title}</b></span>`;
      return `<div class="sr${got ? ' got' : ''}"><span class="sr-lv">${r.level}</span><span class="sr-what">${what}</span><span class="sr-st">${got ? '✓' : ''}</span></div>`;
    }).join('');
    const titles = h.titles ?? [];
    const glows = (h.glows ?? []).map((g) => GLOWS[g]).filter(Boolean);
    const wearT = titles.map((t) => `<button class="wear${h.wear?.title === t ? ' on' : ''}" data-wear="title" data-id="${t}">${t}</button>`).join('');
    const wearG = glows.map((g) => `<button class="wear${h.wear?.glow === g.id ? ' on' : ''}" data-wear="glow" data-id="${g.id}"><span class="swatch${glowMarkClass(g.id)}" style="--sw:${g.color}"></span>${g.name}</button>`).join('');
    const trails = Object.entries(h.trails ?? {}).filter(([id]) => TRAILS[id]);
    const wearR = trails.map(([id, st]) => `<button class="wear${h.wear?.trail === id ? ' on' : ''}" data-wear="trail" data-id="${id}"><span class="swatch trail" style="--sw:${TRAILS[id].color}"></span>${trailLabel(TRAILS[id], st)}</button>`).join('');
    const sea = this.seasonArt();
    // The key art's gradient ids are made unique, since the box can be drawn twice (the hub and its sheet).
    const n = ++this.bannerN;
    const art = sea?.banner ? `<div class="kart-wrap">${sea.banner.replace(/\b(kb[A-Z]\w*)\b/g, (m) => `${m}-${n}`)}</div>` : '';
    return `<div class="box season"${sea?.vars ? ` style="${sea.vars}"` : ''}>${art}<div class="lbl">Season ${seasonNumber(st.id)}: ${def.name}<span class="wq-count">Lv ${lvl}</span></div>`
      + `<div class="wq-bar"><i style="width:${pct.toFixed(1)}%"></i></div>`
      + `<div class="kv"><span><b>Lv ${lvl}</b> · ${maxed ? 'Track complete' : `${into} / ${SEASON.marksPerLevel} marks to Lv ${lvl + 1}`}</span><span class="muted">Ends in ${end} ${end === 1 ? 'day' : 'days'}</span></div>`
      + `<div class="hint">${today ? 'First win of the day: done. Come back tomorrow for another' : `Your first win today pays <b>+${SEASON.firstWin}</b> marks`}. A win pays ${SEASON.win}, a loss ${SEASON.lossBase} plus ${SEASON.lossPerFight} a fight, each weekly quest ${SEASON.weekly}.</div>`
      + `<div class="hint">In season: <b>${DUNGEONS[def.dungeon].name}</b>, <span class="pay">+${SEASON.featured}</span> marks a win.</div>`
      + `<div class="sec-h"><span>Rewards</span><span class="muted">Looks only</span></div>${rewards}`
      + (titles.length || glows.length || trails.length ? `<div class="sec-h"><span>Wear</span><span class="muted">Tap again to take off</span></div>`
        + (titles.length ? `<div class="wears">${wearT}</div>` : '') + (glows.length ? `<div class="wears">${wearG}</div>` : '') + (trails.length ? `<div class="wears">${wearR}</div>` : '') : '')
      + `</div>`;
  }

  /** P6: the hero card's one-line Achievements button, with how many are done. */
  private deedsButton(): string {
    const n = (this.hero().achieved ?? []).length;
    return `<button class="bookbtn" data-deeds data-sfx="open"><span class="crest" aria-hidden="true">${glyph(MEDAL_ICON, 16)}</span><span>Achievements</span><b>${n}/${ACHIEVEMENTS.length}</b><i class="chev" aria-hidden="true"></i></button>`;
  }

  /** P6: every achievement with its progress, title and embers; shared by every class. */
  private deedsLine(): string {
    const h = this.hero();
    const view = achievementView(h);
    const done = new Set(h.achieved ?? []);
    const rows = ACHIEVEMENTS.map((a) => {
      const ok = done.has(a.id);
      const n = Math.min(a.need, a.have(view));
      return `<div class="wq deed${ok ? ' done' : ''}">${medalTile(a.id, ok)}<div class="wq-main">`
        + `<div class="wq-top"><b>${a.name}</b><span>${ok ? '<span class="got">Earned</span>' : `<span class="pay">+${a.embers}</span>`}</span></div>`
        + `<div class="wq-txt">${a.text}</div><div class="dtitle">Title <b>${a.title}</b></div>`
        + (a.need > 1 && !ok ? `<div class="wq-bar"><i style="width:${((100 * n) / a.need).toFixed(1)}%"></i></div><div class="wq-n">${n.toLocaleString()} / ${a.need.toLocaleString()}</div>` : '')
        + `</div></div>`;
    }).join('');
    return `<div class="box weekly deeds"><div class="lbl">Deeds <span class="wq-count">${done.size}/${ACHIEVEMENTS.length}</span></div>`
      + `<div class="deed-strip" aria-hidden="true">${ACHIEVEMENTS.map((a) => medalTile(a.id, done.has(a.id), 22)).join('')}</div>${rows}`
      + `<div class="hint">Shared by every class. Each pays its title once, plus embers to your shared purse. Wear titles from the Season sheet.</div></div>`;
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
      + `<div class="hint">Shared by every class. A find counts once it reaches your bags, even if you salvage it later. Rewards pay embers to your shared purse, which every class spends from.</div></div>`;
  }

  /** P1: this week's three quests, the same for everyone, and the title for all three. */
  private weeklyLine(): string {
    const h = this.hero();
    if (h.runs === 0) return '';
    const week = weekOf(Date.now());
    const wk = weekState(h.weekly, week, h.maxTier);
    // Each quest: a diamond that fills when done, its name and reward, what it asks, and a progress bar.
    const row = (q: WeeklyQuest) => {
      const pct = q.done ? 100 : Math.max(0, Math.min(100, (100 * q.progress) / Math.max(1, q.goal)));
      return `<div class="wq${q.done ? ' done' : ''}"><span class="pip" aria-hidden="true">${q.done ? '✓' : '◆'}</span><div class="wq-main">`
        + `<div class="wq-top"><b>${WEEKLY_QUESTS[q.id].name}</b><span>${q.done ? 'Done' : `<span class="pay">+${q.embers}</span>`}</span></div>`
        + `<div class="wq-txt">${weeklyText(q)}</div>`
        + `<div class="wq-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${q.goal}" aria-valuenow="${Math.min(q.progress, q.goal)}"><i style="width:${pct.toFixed(1)}%"></i></div>`
        + `${q.done ? '' : `<div class="wq-n">${q.progress.toLocaleString()} / ${q.goal.toLocaleString()}</div>`}</div></div>`;
    };
    const rows = wk.quests.map(row).join('');
    // The party quest: extra, outside the title. Bots don't count, so it pays for finding real heroes.
    const party = wk.party ? `<div class="lbl wq-party">Party quest</div>${row(wk.party)}<div class="hint">Bots don't count. It isn't needed for the title.</div>` : '';
    const title = weeklyTitle(week);
    const n = wk.quests.filter((q) => q.done).length;
    return `<div class="box weekly"><div class="lbl">Weekly quests <span class="wq-count">${n}/${wk.quests.length}</span></div>${rows}`
      + `<div class="wq-title${wk.titled ? ' earned' : ''}"><span class="crest" aria-hidden="true">❖</span><span>${wk.titled ? `Title earned: <b>${title}</b>` : `Finish all three for the title <b>${title}</b>`}</span></div>`
      + `${party}<div class="hint">New quests every week.</div></div>`;
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
      + `<button class="sbtn gold" data-bounty>${paid ? 'Replay bounty' : 'Take the bounty'}</button></div>${this.bountyBoardHtml(day, b.tier)}</div>`;
  }

  /** Grit after losses in a row on the picked dungeon and tier. */
  /** Alchemy: brew one potion for the next delve (not used by the daily bounty). */
  private potionLine(): string {
    const h = this.hero();
    const cards = POTION_IDS.map((id) => {
      const p = POTIONS[id];
      const on = h.potion === id;
      const why = brewBlocker(h, id);
      return `<button data-potion="${id}" data-sfx="${on ? 'select' : 'brew'}" class="pot ${on ? 'on' : ''}" ${why && !on ? 'disabled' : ''} aria-pressed="${on}" title="${why ?? ''}">`
        + `<span class="gtile" style="--gc:${POTION_ICON[id].color};width:40px;height:40px">${glyph(POTION_ICON[id].d, 26)}${on ? '<i class="bub" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></i>' : ''}</span><b>${p.name}</b><span>${p.blurb}</span><em>${on ? 'Brewed' : `${potionCost(id, h.maxTier)} embers`}</em></button>`;
    }).join('');
    const kept = h.potion && !potionWorksIn(h.potion, this.dungeon) ? ' (kept for a solo delve)' : '';
    const brewed = h.potion ? `${POTIONS[h.potion].name} ready${kept}` : 'none brewed';
    return `<div class="sec-h"><span>Potion</span><span class="muted">${brewed} · ${h.embers} embers</span></div>`
      + `<div class="pots">${cards}</div>`
      + '<div class="hint">One potion per delve, used up when you start. Brewing another pours the first away.</div>';
  }

  /** Classes in the delve: the party's, or yours plus any fill bots. */
  private classes(): string[] {
    return this.members().map((m) => m.cls);
  }

  /** The party as it would start, with Slagbinder stances (an Anvil tanks), bots included. */
  private members(): { cls: string; stance?: string }[] {
    const h = this.hero();
    const real = this.partyClasses.length
      ? this.partyClasses.map((cls, i) => ({ cls, stance: this.partyStances[i] }))
      : [{ cls: h.cls ?? 'emberwright', stance: h.stance }];
    return [...real, ...this.fillParty().map((cls) => ({ cls }))];
  }

  /**
   * Fill with bots is offered to a hero with no online party, or to the host of a party with
   * room left (V7), in a group dungeon other than the raid.
   */
  canFill(): boolean {
    const n = this.partyClasses.length;
    return (n <= 1 || (this.hosting && n < BOT_FILL.partySize)) && !botFillBlocker(this.dungeon);
  }

  /** The bot allies' classes for this delve ([] when filling is off or not offered). */
  fillParty(): ClassId[] {
    if (!this.fillBots || !this.canFill()) return [];
    const h = this.hero();
    if (this.partyClasses.length > 1) return fillClasses(this.partyClasses.map((cls, i) => ({ cls, stance: i === 0 ? h.stance : this.partyStances[i] })));
    return fillClasses([{ cls: h.cls ?? 'emberwright', stance: h.stance }]);
  }

  /** Why the picked dungeon can't start with this party, or ''. */
  partyBlocker(): string {
    return partyBlocker(this.dungeon, this.classes().length);
  }

  /** Group dungeons: which roles the party has, and what it still needs. */
  private partyLine(): string {
    if (DUNGEONS[this.dungeon].style !== 'group') return '';
    const { missing } = partyLabel(this.dungeon, this.members());
    const chip = (role: 'tank' | 'healer', cls: 'bulwark' | 'lumen', name: string): string => {
      const ok = !missing.includes(role);
      return `<span class="rolechip ${ok ? 'ok' : 'need'}" style="--gc:${CLASS_ICON[cls].color}">${roleTile(cls, 14)}${name} ${ok ? '✓' : '✗'}</span>`;
    };
    const need = missing.length ? `Needs: ${missing.map((r) => (r === 'tank' ? 'Tank' : 'Healer')).join(' and ')}. ` : '';
    // A full party has nobody left to invite.
    const hint = need + (this.classes().length >= BOT_FILL.partySize ? '' : 'Invite friends with Party, or open it to Quick join.');
    return `<div class="partyroles"><div class="chips"><span class="muted">Party</span>${chip('tank', 'bulwark', 'Tank')}${chip('healer', 'lumen', 'Healer')}</div>`
      + `${hint ? `<div class="hint">${hint.trim()}</div>` : ''}${this.fillLine()}</div>`;
  }

  /** The Fill with bots toggle, and what bots change. */
  private fillLine(): string {
    if (this.partyClasses.length > 1 && (!this.hosting || this.partyClasses.length >= BOT_FILL.partySize)) return '';
    const blocked = botFillBlocker(this.dungeon);
    if (blocked) return `<div class="hint">${blocked}: no bots.</div>`;
    const tip = `Bots fill the party to ${BOT_FILL.partySize}. They wear copies of your gear at ${Math.round(BOT_FILL.gearScale * 100)}% strength, without Mythics, weapon effects or sets, so a real party does better. A bot-filled win pays like a solo dungeon: no extra group item from the boss.`;
    return `<button class="prep-chip fillbots${this.fillBots ? ' on' : ''}" data-fill aria-pressed="${this.fillBots}" data-tip="${tip}">${glyph(BOT_GLYPH, 15)}Fill with bots${this.fillBots ? ' ✓' : ''}</button>`;
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

  /** Today's Heat when it applies to the picked dungeon and tier; never on a hero's first delve. */
  private heatToday(): (typeof HEATS)[keyof typeof HEATS] | null {
    // A hero's first delve is the fixed tutorial run, which leaves the Heat out (World.firstDelve).
    if (!heatApplies(this.dungeon, this.tier) || (this.hero().runs ?? 0) === 0) return null;
    return HEATS[heatFor(dayOf(Date.now()), this.dungeon)];
  }

  /** V4: today's Heat in the picked solo dungeon (Phase 14 X1: every solo dungeon, every tier). */
  private heatLine(): string {
    const h = this.heatToday();
    if (!h) return '';
    return `<div class="sec-h"><span>Today's Heat</span><span class="muted">New each day</span></div><div class="box omen">${heatTile(h.id)}<div><b>${h.name}</b><div>${h.text}</div></div></div>`;
  }

  /** Phase 15 Y4: what the picked dungeon can show, met or not yet, by kind (after the first delve). */
  private seenLine(heading: boolean): string {
    const h = this.hero();
    if (!h.runs) return '';
    const sn = seenIn(h, this.dungeon);
    const kinds = (Object.keys(SEEN_KIND_NAME) as SeenKind[]).filter((k) => sn.entries.some((e) => e.kind === k));
    const rows = kinds.map((k) => `<div class="seen-k">${SEEN_KIND_NAME[k]}</div><div class="seen-row">`
      + sn.entries.filter((e) => e.kind === k).map((e) => {
        // Y6: a met entry carries its own glyph (the trait's badge, the event's mark, the Heat's glyph, a crown for a boss version).
        const ic = e.seen ? seenIcon(e.kind, e.id) : null;
        return `<span class="seen-e ${e.seen ? 'met' : ''}" title="${e.seen ? e.tip : 'Not met yet'}"${ic ? ` style="--gc:${ic.color}"` : ''}>${ic ? glyph(ic.d, 14) : e.seen ? '' : '<i aria-hidden="true">?</i>'}${e.name}</span>`;
      }).join('')
      + '</div>').join('');
    return (heading ? `<div class="sec-h"><span>Seen log</span><span class="muted">${sn.seen} of ${sn.total} met</span></div>` : '')
      + `<div class="seen">${rows}</div>`
      + (heading ? '' : `<div class="hint">${sn.seen} of ${sn.total} met. Bosses, named foes, events and Heats change from run to run: keep delving to meet them all.</div>`);
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

  /** The world boss's health when the card last showed it, for the portrait's hit flash. */
  private bossSeen?: { id: number; hp: number };

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
      <div class="wb-head"><canvas class="wb-art" width="96" height="96" aria-hidden="true"></canvas><div class="wb-name">
      <div class="top"><span class="lbl">World boss</span><span>${b.fighters} ${b.fighters === 1 ? 'hero' : 'heroes'} fighting</span></div>
      <div class="ttl">${b.name}, ${b.title}</div></div></div>
      <div class="meter danger" title="${b.hp.toLocaleString()} / ${b.max_hp.toLocaleString()}"><div style="width:${pct}%"></div></div>
      <div class="kv"><span>${Math.round(pct)}% remaining<span class="wb-hpn"> · ${b.hp.toLocaleString()} health</span></span><span>You: ${b.my_damage.toLocaleString()} damage</span></div>
      ${this.bossOmenLine(b)}
      <p>Every delve you finish strikes it with the damage you dealt. When it falls, everyone who struck it gets an Epic reward.</p>
      ${claims}${this.bossNote ? `<p style="color:var(--gold)">${this.bossNote}</p>` : ''}`;
    // X2: the boss's portrait, drawn from its in-game sheet. It flashes when its health has dropped since the
    // card last showed it (a delve's strike, or everyone else's).
    const art = el.querySelector<HTMLCanvasElement>('.wb-art');
    const actx = art?.getContext('2d');
    if (art && actx && !drawWorldBossPortrait(actx, art.width, b.name)) art.remove();
    const seen = this.bossSeen;
    if (art && seen && seen.id === b.id && b.hp < seen.hp) art.classList.add('hit');
    this.bossSeen = { id: b.id, hp: b.hp };
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
      this.onClaimed();
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
    const forge = `<button class="sbtn" data-u="${it.id}" data-sfx="forge" ${up.ok ? '' : 'disabled'} title="${up.ok ? 'Raise item level by 1' : up.reason}">Upgrade<span class="cost">${up.cost}</span></button>`
      + (it.stats.length > 1 ? `<button class="sbtn" data-tm="${it.id}" data-sfx="temper" ${tm.ok ? '' : 'disabled'} title="${tm.ok ? 'Reroll the weakest bonus stat' : tm.reason}">Temper<span class="cost">${tm.cost}</span></button>` : '');
    return (isWorn ? '' : `<button class="sbtn eq" data-e="${it.id}" data-sfx="equip">Equip</button><button class="sbtn danger" data-s="${it.id}" data-sfx="salvage" title="Break it down for ${RARITY[it.rarity].salvage} embers">Salvage +${RARITY[it.rarity].salvage}</button>`) + forge;
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
    // Equip: the new piece settles into its slot, and a gear score change floats off the header.
    root.querySelectorAll<HTMLButtonElement>('[data-e]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.e!;
      const before = gearScore(h);
      equip(h, id);
      this.save();
      after(id, false);
      this.equipFlourish(id, gearScore(h) - before);
    }));
    act('[data-s]', 's', (id) => salvage(h, id), true);
    // The Forge: note the stats before the hammer falls, then light what changed on the redrawn card.
    const forged = (id: string, kind: 'up' | 'temper', fn: () => unknown): unknown => {
      const it = h.inventory.find((i) => i.id === id);
      const before = it ? it.stats.map((s) => `${s.stat}:${s.value}`) : [];
      const r = fn();
      if (r !== false && it) {
        const changed = it.stats.map((s, k) => `${s.stat}:${s.value}` !== before[k]);
        queueMicrotask(() => this.forgeFlourish(id, kind, changed));
      }
      return r;
    };
    act('[data-u]', 'u', (id) => forged(id, 'up', () => upgradeItem(h, id)));
    act('[data-tm]', 'tm', (id) => forged(id, 'temper', () => temperItem(h, id)));
  }

  /** Forge feedback on every card showing the item: a hammer flash and sparks, the item level (Upgrade) and changed stats lit. */
  private forgeFlourish(id: string, kind: 'up' | 'temper', changed: boolean[]): void {
    document.querySelectorAll<HTMLElement>(`[data-it="${id}"]`).forEach((card) => {
      card.classList.remove('forged', 'up', 'temper');
      void card.offsetWidth;
      card.classList.add('forged', kind);
      if (kind === 'up') card.querySelector('.il')?.classList.add('lit');
      card.querySelectorAll('.sv').forEach((sv, k) => { if (changed[k]) sv.classList.add('lit'); });
      if (!card.querySelector('.sparks')) {
        const sp = document.createElement('i');
        sp.className = 'sparks';
        sp.setAttribute('aria-hidden', 'true');
        sp.innerHTML = '<b></b>'.repeat(8);
        card.appendChild(sp);
      }
      setTimeout(() => { card.classList.remove('forged', 'up', 'temper'); card.querySelector('.sparks')?.remove(); }, 1400);
    });
  }

  /** Equip feedback on every tile and card showing the item, plus a gear score change on the bag's Equipped header. */
  private equipFlourish(id: string, delta: number): void {
    document.querySelectorAll<HTMLElement>(`[data-i="${id}"], [data-it="${id}"]`).forEach((el) => {
      el.classList.remove('slotin'); void el.offsetWidth; el.classList.add('slotin');
      setTimeout(() => el.classList.remove('slotin'), 900);
    });
    if (!delta) return;
    const gs = $('bagList').querySelector<HTMLElement>('.sec-h .gold');
    if (!gs) return;
    gs.classList.add('gs-host');
    const up = document.createElement('i');
    up.className = `gs-up${delta < 0 ? ' down' : ''}`;
    up.setAttribute('aria-hidden', 'true');
    up.textContent = `${delta > 0 ? '+' : ''}${delta}`;
    gs.appendChild(up);
    setTimeout(() => up.remove(), 1300);
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
    const body = `<div class="item sheet-item" data-it="${it.id}" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it, isWorn ? '<span class="tagE">Equipped</span>' : '', sets)}</div>`
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
    const plan = salvageAllPlan(h);
    const grid = !!this.tabs?.matches;
    $('bagList').classList.toggle('grid', grid);
    if (grid) {
      // Phones: icon tiles, tap one for its card and actions (docs/design/mobile-ux.md §3.4).
      const tile = (it: Item) => this.bagTile(it, worn.has(it.id));
      const wornItems = sorted.filter((i) => worn.has(i.id));
      const spare = sorted.filter((i) => !worn.has(i.id));
      $('bagList').innerHTML = `<div class="sec-h"><span>Equipped</span><span class="gold">Gear score ${gearScore(h)}</span></div>`
        + this.equipBestBtn(h)
        + (wornItems.length ? `<div class="igrid">${wornItems.map(tile).join('')}</div>` : '<div class="muted small">Nothing yet. Equip loot from your bag.</div>')
        + `<div class="sec-h"><span>Bag</span>${plan.items.length ? this.salvageAllBtn(plan) : `<span class="muted">${spare.length ? 'Tap an item · hold for stats' : ''}</span>`}</div>`
        + (spare.length ? `<div class="igrid">${spare.map(tile).join('')}</div>` : '<div class="muted small">Nothing spare. Loot drops during delves.</div>');
      $('bagList').querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => {
        const it = h.inventory.find((i) => i.id === b.dataset.i)!;
        setTip(b, () => itemHtml(it, '', wornSets));
        b.addEventListener('click', () => this.openItem(it.id));
      });
    } else {
      $('bagList').innerHTML = this.equipBestBtn(h) + (plan.items.length ? `<div class="sa-bar"><span class="muted small">${plan.items.length} spare ${plan.items.length === 1 ? 'item is' : 'items are'} no better than what you wear</span>${this.salvageAllBtn(plan)}</div>` : '') + sorted.map((it) => {
        const isWorn = worn.has(it.id);
        return `<div class="item" data-it="${it.id}" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it, isWorn ? '<span class="tagE">Equipped</span>' : '', wornSets)}<div class="acts">${this.itemActs(it, isWorn)}</div></div>`;
      }).join('') || '<div class="muted">Your bags are empty. Loot drops during delves.</div>';
      this.bindActs($('bagList'), () => this.openBag());
    }
    $('bagList').querySelector<HTMLButtonElement>('[data-sall]')?.addEventListener('click', () => this.openSalvageAll());
    $('bagList').querySelector<HTMLButtonElement>('[data-ebest]')?.addEventListener('click', () => {
      const before = gearScore(h);
      const { items } = equipBest(h);
      if (!items.length) return;
      this.save();
      this.openBag();
      this.equipFlourish(items[items.length - 1].id, gearScore(h) - before);
      for (const it of items.slice(0, -1)) this.equipFlourish(it.id, 0);
    });
    $('bag').hidden = false;
  }

  /** One bag icon tile (phones). Without a tap target it is a look-only tile, for the Salvage all list. */
  private bagTile(it: Item, isWorn: boolean, tap = true): string {
    const r = RARITY[it.rarity];
    const tag = tap ? 'button' : 'span';
    return `<${tag} class="itile${isWorn ? ' worn' : ''}"${tap ? ` data-i="${it.id}"` : ` data-ti="${it.id}" role="img"`} style="--rc:${r.color}" aria-label="${it.name}, ${r.name} ${SLOT_LABEL[it.slot]}, item level ${it.ilvl}${isWorn ? ', equipped' : ''}">`
      + `<span class="ig">${glyph(SLOT_ICON[it.slot], 26)}</span><span class="il">${it.ilvl}</span>`
      + (it.set ? `<span class="is" style="color:${SET_COLOR}">${glyph(SET_ICON[it.set], 11)}</span>` : '')
      + (isWorn ? '<span class="ie">E</span>' : '') + (tap && this.freshIds.has(it.id) ? '<i class="inew" aria-hidden="true"></i>' : '') + `</${tag}>`;
  }

  /**
   * "Equip best" (Steve, 25 Nov): one tap puts on the highest gear-score piece in every slot. Shown only while the bag
   * holds something better than what is worn, with how many pieces it puts on; green, as an upgrade is good.
   */
  private equipBestBtn(h: HeroProfile): string {
    const ups = lootUpgrades(h, h.inventory);
    if (!ups.length) return '';
    // It counts the pieces rather than a score: the header's gear score is the average item level, while upgrades are
    // picked by itemScore (the "+N" on item cards), so a score here wouldn't match what the header then shows.
    const n = ups.length;
    return `<button class="sbtn ebest" data-ebest data-sfx="open" aria-label="Equip best: ${n} ${n === 1 ? 'upgrade' : 'upgrades'}">Equip best<span class="gain">${n} ${n === 1 ? 'upgrade' : 'upgrades'}</span></button>`;
  }

  private salvageAllBtn(plan: { items: Item[]; embers: number }): string {
    return `<button class="sbtn danger sall" data-sall data-sfx="open" aria-label="Salvage all: ${plan.items.length} spare items for ${plan.embers} embers">Salvage all<span class="cost">+${plan.embers}</span></button>`;
  }

  /** Salvage all: what breaks, what it pays and what stays, then one confirm. */
  private openSalvageAll(): void {
    const h = this.hero();
    const plan = salvageAllPlan(h);
    if (!plan.items.length) { $('sheet').hidden = true; this.openBag(); return; }
    const n = plan.items.length;
    const items = [...plan.items].sort((a, b) => itemScore(b) - itemScore(a));
    const body = `<div class="sa-sum"><b>${n} ${n === 1 ? 'item' : 'items'}</b><span class="sa-pay"><i class="coin"></i>+${plan.embers}</span></div>`
      + `<div class="igrid sa-grid">${items.map((it) => this.bagTile(it, false, false)).join('')}</div>`
      + `<div class="hint">Only spares no better than what you wear in that slot${plan.kept ? `. Keeps ${plan.kept} other ${plan.kept === 1 ? 'spare' : 'spares'}` : ''}. Never breaks equipped gear, set pieces, Epics, Mythics, class weapons, upgrades or gear for an empty slot.</div>`
      + `<div class="sheet-acts"><button class="sbtn" data-sa-no data-sfx="back">Cancel</button><button class="sbtn eq sa-go" data-sa-go data-sfx="salvageAll">Salvage ${n} · +${plan.embers}</button></div>`;
    openSheet('Salvage all', body);
    const wornSets = setsWorn(h);
    $('sheetBody').querySelectorAll<HTMLElement>('[data-ti]').forEach((t) => {
      const it = items.find((i) => i.id === t.dataset.ti)!;
      setTip(t, () => itemHtml(it, '', wornSets));
    });
    $('sheetBody').querySelector('[data-sa-no]')!.addEventListener('click', () => { $('sheet').hidden = true; });
    $('sheetBody').querySelector('[data-sa-go]')!.addEventListener('click', () => {
      const before = h.embers;
      const got = salvageAll(h);
      this.save();
      $('sheet').hidden = true;
      this.openBag();
      this.emberGain(before, got.embers);
    });
  }

  /** The purse counts up and a +N floats off it after a bulk salvage. */
  private emberGain(from: number, gain: number): void {
    if (gain <= 0) return;
    const el = $('bagEmbers');
    const pill = el.closest<HTMLElement>('.pill');
    const to = from + gain;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pill) {
      pill.classList.remove('gain'); void pill.offsetWidth; pill.classList.add('gain');
      pill.querySelector('.pill-up')?.remove();
      const up = document.createElement('i');
      up.className = 'pill-up';
      up.setAttribute('aria-hidden', 'true');
      up.textContent = `+${gain}`;
      pill.appendChild(up);
      setTimeout(() => { pill.classList.remove('gain'); up.remove(); }, 1300);
    }
    if (reduce) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(from + gain * (1 - (1 - k) ** 3)).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = from.toLocaleString();
    requestAnimationFrame(step);
  }
}
