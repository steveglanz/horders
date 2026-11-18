/** Title-screen hero hub: level, gear, passive points, tier select and bags. */
import {
  HeroProfile, PASSIVES, PassiveId, equip, equippedItems, gearScore, heroMaxLevel, heroXpToNext, itemScore,
  pointsAvailable, salvage, spendPoint,
} from '../sim/hero';
import { RARITY, SLOTS, Slot } from '../sim/content/items';
import { itemHtml } from './ui';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SLOT_LABEL: Record<Slot, string> = { weapon: 'Weapon', head: 'Head', chest: 'Chest', hands: 'Hands', ring: 'Ring', trinket: 'Trinket' };

export class Hub {
  tier = 1;

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
