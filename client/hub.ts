/** Title-screen hero hub: level, gear, passive points, tier select and bags. */
import {
  brewBlocker, brewPotion,
  HeroProfile, characterOf, switchClass, PASSIVES, PassiveId, equip, equippedItems, gearScore, heroMaxLevel, heroXpToNext, itemScore,
  grantBossReward, pointsAvailable, salvage, spendPoint, gritFor,
} from '../sim/hero';
import { BossStatus, cloud } from './cloud';
import { POTIONS, POTION_IDS, PotionId } from '../sim/content/potions';
import { CLASSES, CLASS_IDS } from '../sim/content/classes';
import { RARITY, SLOTS, Slot } from '../sim/content/items';
import { itemHtml, setsWorn } from './ui';
import { GRIT } from '../sim/content/scaling';
import { DUNGEONS, DUNGEON_IDS, DungeonId, partyBlocker, partyLabel } from '../sim/content/dungeon';
import { OMENS, OMEN_FROM_TIER, OMEN_TUNING, OmenId, omensFor, weekOf } from '../sim/content/omens';
import { BOUNTY, bountyEmbers, bountyFor, dayOf } from '../sim/content/bounty';
import { canTemper, canUpgrade, temperItem, upgradeItem } from '../sim/forge';
import { CLASS_ICON, POTION_ICON, SET_COLOR, SET_ICON, glyph, omenTile } from './icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const KIT_KEY = 'horders.ui.kit';
function readKitOpen(): boolean {
  try {
    const v = localStorage.getItem(KIT_KEY);
    if (v === '1' || v === '0') return v === '1';
  } catch { /* storage blocked */ }
  return typeof matchMedia === 'function' && matchMedia('(min-width: 900px) and (min-height: 600px)').matches;
}
const SLOT_LABEL: Record<Slot, string> = { weapon: 'Weapon', head: 'Head', chest: 'Chest', hands: 'Hands', ring: 'Ring', trinket: 'Trinket' };

/** A role's class glyph in a small tinted tile (the Bulwark is the tank, the Lumen the healer). */
function roleTile(cls: 'bulwark' | 'lumen', size: number): string {
  const ic = CLASS_ICON[cls];
  return `<span class="gtile" style="--gc:${ic.color}">${glyph(ic.d, size)}</span>`;
}

export class Hub {
  tier = 1;
  dungeon: DungeonId = 'kiln';
  boss: BossStatus | null = null;
  bossNote = '';
  private claiming = false;
  /** Set by main: starts today's bounty run. */
  onBounty: () => void = () => {};
  /** Set by main: the classes in your party (empty when you play alone). */
  partyClasses: string[] = [];
  /** Gear and talents fold into one summary row on phones; open by default on wide screens. */
  private kitOpen = readKitOpen();

  constructor(private hero: () => HeroProfile, private save: () => void) {
    const closeBag = () => {
      $('bag').hidden = true;
      this.render();
    };
    $('bagClose').addEventListener('click', closeBag);
    $('bagBack').addEventListener('click', closeBag);
    $('bagBtn').addEventListener('click', () => this.openBag());
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
        ? `<div class="slot" style="--rc:${RARITY[it.rarity].color}" title="${RARITY[it.rarity].name}"><div class="sl"><span>${SLOT_LABEL[slot]}</span><span>${it.set ? `<span class="setmark" style="color:${SET_COLOR}" title="Set piece">${glyph(SET_ICON[it.set], 11)}</span>` : ''}${it.ilvl}</span></div><div class="nm">${it.name}</div></div>`
        : `<div class="slot empty"><div class="sl"><span>${SLOT_LABEL[slot]}</span></div><div class="nm">Empty</div></div>`;
    }).join('');
    const passives = (Object.keys(PASSIVES) as PassiveId[]).map((id) => {
      const def = PASSIVES[id];
      const r = h.passives[id] ?? 0;
      const can = pts > 0 && r < def.max;
      return `<button data-p="${id}" class="${can ? 'can' : ''}" title="${def.text}" ${can ? '' : 'disabled'}>${def.name} ${r}/${def.max}${can ? ' +' : ''}</button>`;
    }).join('');
    const ci = CLASS_ICON[cls];
    const worn = items.length;
    $('heroCard').innerHTML = `
      <div class="who"><span class="gtile" style="--gc:${ci.color}">${glyph(ci.d, 30)}</span>
        <div><b>${CLASSES[cls].name}</b><div class="sub"><span class="lv">Lv ${h.level}</span><span>${CLASSES[cls].role}</span></div></div></div>
      <div class="meter" title="Hero experience"><div style="width:${xpPct}%"></div></div>
      <div class="kv"><span>${atCap ? 'Max level' : `${h.xp.toLocaleString()} / ${need.toLocaleString()} XP`}</span><span class="xp">${atCap ? '' : `${(need - h.xp).toLocaleString()} to Lv ${h.level + 1}`}</span></div>
      <details class="kit" ${this.kitOpen ? 'open' : ''}>
        <summary><span class="ks">Gear <b>${gearScore(h)}</b></span><span class="ks">${worn}/${SLOTS.length} worn</span>`
          + `<span class="ks ${pts ? 'pts' : ''}">${pts ? `${pts} talent ${pts === 1 ? 'point' : 'points'}` : 'Talents'}</span><i class="chev" aria-hidden="true"></i></summary>
        <div class="sec-h"><span>Gear</span><span class="gold">Gear score ${gearScore(h)}</span></div>
        <div class="gear">${gear}</div>
        <div class="sec-h"><span>Talents</span><span class="${pts ? 'gold' : 'muted'}">${pts ? `${pts} unspent` : `${h.wins} wins / ${h.runs} delves`}</span></div>
        <div class="passives">${passives}</div>
      </details>`;
    const kit = $('heroCard').querySelector<HTMLDetailsElement>('details.kit')!;
    kit.addEventListener('toggle', () => {
      this.kitOpen = kit.open;
      try { localStorage.setItem(KIT_KEY, kit.open ? '1' : '0'); } catch { /* private mode: keep it for this visit */ }
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
      return `<button data-d="${id}" class="dg ${id === this.dungeon ? 'on' : ''}" ${locked ? 'disabled' : ''} aria-pressed="${id === this.dungeon}">`
        + `${locked ? `<span class="lock">Tier ${d.unlockTier} to unlock</span>` : ''}<b>${d.name}</b><span>${d.blurb}</span>`
        + `<span class="style ${d.style}">${d.style === 'group' ? `<span class="roles">${roleTile('bulwark', 14)}${roleTile('lumen', 14)}</span>` : ''}${label}</span></button>`;
    }).join('');
    const tiers: string[] = [];
    for (let t = 1; t <= h.maxTier; t++) tiers.push(`<button data-t="${t}" class="${t === this.tier ? 'on' : ''}" aria-pressed="${t === this.tier}">${t}</button>`);
    const omens = omensFor(this.tier, weekOf(Date.now()));
    $('tiers').innerHTML = `<div class="dungeons">${dungeons}</div>`
      + `<div class="sec-h"><span>Difficulty</span><span class="muted">Tier ${this.tier}${omens.length ? ` · ${omens.length} ${omens.length === 1 ? 'Omen' : 'Omens'}` : ''}</span></div>`
      + `<div class="tierrow">${tiers.join('')}</div>`
      + (h.maxTier === 1 ? '<div class="hint">Beat the Kiln Mother to unlock tier 2.</div>' : '')
      + this.partyLine() + this.omenLine(omens) + this.gritLine() + this.potionLine() + this.bountyLine();
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        this.dungeon = b.dataset.d as DungeonId;
        this.render();
      }));
    $('tiers').querySelector<HTMLButtonElement>('[data-bounty]')?.addEventListener('click', () => this.onBounty());
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-potion]').forEach((b) =>
      b.addEventListener('click', () => {
        if (brewPotion(h, b.dataset.potion as PotionId)) {
          this.save();
          this.render();
        }
      }));
    $('tiers').querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tier = Number(b.dataset.t);
        this.render();
      }));
    // A long tier row scrolls: keep the picked tier on screen.
    const row = $('tiers').querySelector<HTMLElement>('.tierrow');
    const on = row?.querySelector<HTMLElement>('button.on');
    if (row && on && row.scrollWidth > row.clientWidth) row.scrollLeft += on.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - on.offsetWidth) / 2;
    const blocked = this.partyBlocker();
    const start = $('startBtn') as HTMLButtonElement;
    start.disabled = !!blocked;
    start.textContent = blocked || `Delve · ${DUNGEONS[this.dungeon].name.replace(/^The /, '')} ${this.tier}`;
    this.renderBoss();
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
        + `<span class="gtile" style="--gc:${POTION_ICON[id].color};width:40px;height:40px">${glyph(POTION_ICON[id].d, 26)}</span><b>${p.name}</b><span>${p.blurb}</span><em>${on ? 'Brewed' : `${p.cost} embers`}</em></button>`;
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
    $('bagSub').textContent = `${h.inventory.length} ${h.inventory.length === 1 ? 'item' : 'items'} · ${worn.size} equipped`;
    $('bagEmbers').textContent = h.embers.toLocaleString();
    const wornSets = setsWorn(h);
    $('bagList').innerHTML = sorted.map((it) => {
      const isWorn = worn.has(it.id);
      const up = canUpgrade(h, it);
      const tm = canTemper(h, it);
      const forge = `<button class="sbtn" data-u="${it.id}" ${up.ok ? '' : 'disabled'} title="${up.ok ? 'Raise item level by 1' : up.reason}">Upgrade<span class="cost">${up.cost}</span></button>`
        + (it.stats.length > 1 ? `<button class="sbtn" data-tm="${it.id}" ${tm.ok ? '' : 'disabled'} title="${tm.ok ? 'Reroll the weakest bonus stat' : tm.reason}">Temper<span class="cost">${tm.cost}</span></button>` : '');
      const btns = (isWorn ? '' : `<button class="sbtn eq" data-e="${it.id}">Equip</button><button class="sbtn danger" data-s="${it.id}" title="Break it down for ${RARITY[it.rarity].salvage} embers">Salvage +${RARITY[it.rarity].salvage}</button>`) + forge;
      return `<div class="item" style="--rc:${RARITY[it.rarity].color}">${itemHtml(it, isWorn ? '<span class="tagE">Equipped</span>' : '', wornSets)}<div class="acts">${btns}</div></div>`;
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
