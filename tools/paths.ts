// Compares fork choices: wins, delve time and loot quality per bot path policy.
// BOT_PATH=steady|named forces a gate; unset uses the bot's own policy.
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { RARITIES } from '../sim/content/items';

const seeds = (process.env.SEEDS ?? Array.from({ length: 24 }, (_, i) => i + 1).join(',')).split(',').map(Number);
const tier = Number(process.env.TIER ?? 1);
let wins = 0, time = 0, rarity = 0, drops = 0, epics = 0;
const taken: Record<string, number> = {};
for (const seed of seeds) {
  const w = new World({ seed, tier, omens: [] });
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(botInput(w));
    for (const ev of w.events) if (ev.type === 'gateChosen') taken[ev.kind] = (taken[ev.kind] ?? 0) + 1;
  }
  const s = w.summary();
  if (s.victory) wins++;
  time += s.time;
  for (const it of w.runDrops) { rarity += RARITIES.indexOf(it.rarity); drops++; if (RARITIES.indexOf(it.rarity) >= 3) epics++; }
}
console.log(`path=${process.env.BOT_PATH ?? 'auto'} tier ${tier}: wins ${wins}/${seeds.length}, avg delve ${Math.round(time / seeds.length)}s, drops ${drops} avg rarity ${(rarity / drops).toFixed(2)} (0 common .. 4 mythic), epic+ ${epics}, gates ${JSON.stringify(taken)}`);
