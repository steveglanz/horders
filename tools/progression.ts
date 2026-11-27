import { botTree } from '../sim/content/trees';
import { mkdirSync, writeFileSync } from 'fs';
// Plays 40 consecutive runs with the autopilot, carrying hero progress between them.
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { applyRun, equip, equippedItems, gearScore, itemScore, newHero } from '../sim/hero';
import { SLOTS } from '../sim/content/items';
import { salvage, gritFor } from '../sim/hero';
import { canUpgrade, upgradeItem } from '../sim/forge';

// FORGE=0 skips salvage and the Forge, for before/after comparisons.
const useForge = process.env.FORGE !== '0';
const runs = Number(process.env.RUNS ?? 50);
let forgedTotal = 0;
let streak = 0;
let worstStreak = 0;
const got: Record<string, number> = { epic: 0, mythic: 0 };
let sinceEpic = 0, worstEpicGap = 0, firstMythic = 0;

const h = newHero();
if (process.env.CLS) h.cls = process.env.CLS as typeof h.cls;
// SNAP=4,6 writes the hero to SNAP_DIR/hero-t<N>.json the first time that tier unlocks (a geared reference hero for balance tools).
const snaps = new Set((process.env.SNAP ?? '').split(',').filter(Boolean).map(Number));
const snapDir = process.env.SNAP_DIR ?? 'tools/heroes';
let wins = 0;
let tier = 1;
let lossStreak = 0;
for (let run = 1; run <= runs; run++) {
  const w = new World({ cls: (process.env.CLS as 'emberwright') ?? undefined, seed: (run + Number(process.env.SEED_OFFSET ?? 0) * 1000) * 7919, gear: equippedItems(h), passives: h.passives, heroLevel: h.level, nextItemId: h.nextItemId, tier, week: Number(process.env.WEEK ?? 0), omens: process.env.NO_OMENS ? [] : undefined, grit: process.env.NO_GRIT ? 0 : gritFor(h, 'kiln', tier), firstClear: tier >= h.maxTier });
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
  const s = w.summary();
  const r = applyRun(h, (run + Number(process.env.SEED_OFFSET ?? 0) * 1000) * 7919, s, w.eliteKilled, w.runDrops, w.runEquipped);
  for (const it of r.items) if (it.rarity === 'epic' || it.rarity === 'mythic') got[it.rarity]++;
  if (r.items.some((i) => i.rarity === 'epic' || i.rarity === 'mythic')) sinceEpic = 0; else worstEpicGap = Math.max(worstEpicGap, ++sinceEpic);
  if (!firstMythic && r.items.some((i) => i.rarity === 'mythic')) firstMythic = run;
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
  // Level points go on the class's tree (its first fixed build), as for fill bots.
  h.passives = botTree(h.cls ?? 'emberwright', h.level - 1);
  if (snaps.has(h.maxTier)) {
    snaps.delete(h.maxTier);
    mkdirSync(snapDir, { recursive: true });
    writeFileSync(`${snapDir}/hero-t${h.maxTier}${process.env.SEED_OFFSET ? '-' + process.env.SEED_OFFSET : ''}.json`, JSON.stringify(h));
  }
  if (true) {
    console.log(`run ${String(run).padStart(2)}: T${s.tier} ${s.victory ? 'WIN ' : 'loss'} ${s.time.toFixed(0).padStart(3)}s  hero lvl ${h.level}  gear ${gearScore(h)}  +${r.heroXp}xp  items ${r.items.map((i) => i.rarity[0]).join('')}  embers ${h.embers} forged ${forgedTotal}  wins so far ${wins}`);
  }
}

console.log(`longest losing streak ${worstStreak}`);
console.log(`epics ${got.epic}  mythics ${got.mythic}  first mythic on run ${firstMythic || '-'}  longest run of runs without an epic ${worstEpicGap}`);
