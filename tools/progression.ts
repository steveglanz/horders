import { mkdirSync, writeFileSync } from 'fs';
// Plays 40 consecutive runs with the autopilot, carrying hero progress between them.
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { applyRun, equip, equippedItems, gearScore, itemScore, newHero, pointsAvailable, spendPoint, PassiveId } from '../sim/hero';
import { SLOTS } from '../sim/content/items';
import { salvage, gritFor } from '../sim/hero';
import { canUpgrade, upgradeItem } from '../sim/forge';

// FORGE=0 skips salvage and the Forge, for before/after comparisons.
const useForge = process.env.FORGE !== '0';
const runs = Number(process.env.RUNS ?? 50);
let forgedTotal = 0;
let streak = 0;
let worstStreak = 0;

const h = newHero();
// SNAP=4,6 writes the hero to SNAP_DIR/hero-t<N>.json the first time that tier unlocks (a geared reference hero for balance tools).
const snaps = new Set((process.env.SNAP ?? '').split(',').filter(Boolean).map(Number));
const snapDir = process.env.SNAP_DIR ?? 'tools/heroes';
const order: PassiveId[] = ['might', 'fortitude', 'alacrity', 'insight'];
let wins = 0;
let tier = 1;
let lossStreak = 0;
for (let run = 1; run <= runs; run++) {
  const w = new World({ cls: (process.env.CLS as 'emberwright') ?? undefined, seed: run * 7919, gear: equippedItems(h), passives: h.passives, heroLevel: h.level, nextItemId: h.nextItemId, tier, week: Number(process.env.WEEK ?? 0), omens: process.env.NO_OMENS ? [] : undefined, grit: process.env.NO_GRIT ? 0 : gritFor(h, 'kiln', tier) });
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
  const s = w.summary();
  const r = applyRun(h, run * 7919, s, w.eliteKilled, w.runDrops, w.runEquipped);
  if (s.victory) streak = 0; else worstStreak = Math.max(worstStreak, ++streak);
  if (s.victory) { wins++; lossStreak = 0; tier = h.maxTier; } else if (++lossStreak >= 2 && tier > 1) { tier--; lossStreak = 0; }
  for (const slot of SLOTS) {
    const best = h.inventory.filter((i) => i.slot === slot).sort((a, b) => itemScore(b) - itemScore(a))[0];
    if (best) equip(h, best.id);
  }
  if (useForge) {
    // Salvage everything not worn, then upgrade the lowest-level worn piece while embers last.
    const worn = new Set(Object.values(h.equipped));
    for (const it of [...h.inventory]) if (!worn.has(it.id)) salvage(h, it.id);
    for (let g = 0; g < 50; g++) {
      const cands = equippedItems(h).filter((i) => canUpgrade(h, i).ok).sort((a, b) => a.ilvl - b.ilvl);
      if (!cands.length || !upgradeItem(h, cands[0].id)) break;
      forgedTotal++;
    }
  }
  let guard = 0;
  while (pointsAvailable(h) > 0 && guard++ < 20) if (!spendPoint(h, order[guard % 4])) continue;
  if (snaps.has(h.maxTier)) {
    snaps.delete(h.maxTier);
    mkdirSync(snapDir, { recursive: true });
    writeFileSync(`${snapDir}/hero-t${h.maxTier}.json`, JSON.stringify(h));
  }
  if (true) {
    console.log(`run ${String(run).padStart(2)}: T${s.tier} ${s.victory ? 'WIN ' : 'loss'} ${s.time.toFixed(0).padStart(3)}s  hero lvl ${h.level}  gear ${gearScore(h)}  +${r.heroXp}xp  items ${r.items.map((i) => i.rarity[0]).join('')} quests ${s.questsDone}  embers ${h.embers} forged ${forgedTotal}  wins so far ${wins}`);
  }
}

console.log(`longest losing streak ${worstStreak}`);
