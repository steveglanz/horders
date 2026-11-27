// The Kiln Mother's fight, stage by stage (design, CP3 remake, 27 Nov 2026): plays Kiln Halls runs and prints, per seed,
// how long each of her stages took, the whole fight, where her damage came from, and what felled the hero on a loss.
// Same knobs as tools/balance.ts for class, tier, skill and seeds; average skill is the CP3 bar.
//
//   CLS=emberwright TIER=1 SEEDS=1,2,3 REACT=0.3 FORGET=0.2 STEPERR=0.5 npx tsx tools/kmfight.ts
//   TUNE=KILN_V2.stage2At=0.7 ...   overrides an exported tuning number, as in tools/balance.ts
import * as WORLD from '../sim/world';
import { World } from '../sim/world';
import { botChoose, botInput, reactBot } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';

for (const kv of (process.env.TUNE ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split('=');
  const keys = path.split('.');
  let o = (WORLD as unknown as Record<string, Record<string, unknown>>)[keys[0]] as Record<string, unknown>;
  for (const k of keys.slice(1, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = Number(v);
}

// Every blow on the hero during the boss fight, by its cause (the hurtPlayer cause, else the source foe's kind).
let inBoss = false;
let hits: Record<string, number> = {};
const proto = World.prototype as unknown as { hurtPlayer(this: World, amount: number, src?: number, ...rest: unknown[]): unknown };
const orig = proto.hurtPlayer;
proto.hurtPlayer = function (this: World, amount: number, src = -1, ...rest: unknown[]) {
  const before = this.player.hp;
  const r = orig.call(this, amount, src, ...rest);
  const lost = Math.max(0, before - this.player.hp);
  if (inBoss && lost > 0) {
    const cause = (rest[1] as string | undefined) ?? (src >= 0 ? this.enemies[src]?.kind ?? 'foe' : 'other');
    hits[cause] = (hits[cause] ?? 0) + lost / this.player.maxHp;
  }
  return r;
};

const react = Number(process.env.REACT ?? 0);
const skill = Number(process.env.SKILL ?? 1);
const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const cls = (process.env.CLS ?? 'emberwright') as ClassId;
const tier = Number(process.env.TIER ?? 1);
const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
const all = { s1: [] as number[], s2: [] as number[], s3: [] as number[], fight: [] as number[], boil: 0, wins: 0, bossWins: 0, bossTries: 0 };
const total: Record<string, number> = {};
const fell: Record<string, number> = {};
for (const seed of seeds) {
  const w = new World({ seed, dungeon: 'kiln', tier, cls, halls: process.env.HALLS !== '0', firstDelve: process.env.FIRST === '1', unlockLevel: process.env.ULVL ? Number(process.env.ULVL) : undefined });
  const drive = react ? reactBot(react, skill, { forget: Number(process.env.FORGET ?? 0), stepErr: Number(process.env.STEPERR ?? 0), salt: seed }) : (x: World) => botInput(x, skill);
  let bossAt = 0, s2At = 0, s3At = 0, lastCause = '';
  inBoss = false;
  hits = {};
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(drive(w));
    for (const ev of w.events) {
      if (ev.type === 'bossSpawn') { bossAt = w.time; inBoss = true; }
      if (ev.type === 'phase' && ev.phase === 2 && bossAt && !s2At) s2At = w.time;
      if (ev.type === 'castDone' && (ev.id === 'kmFallen' || ev.id === 'kmOut') && !s3At) s3At = w.time;
      if (ev.type === 'phase' && ev.phase === 3 && bossAt && !s3At) s3At = w.time;
    }
    if (inBoss) for (const [k, v] of Object.entries(hits)) if (v > 0) lastCause = k;
  }
  const s = w.summary();
  const end = w.time;
  if (s.victory) all.wins++;
  if (bossAt) {
    all.bossTries++;
    if (s.victory) {
      all.bossWins++;
      all.fight.push(end - bossAt);
      if (s2At) all.s1.push(s2At - bossAt);
      if (s2At && s3At) all.s2.push(s3At - s2At);
      if (s3At) all.s3.push(end - s3At);
      if (end - bossAt > 90) all.boil++;
    } else { const by = w.player.lastHurtBy ?? lastCause; fell[by] = (fell[by] ?? 0) + 1; }
  }
  for (const [k, v] of Object.entries(hits)) total[k] = (total[k] ?? 0) + v;
  const f = (a: number, b: number) => (a && b ? (b - a).toFixed(0) : '-');
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} fight=${bossAt ? (end - bossAt).toFixed(0) : '-'}s stages ${f(bossAt, s2At)}/${f(s2At, s3At)}/${s3At ? f(s3At, end) : '-'} hp=${w.player.hp.toFixed(0)}`);
}
console.log(`${cls} t${tier}: wins ${all.wins}/${seeds.length}, boss ${all.bossWins}/${all.bossTries}; won-fight median ${med(all.fight).toFixed(0)} s (${Math.min(...all.fight).toFixed(0)}-${Math.max(...all.fight).toFixed(0)}), stages ${med(all.s1).toFixed(0)}/${med(all.s2).toFixed(0)}/${med(all.s3).toFixed(0)} s, past 90 s ${all.boil}`);
console.log('  boss damage taken, % max hp per run:', Object.entries(total).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / seeds.length).toFixed(0)}`).join(', '));
if (Object.keys(fell).length) console.log('  felled by:', JSON.stringify(fell));
