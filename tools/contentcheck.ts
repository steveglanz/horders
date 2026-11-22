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
/**
 * `dropWhen`: once it returns a hero index (not -1), that hero stops playing (no input, first card in
 * drafts) for the rest of the run, like a guest who left: their hero stays in the world, idle.
 */
type Case = { label: string; opts: WorldOptions; skill: number; dropWhen?: (w: World) => number };
const downstrokeUp = (w: World) => w.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -3);
const crawUp = (w: World) => w.enemies.some((e) => e.alive && e.kind === 'craw');
/** The Hoard: the hero inside Old Vorhulm right now, or -1. */
const swallowedHero = (w: World) => w.heroes.findIndex((_, i) => (w.heroPlayer(i).swallowT ?? 0) > 0);
const cases: Case[] = [];
for (const seed of seeds) for (const skill of [1, 0.5]) {
  for (const cls of CLASSES) cases.push({ label: `coldmarrow ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'coldmarrow', tier: 10, omens: [] } });
  for (const cls of CLASSES) cases.push({ label: `wrackline ${cls}`, skill, opts: { seed, ...main(cls), dungeon: 'wrackline', tier: 10, omens: [] } });
  cases.push({ label: 'crucible party', skill, opts: { seed, ...main('bulwark'), dungeon: 'crucible', tier: 8, omens: [], worldBoss: 'Grandmother Slag',
    party: (['lumen', 'duskblade', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  cases.push({ label: 'crucible no healer', skill, opts: { seed, ...main('bulwark'), dungeon: 'crucible', tier: 8, omens: [],
    party: (['emberwright', 'duskblade', 'emberwright'] as ClassId[]).map((cls) => ({ cls, ...gear(cls) })) } });
  // The Pressworks (group, tier 10): Oskel's Downstroke needs an un-Pressed hero under it every time.
  const press = (label: string, lead: ClassId, rest: ClassId[], drop?: number) =>
    cases.push({ label, skill, dropWhen: drop === undefined ? undefined : (w) => (downstrokeUp(w) ? drop : -1), opts: { seed, ...main(lead), dungeon: 'pressworks', tier: 10, omens: [], party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  press('pressworks duo', 'bulwark', ['lumen']);
  press('pressworks trio', 'bulwark', ['lumen', 'emberwright']);
  press('pressworks four', 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  press('pressworks no tank', 'emberwright', ['lumen', 'duskblade']);
  press('pressworks drop mid-Downstroke', 'bulwark', ['lumen', 'emberwright'], 2);
  press('pressworks duo drop mid-Downstroke', 'bulwark', ['lumen'], 1);
  // The Hoard (raid 2, tier 9, four heroes): Swallow and the Craw, then Ember Feast.
  const hoard = (label: string, lead: ClassId, rest: ClassId[], dropWhen?: (w: World) => number) =>
    cases.push({ label, skill, dropWhen, opts: { seed, ...main(lead), dungeon: 'hoard', tier: 9, omens: [], worldBoss: 'Old Vorhulm', party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  hoard('hoard four', 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  hoard('hoard no healer', 'bulwark', ['emberwright', 'duskblade', 'emberwright']);
  hoard('hoard no tank', 'emberwright', ['lumen', 'duskblade', 'emberwright']);
  // A guest leaves while swallowed (they're inside), or while someone else is and the Craw stands.
  hoard('hoard drop while swallowed', 'bulwark', ['lumen', 'duskblade', 'emberwright'], swallowedHero);
  hoard('hoard drop while the Craw stands', 'bulwark', ['lumen', 'duskblade', 'emberwright'], (w) => {
    const k = swallowedHero(w);
    return k >= 0 && crawUp(w) ? [1, 2, 3].find((i) => i !== k)! : -1;
  });
  // The Smeltery (raid 3, tier 10, four heroes): get behind the Cinder Colossus; Wheel turns on whoever hurt him most.
  const smelt = (label: string, lead: ClassId, rest: ClassId[], dropWhen?: (w: World) => number) =>
    cases.push({ label, skill, dropWhen, opts: { seed, ...main(lead), dungeon: 'smeltery', tier: 10, omens: [], worldBoss: 'The Cinder Colossus', party: rest.map((cls) => ({ cls, ...gear(cls) })) } });
  smelt('smeltery four', 'bulwark', ['lumen', 'duskblade', 'emberwright']);
  smelt('smeltery no healer', 'bulwark', ['emberwright', 'duskblade', 'emberwright']);
  smelt('smeltery no tank', 'emberwright', ['lumen', 'duskblade', 'emberwright']);
  // A guest leaves while Wheel is being cast: the non-tank who hurt him most (the one he is about to turn on).
  smelt('smeltery drop mid-Wheel', 'bulwark', ['lumen', 'duskblade', 'emberwright'], (w) => {
    if (!w.enemies.some((e) => e.alive && e.kind === 'colossus' && e.castId === 'wheel')) return -1;
    let pick = -1, most = -1;
    for (let k = 1; k < w.heroes.length; k++) if (!w.isTank(k) && (w.colDmg[k] ?? 0) > most) { most = w.colDmg[k] ?? 0; pick = k; }
    return pick;
  });
}
let stuck = 0, longest = 0, mostAlive = 0;
const tally: Record<string, { runs: number; wins: number; longest: number }> = {};
for (const c of cases.filter((k) => !only || k.label.startsWith(only))) {
  const w = new World(c.opts);
  let maxAlive = 0;
  let gone = -1;
  while (w.state !== 'ended' && w.time < 3000) {
    if (w.state === 'draft') {
      const h = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
      w.use(h);
      const pick = h === gone ? 0 : botChoose(w);
      w.use(0);
      w.choose(pick, h);
      continue;
    }
    if (c.dropWhen && gone < 0) gone = c.dropWhen(w);
    const inputs = w.heroes.map((_, i) => { if (i === gone) return { x: 0, y: 0 }; w.use(i); const inp = botInput(w, c.skill); w.use(0); return inp; });
    w.step(inputs.length === 1 ? inputs[0] : inputs);
    maxAlive = Math.max(maxAlive, w.aliveEnemies);
  }
  const key = `${c.label} skill ${c.skill}`;
  const t = (tally[key] ??= { runs: 0, wins: 0, longest: 0 });
  t.longest = Math.max(t.longest, w.time);
  t.runs++;
  if (w.state !== 'ended') { stuck++; console.log(`STUCK ${key} seed ${c.opts.seed} at encounter ${w.encounter}`); }
  // Nobody may be left inside Old Vorhulm once the run is over.
  const inside = w.heroes.findIndex((_, i) => (w.heroPlayer(i).swallowT ?? 0) > 0);
  if (inside >= 0) { stuck++; console.log(`STUCK INSIDE ${key} seed ${c.opts.seed}: hero ${inside} still swallowed at the end`); }
  if (c.dropWhen && gone < 0) console.log(`NO DROP ${key} seed ${c.opts.seed}: the drop moment never came`);
  else if (w.summary().victory) t.wins++;
  longest = Math.max(longest, w.time);
  mostAlive = Math.max(mostAlive, maxAlive);
}
for (const [k, t] of Object.entries(tally)) console.log(`${k}: ${t.wins}/${t.runs} wins, longest ${t.longest.toFixed(0)} s`);
console.log(`runs ${cases.filter((k) => !only || k.label.startsWith(only)).length}, stuck ${stuck}, longest ${longest.toFixed(0)} s, most foes alive ${mostAlive}`);
