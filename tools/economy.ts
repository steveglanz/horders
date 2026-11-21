// P7 economy pass: where embers come from and where they go over a run of days.
// Each day: RUNS_PER_DAY delves (bot, Kiln, climbing tiers like progression.ts) and one daily bounty.
// Weekly quests run on the real week clock (a new week every 7 days).
// POLICY=forge (salvage everything spare, Forge the lowest worn item) | draught (also brew Rising
// Draught before every delve it can afford) | hoard (salvage, spend nothing).
// DAYS=10 RUNS_PER_DAY=3 CLS=emberwright SEED_OFFSET=0
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { applyRun, brewPotion, equip, equippedItems, gritFor, itemScore, newHero, pointsAvailable, salvage, spendPoint, takePotion, PassiveId } from '../sim/hero';
import { SLOTS } from '../sim/content/items';
import { canUpgrade, maxForgeLevel, upgradeItem, upgradeCost } from '../sim/forge';
import { bountyFor } from '../sim/content/bounty';
import { potionCost } from '../sim/content/potions';
import { seasonLevel } from '../sim/content/season';

const days = Number(process.env.DAYS ?? 10);
const perDay = Number(process.env.RUNS_PER_DAY ?? 3);
const policy = process.env.POLICY ?? 'forge';
const off = Number(process.env.SEED_OFFSET ?? 0);
const h = newHero();
if (process.env.CLS) h.cls = process.env.CLS as typeof h.cls;
const order: PassiveId[] = ['might', 'fortitude', 'alacrity', 'insight'];
const src = { salvage: 0, bounty: 0, weekly: 0 };
const sink = { forge: 0, potion: 0 };
let upgrades = 0, draughts = 0, delves = 0, wins = 0, tier = 1, lossStreak = 0;
const DAY0 = 20412; // a Monday-aligned day number; week = floor(day / 7)

function play(seed: number, bounty: ReturnType<typeof bountyFor> | null, day: number): void {
  const potion = bounty ? undefined : takePotion(h);
  const opts = {
    cls: h.cls, seed, gear: equippedItems(h), passives: h.passives, heroLevel: h.level, nextItemId: h.nextItemId,
    tier: bounty ? bounty.tier : tier, week: Math.floor(day / 7), day, potion,
    grit: bounty ? 0 : gritFor(h, 'kiln', tier), firstClear: !bounty && tier >= h.maxTier,
    ...(bounty ? { dungeon: bounty.dungeon, route: [...bounty.route], omens: [bounty.twist], bounty: bounty.day } : {}),
  };
  const w = new World(opts);
  while (w.state !== 'ended' && w.time < 900) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
  const s = w.summary();
  const before = h.embers;
  const r = applyRun(h, seed, s, w.eliteKilled, w.runDrops, w.runEquipped);
  src.bounty += r.bountyEmbers ?? 0;
  src.weekly += r.weeklyEmbers ?? 0;
  void before;
  if (!bounty) {
    delves++;
    if (s.victory) { wins++; lossStreak = 0; tier = h.maxTier; } else if (++lossStreak >= 2 && tier > 1) { tier--; lossStreak = 0; }
  }
  for (const slot of SLOTS) {
    const best = h.inventory.filter((i) => i.slot === slot).sort((a, b) => itemScore(b) - itemScore(a))[0];
    if (best) equip(h, best.id);
  }
  const worn = new Set(Object.values(h.equipped));
  for (const it of [...h.inventory]) if (!worn.has(it.id)) src.salvage += salvage(h, it.id);
  const draughtCost = potionCost('risingDraught', h.maxTier);
  if (policy === 'draught' && !h.potion && brewPotion(h, 'risingDraught')) { draughts++; sink.potion += draughtCost; }
  if (policy !== 'hoard') {
    for (let g = 0; g < 50; g++) {
      const cands = equippedItems(h).filter((i) => canUpgrade(h, i).ok).sort((a, b) => a.ilvl - b.ilvl);
      if (!cands.length) break;
      const cost = upgradeCost(cands[0]);
      if (!upgradeItem(h, cands[0].id)) break;
      sink.forge += cost;
      upgrades++;
    }
  }
  let guard = 0;
  while (pointsAvailable(h) > 0 && guard++ < 20) spendPoint(h, order[guard % 4]);
}

// DETAIL=1 prints one line a day: upgrades that day, and how far worn gear sits below the Forge cap.
let upgradesBefore = 0;
for (let d = 0; d < days; d++) {
  const day = DAY0 + d;
  for (let k = 0; k < perDay; k++) play((d * 10 + k + 1 + off * 1000) * 7919, null, day);
  if (h.maxTier >= 2) play(0, bountyFor(day, h.maxTier), day);
  if (process.env.DETAIL) {
    const worn = equippedItems(h);
    const gap = worn.reduce((a, i) => a + (maxForgeLevel(h) - i.ilvl), 0) / Math.max(1, worn.length);
    console.log(`day ${d + 1}: tier ${h.maxTier}, level ${h.level}, ${upgrades - upgradesBefore} upgrades, cap ${maxForgeLevel(h)}, worn ${worn.length} items avg ${gap.toFixed(1)} below cap, embers ${h.embers}`);
    upgradesBefore = upgrades;
  }
}
const income = src.salvage + src.bounty + src.weekly;
console.log(`policy ${policy}, ${days} days × ${perDay} delves + bounty: ${delves} delves, ${wins} wins, best tier ${h.maxTier}, hero level ${h.level}`);
console.log(`embers in: ${income} (salvage ${src.salvage}, bounty ${src.bounty}, weekly ${src.weekly}); per delve ${(income / delves).toFixed(1)}`);
console.log(`embers out: forge ${sink.forge} (${upgrades} upgrades, ${(upgrades / delves).toFixed(2)} per delve), potions ${sink.potion} (${draughts} Rising Draughts of ${delves} delves)`);
console.log(`season: id ${h.season?.id}, ${h.season?.marks} marks, level ${seasonLevel(h.season?.marks ?? 0)}, glows ${(h.glows ?? []).join(' ')}`);
console.log(`left over: ${h.embers}; titles ${(h.titles ?? []).join(', ') || 'none'}`);
