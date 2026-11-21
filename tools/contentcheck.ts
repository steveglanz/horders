// C7 content QA: can a run get stuck? Runs the newest content with good and weak bots
// and reports any run that hasn't ended by 3000 s of sim time (a soft-lock), plus the
// longest run and the most foes alive at once. Burnout should end every fight.
// Usage: HEROES=<heroes-r2 dir> npx vite-node tools/contentcheck.ts   (SEEDS=1,2,... to change the seeds)
import { World, WorldOptions } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';
import { existsSync, readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';

// HEROES=dir with <cls>/<HERO_FILE> (the skills team's heroes-r2) gives every hero that hero's gear.
const dir = process.env.HEROES;
const file = process.env.HERO_FILE ?? 'hero-t8-0.json';
const gear = (cls: ClassId) => {
  const f = dir ? `${dir}/${cls}/${file}` : '';
  if (!f || !existsSync(f)) return {};
  const h: HeroProfile = JSON.parse(readFileSync(f, 'utf8'));
  return { gear: equippedItems(h), passives: h.passives };
};
const main = (cls: ClassId) => {
  const f = dir ? `${dir}/${cls}/${file}` : '';
  if (!f || !existsSync(f)) return { cls };
  const h: HeroProfile = JSON.parse(readFileSync(f, 'utf8'));
  return { cls, gear: equippedItems(h), passives: h.passives, heroLevel: h.level, nextItemId: h.nextItemId };
};

const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const CLASSES: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen'];
// ONLY=wrackline runs just the cases whose label starts with it.
const only = process.env.ONLY;
type Case = { label: string; opts: WorldOptions; skill: number };
const cases: Case[] = [];
for (const seed of seeds) for (const skill of [1, 0.5]) {
  for (const cls of CLASSES) cases.push({ label: `coldmarrow ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'coldmarrow', tier: 10, omens: [] } });
  for (const cls of CLASSES) cases.push({ label: `wrackline ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'wrackline', tier: 10, omens: [] } });
  cases.push({ label: 'crucible party', skill, opts: { seed, ...main('bulwark'), dungeon: 'crucible', tier: 8, omens: [], worldBoss: 'Grandmother Slag',
    party: (['lumen', 'duskblade', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  cases.push({ label: 'crucible no healer', skill, opts: { seed, ...main('bulwark'), dungeon: 'crucible', tier: 8, omens: [],
    party: (['emberwright', 'duskblade', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
}
let stuck = 0, longest = 0, mostAlive = 0;
const tally: Record<string, { runs: number; wins: number; longest: number }> = {};
for (const c of cases.filter((k) => !only || k.label.startsWith(only))) {
  const w = new World(c.opts);
  let maxAlive = 0;
  while (w.state !== 'ended' && w.time < 3000) {
    if (w.state === 'draft') {
      const h = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
      w.use(h);
      const pick = botChoose(w);
      w.use(0);
      w.choose(pick, h);
      continue;
    }
    const inputs = w.heroes.map((_, i) => { w.use(i); const inp = botInput(w, c.skill); w.use(0); return inp; });
    w.step(inputs.length === 1 ? inputs[0] : inputs);
    maxAlive = Math.max(maxAlive, w.aliveEnemies);
  }
  const key = `${c.label} skill ${c.skill}`;
  const t = (tally[key] ??= { runs: 0, wins: 0, longest: 0 });
  t.longest = Math.max(t.longest, w.time);
  t.runs++;
  if (w.state !== 'ended') { stuck++; console.log(`STUCK ${key} seed ${c.opts.seed} at encounter ${w.encounter}`); }
  else if (w.summary().victory) t.wins++;
  longest = Math.max(longest, w.time);
  mostAlive = Math.max(mostAlive, maxAlive);
}
for (const [k, t] of Object.entries(tally)) console.log(`${k}: ${t.wins}/${t.runs} wins, longest ${t.longest.toFixed(0)} s`);
console.log(`runs ${cases.length}, stuck ${stuck}, longest ${longest.toFixed(0)} s, most foes alive ${mostAlive}`);
