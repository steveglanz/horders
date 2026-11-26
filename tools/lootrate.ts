// Loot per minute: items (and Rare or better) a run gives the player, per minute of play,
// for a solo run or a Fill with bots run. Answers "is a bot fill the fastest farm?"
// Env: HERO=tools/heroes/hero-t6.json, CLS=bulwark, DUNGEON=kiln, TIER=6, SEEDS=1..20,
// FILL=1 adds the bots the client would (fillClasses, standInGear, fillBots).
import { readFileSync } from 'fs';
import { World, WorldOptions } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { applyRun, equippedItems, HeroProfile } from '../sim/hero';
import { fillClasses, standInGear } from '../sim/content/botfill';
import type { ClassId } from '../sim/content/emberwright';

const file = process.env.HERO ?? 'tools/heroes/hero-t6.json';
const cls = (process.env.CLS ?? 'bulwark') as ClassId;
const dungeon = (process.env.DUNGEON ?? 'kiln') as WorldOptions['dungeon'];
const tier = Number(process.env.TIER ?? 6);
const fill = process.env.FILL === '1';
const seeds = (process.env.SEEDS ?? Array.from({ length: 20 }, (_, i) => i + 1).join(',')).split(',').map(Number);

let items = 0, rare = 0, minutes = 0, wins = 0;
for (const seed of seeds) {
  const h: HeroProfile = JSON.parse(readFileSync(file, 'utf8'));
  const gear = equippedItems(h);
  const bots = fill ? fillClasses([{ cls }]) : [];
  const w = new World({
    seed, dungeon, tier, omens: [], cls, gear, passives: h.passives, heroLevel: h.level, nextItemId: h.nextItemId,
    ...(bots.length ? { party: bots.map((c) => ({ cls: c, gear: standInGear(gear), passives: h.passives })), partySize: 1 + bots.length, fillBots: bots.length } : {}),
  });
  while (w.state !== 'ended' && w.time < 900) {
    if (w.state === 'draft') {
      const k = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
      w.use(k);
      const pick = botChoose(w);
      w.use(0);
      w.choose(pick, k);
      continue;
    }
    w.step(w.heroes.map((_, i) => { w.use(i); const inp = botInput(w); w.use(0); return inp; }));
  }
  const s = w.summary();
  if (s.victory) wins++;
  const r = applyRun(h, seed, s, w.eliteKilled, w.runDrops, w.runEquipped);
  items += r.items.length;
  rare += r.items.filter((i) => i.rarity !== 'common' && i.rarity !== 'uncommon').length;
  minutes += s.time / 60;
}
const f = (x: number) => x.toFixed(2);
console.log(`${cls} ${dungeon} t${tier}${fill ? ' +bots' : ''}: wins ${wins}/${seeds.length}, ${f(minutes / seeds.length)} min a run, ${f(items / seeds.length)} items a run, items/min ${f(items / minutes)}, rare+/min ${f(rare / minutes)}`);
