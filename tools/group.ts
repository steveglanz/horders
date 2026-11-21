// Group dungeon check: a party of bots, each hero driving its own input.
// PARTY=bulwark,lumen,duskblade,emberwright (first is the main hero), DUNGEON=hammerdeep, TIER=n, SEEDS=...
// HEROES=dir with <cls>/hero-t6-0.json (the skills team's heroes-r2) gives every hero that hero's gear and passives.
// SKILL=1 bot skill.
import { World, WorldOptions } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { existsSync, readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import type { ClassId } from '../sim/content/emberwright';

const classes = (process.env.PARTY ?? 'bulwark,lumen,duskblade,emberwright').split(',') as ClassId[];
const dir = process.env.HEROES;
const file = process.env.HERO_FILE ?? 'hero-t6-0.json';
const profile = (cls: ClassId): HeroProfile | null => {
  const f = dir ? `${dir}/${cls}/${file}` : '';
  return f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const skill = Number(process.env.SKILL ?? 1);
const seeds = (process.env.SEEDS ?? Array.from({ length: 20 }, (_, i) => i + 1).join(',')).split(',').map(Number);

let wins = 0;
for (const seed of seeds) {
  const [main, ...rest] = classes;
  const mp = profile(main);
  const opts: WorldOptions = {
    seed, dungeon: (process.env.DUNGEON as 'hammerdeep') ?? 'hammerdeep', tier: Number(process.env.TIER ?? 4), omens: [], cls: main,
    ...(mp ? { gear: equippedItems(mp), passives: mp.passives, heroLevel: mp.level, nextItemId: mp.nextItemId } : {}),
    party: rest.map((cls, k) => {
      const hp = profile(cls);
      return { cls, name: `${cls}${k + 1}`, ...(hp ? { gear: equippedItems(hp), passives: hp.passives } : {}) };
    }),
  };
  const w = new World(opts);
  const c: Record<string, number> = {};
  const bump = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
  let bossAt = 0;
  const deaths: string[] = [];
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
      const inp = botInput(w, skill);
      w.use(0);
      return inp;
    });
    const before = w.heroes.map((_, i) => w.hero(i).player.hp);
    w.step(inputs);
    if (w.bossSpawned && !bossAt) bossAt = w.time;
    w.heroes.forEach((_, i) => {
      if (before[i] > 0 && w.hero(i).player.hp <= 0) {
        const casts = w.events.filter((e) => e.type === 'castDone').map((e) => (e as { name: string }).name).join('+') || 'other';
        deaths.push(`${classes[i]}@${w.time.toFixed(0)}(${casts})`);
      }
    });
    for (const ev of w.events) {
      if (ev.type === 'castDone') bump('cast:' + ev.name);
      if (ev.type === 'cleanse') bump('cleanse');
      if (ev.type === 'slagGrip') bump('grip');
      if (ev.type === 'revive') bump('revive');
    }
  }
  const s = w.summary();
  if (s.victory) wins++;
  const alive = w.heroes.map((_, i) => (w.hero(i).player.hp > 0 ? 'up' : 'down')).join('/');
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)} boss=${bossAt ? (s.time - bossAt).toFixed(0) + 's' : '-'} fights=${w.encounter} heroes=${alive} boss=${w.bossIndex >= 0 ? Math.round((100 * w.enemies[w.bossIndex].hp) / w.enemies[w.bossIndex].maxHp) + '%' : '-'} deaths=${deaths.join(',')} ${JSON.stringify(c)}`);
}
console.log(`party ${classes.join('+')}: wins ${wins}/${seeds.length}`);
