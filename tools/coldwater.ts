// Coldmarrow Thin Ice check: per run, seconds the hero spent in open water and how the run ended.
// HERO, CLS, TIER, SEEDS as in tools/foundry.ts.
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
const hero: HeroProfile | null = process.env.HERO ? JSON.parse(readFileSync(process.env.HERO, 'utf8')) : null;
const heroOpts = hero ? { gear: equippedItems(hero), passives: hero.passives, heroLevel: hero.level, nextItemId: hero.nextItemId } : {};
const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
let wins = 0;
for (const seed of seeds) {
  const w = new World({ ...heroOpts, seed, dungeon: 'coldmarrow', tier: Number(process.env.TIER ?? 9), omens: [], cls: (process.env.CLS as 'emberwright') ?? 'emberwright' });
  let water = 0, phase2At = 0, frozen = 0, hpAtP2 = 0;
  while (w.state !== 'ended' && w.time < 900) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(botInput(w));
    if (w.coldPhase >= 2 && !phase2At) { phase2At = w.time; hpAtP2 = w.player.hp / w.player.maxHp; }
    if (w.inWater(w.player.x, w.player.y) && w.player.hp > 0) water += 1 / 30;
    if ((w.player.chill ?? 0) >= 5) frozen += 1 / 30;
  }
  const s = w.summary();
  if (s.victory) wins++;
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)} phase2=${phase2At ? phase2At.toFixed(0) : '-'} hp@p2=${(hpAtP2 * 100).toFixed(0)}% water=${water.toFixed(1)}s frozen=${frozen.toFixed(1)}s`);
}
console.log(`wins ${wins}/${seeds.length}`);
