// P3 Delver's Keys: win rate and par rate by key level. A key run is played at the
// hero's best beaten tier (keyTier) with keyOmens and keyScale.
// HERO=heroes-r2/<cls>/hero-t8-0.json CLS=... DUNGEON=kiln LEVELS=1,3,5,7 SEEDS=1..20 WEEK=2900
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import { KEYS, keyOmens, keyTier } from '../sim/content/keys';

const hero: HeroProfile = JSON.parse(readFileSync(process.env.HERO!, 'utf8'));
const levels = (process.env.LEVELS ?? '1,3,5,7').split(',').map(Number);
const seeds = (process.env.SEEDS ?? Array.from({ length: 20 }, (_, i) => i + 1).join(',')).split(',').map(Number);
const week = Number(process.env.WEEK ?? 2900);
const tier = keyTier(hero.maxTier);
for (const level of levels) {
  let wins = 0, par = 0, fast = 0, time = 0;
  for (const seed of seeds) {
    const w = new World({
      seed, cls: (process.env.CLS ?? hero.cls) as 'emberwright', dungeon: (process.env.DUNGEON ?? 'kiln') as 'kiln', tier, week,
      omens: keyOmens(tier, week, level), keyLevel: level,
      gear: equippedItems(hero), passives: hero.passives, heroLevel: hero.level, nextItemId: hero.nextItemId,
    });
    while (w.state !== 'ended' && w.time < 1200) {
      if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
      w.step(botInput(w, 1));
    }
    const s = w.summary();
    if (s.victory) { wins++; time += s.time; if (s.time <= KEYS.par) par++; if (s.time <= KEYS.par * KEYS.fast) fast++; }
  }
  console.log(`tier ${tier} key ${level} (${keyOmens(tier, week, level).length} Omens): wins ${wins}/${seeds.length}, inside par ${par}, fast ${fast}, avg win ${wins ? (time / wins).toFixed(0) : '-'} s`);
}
