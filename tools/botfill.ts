// Fill with bots: one player hero plus bot allies, to measure how easy a bot-filled group run is.
// MAIN=bulwark (the player's class), BOTS=lumen,duskblade (the bot allies), DUNGEON=hammerdeep, TIER=n, SEEDS=1,2,...
// HEROES=dir with <cls>/<HERO_FILE> (skills' heroes-r2). The player always uses its own file.
// PSKILL=player bot skill (default 1), BSKILL=bot ally skill (default 1).
// BOTGEAR=own: each bot uses its own class's hero file (a stand-in for a real player of that class).
// BOTGEAR=standin (default): each bot gets standInGear(player's equipped items) and the player's passives, as the client does. SCALE overrides BOT_FILL.gearScale.
// FILL=1 passes fillBots (as the client does); it changes only the boss loot, not who wins.
import { World, WorldOptions } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { existsSync, readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import { BOT_FILL, fillClasses, standInGear } from '../sim/content/botfill';
import type { ClassId } from '../sim/content/emberwright';
import { toolOmens } from './omenopt';

const main = (process.env.MAIN ?? 'bulwark') as ClassId;
// BOTS defaults to what the client fills (fillClasses).
const bots = (process.env.BOTS ? process.env.BOTS.split(',').filter(Boolean) : fillClasses([{ cls: main, stance: process.env.STANCE }])) as ClassId[];
const dir = process.env.HEROES;
const file = process.env.HERO_FILE ?? 'hero-t6-0.json';
const profile = (cls: ClassId): HeroProfile | null => {
  const f = dir ? `${dir}/${cls}/${file}` : '';
  return f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const pskill = Number(process.env.PSKILL ?? 1);
const bskill = Number(process.env.BSKILL ?? 1);
const botGear = process.env.BOTGEAR ?? 'standin';
const seeds = (process.env.SEEDS ?? Array.from({ length: 20 }, (_, i) => i + 1).join(',')).split(',').map(Number);

const mp = profile(main);
let wins = 0;
for (const seed of seeds) {
  const opts: WorldOptions = {
    seed, dungeon: (process.env.DUNGEON as 'hammerdeep') ?? 'hammerdeep', tier: Number(process.env.TIER ?? 6), omens: toolOmens(Number(process.env.TIER ?? 6), seed), cls: main,
    ...(mp ? { gear: equippedItems(mp), passives: mp.passives, heroLevel: mp.level, nextItemId: mp.nextItemId } : {}),
    party: bots.map((cls, k) => {
      const own = botGear === 'own' ? profile(cls) : null;
      if (own) return { cls, name: `${cls}${k + 1}`, gear: equippedItems(own), passives: own.passives };
      return { cls, name: `${cls}${k + 1}`, ...(mp ? { gear: standInGear(equippedItems(mp), Number(process.env.SCALE ?? BOT_FILL.gearScale)), passives: process.env.NOPASS ? {} : mp.passives } : {}) };
    }),
  };
  const w = new World(opts);
  while (w.state !== 'ended' && w.time < 900) {
    if (w.state === 'draft') {
      const h = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
      w.use(h);
      const pick = botChoose(w);
      w.use(0);
      w.choose(pick, h);
      continue;
    }
    const inputs = w.heroes.map((_, i) => {
      w.use(i);
      const inp = botInput(w, i === 0 ? pskill : bskill);
      w.use(0);
      return inp;
    });
    w.step(inputs);
  }
  if (w.summary().victory) wins++;
}
console.log(`${main} + bots ${bots.join('+')}: wins ${wins}/${seeds.length}`);
