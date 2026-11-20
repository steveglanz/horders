// Counts the rarity of every item a run gives (in-run drops plus the end chest).
// Env: SEEDS (default 1..40), TIER, DUNGEON, CLS, RUNS_PER_HERO (default 1: a fresh hero each run).
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { applyRun, equippedItems, newHero } from '../sim/hero';

const seeds = (process.env.SEEDS ?? Array.from({ length: 40 }, (_, i) => i + 1).join(',')).split(',').map(Number);
const tier = Number(process.env.TIER ?? 1);
const tally: Record<string, number> = { common: 0, fine: 0, rare: 0, epic: 0, mythic: 0 };
let wins = 0, runsWithEpic = 0, runsWithMythic = 0;
for (const seed of seeds) {
  const h = newHero();
  const w = new World({ seed, tier, dungeon: (process.env.DUNGEON as 'kiln') ?? 'kiln', omens: [], gear: equippedItems(h), heroLevel: h.level, nextItemId: h.nextItemId, cls: (process.env.CLS as 'emberwright') ?? 'emberwright', firstClear: process.env.FIRST === '1' });
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
  const s = w.summary();
  if (s.victory) wins++;
  const r = applyRun(h, seed, s, w.eliteKilled, w.runDrops, w.runEquipped);
  for (const it of r.items) tally[it.rarity]++;
  if (r.items.some((i) => i.rarity === 'epic' || i.rarity === 'mythic')) runsWithEpic++;
  if (r.items.some((i) => i.rarity === 'mythic')) runsWithMythic++;
}
const n = seeds.length;
console.log(`runs ${n}, wins ${wins}`);
console.log('items per run', Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, +(v / n).toFixed(2)])));
console.log(`runs with an epic or better: ${runsWithEpic}/${n}  runs with a mythic: ${runsWithMythic}/${n}`);
