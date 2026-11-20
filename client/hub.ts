/** Title-screen hero hub: level, gear, passive points, tier select and bags. */
import {
  HeroProfile, PASSIVES, PassiveId, equip, equippedItems, gearScore, heroMaxLevel, heroXpToNext, itemScore,
  grantBossReward, pointsAvailable, salvage, spendPoint,
} from '../sim/hero';
import { BossStatus, cloud } from './cloud';
import { RARITY, SLOTS, Slot } from '../sim/content/items';
import { itemHtml } from './ui';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SLOT_LABEL: Record<Slot, string> = { weapon: 'Weapon', head: 'Head', chest: 'Chest', hands: 'Hands', ring: 'Ring', trinket: 'Trinket' };

export class Hub {
  tier = 1;
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
    $('heroCard').innerHTML = `
      <div class="top"><b>Emberwright · Level ${h.level}</b><div class="xp" title="Hero experience"><div style="width:${xpPct}%"></div></div>
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

    const tiers: string[] = [];
    for (let t = 1; t <= h.maxTier; t++) tiers.push(`<button data-t="${t}" class="${t === this.tier ? 'on' : ''}">${t}</button>`);
    $('tiers').innerHTML = `<span class="muted">Difficulty tier</span>${tiers.join('')}${h.maxTier === 1 ? '<span class="muted small" style="margin:0">Beat the Kiln Mother to unlock tier 2</span>' : ''}`;
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tier = Number(b.dataset.t);
        this.render();
      }));
    this.renderBoss();
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
    $('bagSub').textContent = `${h.inventory.length} items · ${h.embers} embers from salvage. Salvage turns spare gear into embers.`;
    $('bagList').innerHTML = sorted.map((it) => {
      const isWorn = worn.has(it.id);
      const btns = isWorn ? '<span class="tagE">Equipped</span>' : `<button data-e="${it.id}">Equip</button><button data-s="${it.id}">Salvage</button>`;
      return `<div class="item" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it)}${btns}</div>`;
    }).join('') || '<div class="muted">Your bags are empty. Loot drops during delves.</div>';
    $('bagList').querySelectorAll<HTMLButtonElement>('[data-e]').forEach((b) =>
      b.addEventListener('click', () => { equip(h, b.dataset.e!); this.save(); this.openBag(); }));
    $('bagList').querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) =>
      b.addEventListener('click', () => { salvage(h, b.dataset.s!); this.save(); this.openBag(); }));
    $('bag').hidden = false;
  }
}
