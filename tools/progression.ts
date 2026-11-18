// Plays 40 consecutive runs with the autopilot, carrying hero progress between them.
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { applyRun, equip, equippedItems, gearScore, itemScore, newHero, pointsAvailable, spendPoint, PassiveId } from '../sim/hero';
import { SLOTS } from '../sim/content/items';

const h = newHero();
const order: PassiveId[] = ['might', 'fortitude', 'alacrity', 'insight'];
let wins = 0;
let tier = 1;
let lossStreak = 0;
for (let run = 1; run <= 50; run++) {
  const w = new World({ seed: run * 7919, gear: equippedItems(h), passives: h.passives, heroLevel: h.level, nextItemId: h.nextItemId, tier });
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
  const s = w.summary();
  const r = applyRun(h, run * 7919, s, w.eliteKilled, w.runDrops, w.runEquipped);
  if (s.victory) { wins++; lossStreak = 0; tier = h.maxTier; } else if (++lossStreak >= 2 && tier > 1) { tier--; lossStreak = 0; }
  for (const slot of SLOTS) {
    const best = h.inventory.filter((i) => i.slot === slot).sort((a, b) => itemScore(b) - itemScore(a))[0];
    if (best) equip(h, best.id);
  }
  let guard = 0;
  while (pointsAvailable(h) > 0 && guard++ < 20) if (!spendPoint(h, order[guard % 4])) continue;
  if (true) {
    console.log(`run ${String(run).padStart(2)}: T${s.tier} ${s.victory ? 'WIN ' : 'loss'} ${s.time.toFixed(0).padStart(3)}s  hero lvl ${h.level}  gear ${gearScore(h)}  +${r.heroXp}xp  items ${r.items.map((i) => i.rarity[0]).join('')} quests ${s.questsDone}  wins so far ${wins}`);
  }
}
