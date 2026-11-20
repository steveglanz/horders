/** Title-screen hero hub: level, gear, passive points, tier select and bags. */
import {
  HeroProfile, PASSIVES, PassiveId, equip, equippedItems, gearScore, heroMaxLevel, heroXpToNext, itemScore,
  grantBossReward, pointsAvailable, salvage, spendPoint, gritFor,
} from '../sim/hero';
import { BossStatus, cloud } from './cloud';
import { CLASSES, CLASS_IDS } from '../sim/content/classes';
import { RARITY, SLOTS, Slot } from '../sim/content/items';
import { itemHtml } from './ui';
import { GRIT } from '../sim/content/scaling';
import { DUNGEONS, DUNGEON_IDS, DungeonId } from '../sim/content/dungeon';
import { OMENS, OMEN_FROM_TIER, omensFor, weekOf } from '../sim/content/omens';
import { canTemper, canUpgrade, temperItem, upgradeItem } from '../sim/forge';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SLOT_LABEL: Record<Slot, string> = { weapon: 'Weapon', head: 'Head', chest: 'Chest', hands: 'Hands', ring: 'Ring', trinket: 'Trinket' };

export class Hub {
  tier = 1;
  dungeon: DungeonId = 'kiln';
  boss: BossStatus | null = null;
  bossNote = '';
  private claiming = false;

  constructor(private hero: () => HeroProfile, private save: () => void) {
    $('bagClose').addEventListener('click', () => {
      $('bag').hidden = true;
      this.render();
    });
  }

  render(): void {
    const h = this.hero();
    this.tier = Math.min(Math.max(1, this.tier), h.maxTier);
    const pts = pointsAvailable(h);
    const atCap = h.level >= heroMaxLevel();
    const xpPct = atCap ? 100 : (100 * h.xp) / heroXpToNext(h.level);
    const items = equippedItems(h);
    const gear = SLOTS.map((slot) => {
      const it = items.find((i) => i.slot === slot);
      const name = it ? `<div style="color:${RARITY[it.rarity].color}">${it.name}</div><div class="muted">ilvl ${it.ilvl}</div>` : '<div class="muted">Empty</div>';
      return `<div class="slot"><div class="sl">${SLOT_LABEL[slot]}</div>${name}</div>`;
    }).join('');
    const passives = (Object.keys(PASSIVES) as PassiveId[]).map((id) => {
      const def = PASSIVES[id];
      const r = h.passives[id] ?? 0;
      return `<button data-p="${id}" title="${def.text}" ${pts > 0 && r < def.max ? '' : 'disabled'}>${def.name} ${r}/${def.max}${pts > 0 && r < def.max ? ' +' : ''}</button>`;
    }).join('');
    const cls = h.cls ?? 'emberwright';
    $('classes').innerHTML = CLASS_IDS.map((id) => {
      const c = CLASSES[id];
      return `<button class="cls ${id === cls ? 'active' : ''}" aria-pressed="${id === cls}" data-cls="${id}"><b>${c.name}</b><div>${c.role}. ${c.blurb}</div></button>`;
    }).join('') + '<div class="cls locked"><b>Bulwark</b><div>Tank. Arrives in a later build.</div></div>';
    $('classes').querySelectorAll<HTMLButtonElement>('[data-cls]').forEach((b) =>
      b.addEventListener('click', () => {
        h.cls = b.dataset.cls as typeof cls;
        this.save();
        this.render();
      }));
    $('heroCard').innerHTML = `
      <div class="top"><b>${CLASSES[cls].name} · Level ${h.level}</b><div class="xp" title="Hero experience"><div style="width:${xpPct}%"></div></div>
        <span class="muted small" style="margin:0">Gear score ${gearScore(h)} · ${h.wins} wins / ${h.runs} delves</span></div>
      <div class="gear">${gear}</div>
      <div class="passives"><span class="muted">Talent points: ${pts}</span>${passives}<button id="bagBtn">Bags (${h.inventory.length})</button></div>`;
    $('heroCard').querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) =>
      b.addEventListener('click', () => {
        if (spendPoint(h, b.dataset.p as PassiveId)) {
          this.save();
          this.render();
        }
      }));
    $('bagBtn').addEventListener('click', () => this.openBag());

    // Dungeon picker: the Foundry unlocks once tier 4 is unlocked.
    if (h.maxTier < DUNGEONS[this.dungeon].unlockTier) this.dungeon = 'kiln';
    const dungeons = DUNGEON_IDS.map((id) => {
      const d = DUNGEONS[id];
      const locked = h.maxTier < d.unlockTier;
      return `<button data-d="${id}" class="${id === this.dungeon ? 'on' : ''}" ${locked ? 'disabled' : ''} title="${locked ? `Unlocks when you reach tier ${d.unlockTier}` : d.blurb}">${d.name}${locked ? ` (tier ${d.unlockTier})` : ''}</button>`;
    }).join('');
    const tiers: string[] = [];
    for (let t = 1; t <= h.maxTier; t++) tiers.push(`<button data-t="${t}" class="${t === this.tier ? 'on' : ''}">${t}</button>`);
    $('tiers').innerHTML = `<div class="dungeons"><span class="muted">Dungeon</span>${dungeons}</div><span class="muted">Difficulty tier</span>${tiers.join('')}${h.maxTier === 1 ? '<span class="muted small" style="margin:0">Beat the Kiln Mother to unlock tier 2</span>' : ''}${this.omenLine()}${this.gritLine()}`;
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        this.dungeon = b.dataset.d as DungeonId;
        this.render();
      }));
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tier = Number(b.dataset.t);
        this.render();
      }));
    this.renderBoss();
  }

  /** Grit after losses in a row on the picked dungeon and tier. */
  private gritLine(): string {
    const n = gritFor(this.hero(), this.dungeon, this.tier);
    if (!n) return '';
    const pct = Math.round(n * GRIT.perStack * 100);
    return `<div class="small omens" style="color:var(--gold)">Grit ×${n}: +${pct}% damage and health here until you win.</div>`;
  }

  /** This week's Omens for the picked tier, or a hint about when they start. */
  private omenLine(): string {
    const omens = omensFor(this.tier, weekOf(Date.now()));
    if (!omens.length) return this.hero().maxTier >= OMEN_FROM_TIER - 1 ? `<div class="muted small omens">From tier ${OMEN_FROM_TIER}, fights carry Omens that change each week.</div>` : '';
    return `<div class="muted small omens">This week's Omens: ${omens.map((o) => `<b title="${OMENS[o].tip}">${OMENS[o].name}</b>: ${OMENS[o].text}`).join(' ')} More loot for each Omen.</div>`;
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
      el.innerHTML = cloud.online === false
        ? '<div class="wb-top"><b>World boss</b><span class="muted">Offline</span></div><div class="muted">The shared world boss needs the online build. Your delves still count here.</div>'
        : '<div class="wb-top"><b>World boss</b><span class="muted">Looking for it…</span></div>';
      return;
    }
    const pct = Math.max(0, Math.min(100, (100 * b.hp) / b.max_hp));
    const claims = b.unclaimed.map((u) =>
      `<button class="primary" data-claim="${u.boss_id}" data-dmg="${u.damage}" ${this.claiming ? 'disabled' : ''}>Claim reward: ${u.name} fell</button>`).join('');
    el.innerHTML = `
      <div class="wb-top"><b>${b.name}, ${b.title}</b><span class="muted">World boss · ${b.fighters} ${b.fighters === 1 ? 'hero' : 'heroes'} fighting</span></div>
      <div class="wb-bar"><div style="width:${pct}%"></div><span>${b.hp.toLocaleString()} / ${b.max_hp.toLocaleString()}</span></div>
      <div class="muted">Every delve you finish strikes it with the damage you dealt. Your damage so far: <b>${b.my_damage.toLocaleString()}</b>. When it falls, everyone who struck it gets an Epic reward.</div>
      ${claims}${this.bossNote ? `<div style="margin-top:6px;color:var(--gold)">${this.bossNote}</div>` : ''}`;
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

  openBag(): void {
    const h = this.hero();
    const worn = new Set(Object.values(h.equipped));
    const sorted = [...h.inventory].sort((a, b) => (worn.has(b.id) ? 1 : 0) - (worn.has(a.id) ? 1 : 0) || itemScore(b) - itemScore(a));
    $('bagSub').textContent = `${h.inventory.length} items · ${h.embers} embers. Salvage spare gear for embers, then spend them at the Forge: Upgrade raises item level, Temper rerolls the weakest bonus stat.`;
    $('bagList').innerHTML = sorted.map((it) => {
      const isWorn = worn.has(it.id);
      const up = canUpgrade(h, it);
      const tm = canTemper(h, it);
      const forge = `<button data-u="${it.id}" ${up.ok ? '' : 'disabled'} title="${up.ok ? 'Raise item level by 1' : up.reason}">Upgrade ${up.cost}</button>`
        + (it.stats.length > 1 ? `<button data-tm="${it.id}" ${tm.ok ? '' : 'disabled'} title="${tm.ok ? 'Reroll the weakest bonus stat' : tm.reason}">Temper ${tm.cost}</button>` : '');
      const btns = (isWorn ? '<span class="tagE">Equipped</span>' : `<button data-e="${it.id}">Equip</button><button data-s="${it.id}">Salvage</button>`) + forge;
      return `<div class="item" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it)}<div class="acts">${btns}</div></div>`;
    }).join('') || '<div class="muted">Your bags are empty. Loot drops during delves.</div>';
    $('bagList').querySelectorAll<HTMLButtonElement>('[data-e]').forEach((b) =>
      b.addEventListener('click', () => { equip(h, b.dataset.e!); this.save(); this.openBag(); }));
    $('bagList').querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) =>
      b.addEventListener('click', () => { salvage(h, b.dataset.s!); this.save(); this.openBag(); }));
    $('bagList').querySelectorAll<HTMLButtonElement>('[data-u]').forEach((b) =>
      b.addEventListener('click', () => { if (upgradeItem(h, b.dataset.u!)) { this.save(); this.openBag(); } }));
    $('bagList').querySelectorAll<HTMLButtonElement>('[data-tm]').forEach((b) =>
      b.addEventListener('click', () => { if (temperItem(h, b.dataset.tm!)) { this.save(); this.openBag(); } }));
    $('bag').hidden = false;
  }
}
