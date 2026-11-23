// Busy-fight audio check: runs bot parties through the busiest fights and replays every
// sound cue through the same throttle and voice cap the phone uses (client/audio/index.ts),
// to see what gets dropped when the mix is full.
//   npx vite-node tools/busycheck.ts                 (raid, Hammerdeep and Coldmarrow, 4 heroes)
//   VOICES=20 DUNGEONS=crucible SEEDS=1,2,3 PARTY=bulwark,lumen,duskblade,slagbinder npx vite-node tools/busycheck.ts
//   WHO=selfDown: which ordinary sounds fill the mix under that cue.
//   NOEDGE=1: leave out the arena-edge ambience, to compare.
//   HEROES=<dir> HERO_FILE=hero-t8-0.json: every hero wears <dir>/<cls>/<file>'s gear and passives (as tools/group.ts),
//   so bosses reach their later phases (the skills team's heroes-r2).
import { World } from '../sim/world';
import { BOT_PARTY, botChoose, botInput } from '../sim/bot';
import { edgeCue, millCue, withoutBankedSoaks, islandCues, myIsland, spentCue, behindColossusNow, bellyCues, colossusCue, cueFor, ebbCue, pressedCue, partyCues, reviveCues, setCues, setFlagsOf, THROTTLE, PRIORITY, DUCK, DEEP_DUCK } from '../client/audio/cues';
import { SOUNDS, SoundId } from '../client/audio/sounds';
import { recipeLength, render } from '../client/audio/synth';
import type { ClassId } from '../sim/content/emberwright';
import type { DungeonId } from '../sim/content/dungeon';
import type { SetId } from '../sim/content/sets';
import { equippedItems, type HeroProfile } from '../sim/hero';
import { existsSync, readFileSync } from 'fs';

const VOICES = Number(process.env.VOICES ?? 12); // the low-end phone cap
const classes = (process.env.PARTY ?? 'bulwark,lumen,duskblade,emberwright').split(',') as ClassId[];
const dungeons = (process.env.DUNGEONS ?? 'crucible,hammerdeep,coldmarrow').split(',') as DungeonId[];
const seeds = (process.env.SEEDS ?? '1,2,3').split(',').map(Number);
const profile = (cls: ClassId): HeroProfile | null => {
  const f = process.env.HEROES ? `${process.env.HEROES}/${cls}/${process.env.HERO_FILE ?? 'hero-t6-0.json'}` : '';
  return f && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const gearOf = (cls: ClassId) => {
  const p = profile(cls);
  return p ? { gear: equippedItems(p), passives: p.passives } : {};
};
const TIER: Partial<Record<DungeonId, number>> = { ashvents: 7, crucible: 8, hammerdeep: 4, coldmarrow: 6, wrackline: 13, pressworks: 10, hoard: 9, smeltery: 10, flue: 11 };
BOT_PARTY.revive = true;
const len = new Map<SoundId, number>();
const RATE = 16000;
const pcm = new Map<SoundId, Float32Array>();
const samplesOf = (id: SoundId) => pcm.get(id) ?? (pcm.set(id, render(SOUNDS[id], RATE)), pcm.get(id)!);
/** The phone model from tools/mixcheck.ts: two one-pole high-passes at 350 Hz. */
function phone(x: Float32Array): Float32Array {
  const k = Math.exp((-2 * Math.PI * 350) / RATE);
  const y = new Float32Array(x.length);
  let a1 = 0, i1 = 0, a2 = 0, i2 = 0;
  for (let n = 0; n < x.length; n++) {
    a1 = k * (a1 + x[n] - i1); i1 = x[n];
    a2 = k * (a2 + a1 - i2); i2 = a1;
    y[n] = a2;
  }
  return y;
}
const rms = (x: Float32Array, a: number, b: number) => {
  let e = 0;
  for (let n = a; n < b; n++) e += x[n] * x[n];
  return Math.sqrt(e / Math.max(1, b - a));
};
const phoned = new Map<SoundId, Float32Array>();
const phoneOf = (id: SoundId) => phoned.get(id) ?? (phoned.set(id, phone(samplesOf(id))), phoned.get(id)!);
const lengthOf = (id: SoundId) => len.get(id) ?? (len.set(id, recipeLength(SOUNDS[id])), len.get(id)!);

for (const dungeon of dungeons) {
  const played = new Map<string, number>();
  const dropped = new Map<string, number>();
  let peak = 0;
  let busiest = 0;
  let seconds = 0;
  /** How far each priority cue stands above everything else playing with it, on a phone (dB). */
  const margins: { id: SoundId; db: number }[] = [];
  const who = new Map<SoundId, number>();
  for (const seed of seeds) {
    const [main, ...rest] = classes;
    const mp = profile(main);
    const w = new World({
      seed, dungeon, tier: Number(process.env.TIER ?? 0) || (TIER[dungeon] ?? 4), omens: [], cls: main,
      ...(mp ? { ...gearOf(main), heroLevel: mp.level, nextItemId: mp.nextItemId } : {}),
      party: rest.map((cls, k) => ({ cls, name: `${cls}${k + 1}`, ...gearOf(cls) })),
    });
    // SET=kinbound SETN=3: every hero wears that many pieces of a verb set, to hear its proc cues.
    // The sim rebuilds each loadout from gear between fights, so this is re-applied every tick.
    const wearSet = () => {
      if (process.env.SET) for (const h of w.heroes) if (h.loadout.sets?.[process.env.SET as SetId] !== Number(process.env.SETN ?? 3)) h.loadout.sets = { ...h.loadout.sets, [process.env.SET]: Number(process.env.SETN ?? 3) };
    };
    wearSet();
    w.use(0);
    const ends: { t: number; id: SoundId }[] = [];
    const last = new Map<SoundId, number>();
    const wasDown: boolean[] = [];
    const rv = { t: [] as number[], left: Infinity };
    const ebb = { on: false };
    const sets = {};
    const belly = { on: false, next: 0 };
    const press = { on: false };
    const spend = { on: false };
    const isl = { t: [] as number[] };
    const edge = { next: 0 };
    let rs = seed;
    const rnd = () => ((rs = (rs * 9301 + 49297) % 233280) / 233280);
    const perSecond = new Map<number, number>();
    const plays: { id: SoundId; t: number; vol: number }[] = [];
    const play = (id: SoundId, t: number, vol = 1) => {
      for (let k = ends.length - 1; k >= 0; k--) if (ends[k].t <= t) ends.splice(k, 1);
      const gap = THROTTLE[id];
      if (gap !== undefined && t - (last.get(id) ?? -1) < gap) return;
      if (ends.length >= VOICES) {
        // Same rule as AudioEngine.play: a priority sound takes the voice of the oldest ordinary one.
        const k = PRIORITY.has(id) ? ends.findIndex((e) => !PRIORITY.has(e.id)) : -1;
        if (k < 0) return void dropped.set(id, (dropped.get(id) ?? 0) + 1);
        ends.splice(k, 1);
      }
      last.set(id, t);
      ends.push({ t: t + lengthOf(id), id });
      played.set(id, (played.get(id) ?? 0) + 1);
      plays.push({ id, t, vol });
      peak = Math.max(peak, ends.length);
      const s = Math.floor(t);
      perSecond.set(s, (perSecond.get(s) ?? 0) + 1);
    };
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
        const inp = botInput(w);
        w.use(0);
        return inp;
      });
      wearSet();
      w.step(inputs);
      const ctx = { cls: w.cls, acting: w.acting, dungeon, boss: w.bossIndex >= 0 ? w.enemies[w.bossIndex]?.kind : undefined, colossus: colossusCue(w), outsurge: dungeon === 'wrackline' && w.outsurge, whirl: dungeon === 'wrackline' && w.whirl, namedAffix: w.namedPlan()?.affix };
      for (const ev of withoutBankedSoaks(w.events)) {
        const c = cueFor(ev, ctx);
        if (c) play(c.id, w.time, c.vol);
      }
      for (const c of partyCues(wasDown, w.heroes.map((_, i) => w.heroData(i).player.hp), w.acting)) play(c.id, w.time);
      const mc = millCue(ctx);
      if (mc) play(mc.id, w.time, mc.vol);
      const ec = ebbCue(ebb, dungeon === 'wrackline' && w.ebbT > 0, ctx.outsurge, ctx.whirl);
      if (ec) play(ec.id, w.time, ec.vol);
      const pc = pressedCue(press, dungeon === 'pressworks' && (w.player.pressedT ?? 0) > 0);
      if (pc) play(pc.id, w.time, pc.vol);
      const sc = spentCue(spend, dungeon === 'flue' && (w.player.spentT ?? 0) > 0);
      if (sc) play(sc.id, w.time, sc.vol);
      for (const c of islandCues(isl, w.islands, myIsland(w))) play(c.id, w.time, c.vol);
      if (process.env.NOEDGE !== '1') { const c = edgeCue(edge, dungeon, w.time, w.bossIndex >= 0, rnd); if (c) play(c.id, w.time, c.vol); }
      for (const c of bellyCues(belly, dungeon === 'hoard' ? w.player.swallowT ?? 0 : 0, w.time)) play(c.id, w.time, c.vol);
      for (const c of setCues(sets, setFlagsOf(w.player, (id) => w.setCount(id), behindColossusNow(w)))) play(c.id, w.time, c.vol);
      for (const c of reviveCues(rv, w.heroes.map((_, i) => w.heroData(i).player.reviveT ?? 0), w.reviveSeconds, w.revivesLeft)) play(c.id, w.time);
    }
    // Offline mix of the whole run, ordinary sounds and priority sounds on separate tracks.
    const total = Math.ceil((w.time + 4) * RATE);
    const ord = new Float32Array(total);
    const pri = new Float32Array(total);
    for (const p of plays) {
      const src = samplesOf(p.id);
      const dst = PRIORITY.has(p.id) ? pri : ord;
      const at = Math.floor(p.t * RATE);
      for (let n = 0; n < src.length && at + n < total; n++) dst[at + n] += src[n] * p.vol;
    }
    // The engine ducks ordinary sounds while a priority cue plays (DUCK in client/audio/cues.ts).
    const duck = new Float32Array(total).fill(1);
    if (process.env.NODUCK !== '1') {
      for (const p of plays) {
        if (!PRIORITY.has(p.id)) continue;
        const a = Math.floor(p.t * RATE);
        const b = Math.min(total, a + Math.floor(Math.min(DUCK.max, lengthOf(p.id)) * RATE));
        const g = DEEP_DUCK[p.id] ?? DUCK.gain;
        for (let n = a; n < b; n++) duck[n] = Math.min(duck[n], g);
      }
    }
    for (let n = 0; n < total; n++) ord[n] *= duck[n];
    const po = phone(ord);
    const pp = phone(pri);
    for (const p of plays) {
      if (!PRIORITY.has(p.id)) continue;
      const a = Math.floor(p.t * RATE);
      const b = Math.min(total, a + samplesOf(p.id).length);
      const bed = rms(po, a, b);
      if (bed < 1e-4) continue; // nothing else playing: nothing to mask it
      margins.push({ id: p.id, db: 20 * Math.log10(rms(pp, a, b) / bed) });
      // WHO=<id>: which ordinary sounds fill the bed under that cue (phone energy in its window, after the duck).
      if (process.env.WHO === p.id) {
        for (const o of plays) {
          if (PRIORITY.has(o.id)) continue;
          const oa = Math.floor(o.t * RATE), src = phoneOf(o.id);
          const lo = Math.max(a, oa), hi = Math.min(b, oa + src.length);
          let e = 0;
          for (let n = lo; n < hi; n++) e += (src[n - oa] * o.vol * duck[n]) ** 2;
          if (e > 0) who.set(o.id, (who.get(o.id) ?? 0) + e);
        }
      }
    }
    seconds += w.time;
    busiest = Math.max(busiest, ...perSecond.values());
  }
  const total = [...played.values()].reduce((a, b) => a + b, 0);
  const lost = [...dropped.values()].reduce((a, b) => a + b, 0);
  const lostPriority = [...dropped].filter(([id]) => PRIORITY.has(id as SoundId));
  console.log(`\n${dungeon}: ${seeds.length} runs, ${(seconds / seeds.length).toFixed(0)} s each, ${VOICES} voices`);
  console.log(`  played ${total} (${(total / seconds).toFixed(1)}/s, busiest second ${busiest}), peak voices ${peak}, dropped ${lost} (${((100 * lost) / Math.max(1, total + lost)).toFixed(1)}%)`);
  console.log(`  top: ${[...played].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TOP ?? 6)).map(([k, n]) => `${k} ${n}`).join(', ')}`);
  console.log(`  dropped: ${[...dropped].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`);
  margins.sort((a, b) => a.db - b.db);
  const q = (f: number) => margins[Math.floor(f * (margins.length - 1))]?.db.toFixed(1);
  const worst = new Map<SoundId, number[]>();
  for (const m of margins) worst.set(m.id, [...(worst.get(m.id) ?? []), m.db]);
  const byId = [...worst].map(([id, v]) => [id, v.sort((a, b) => a - b)[Math.floor(v.length / 2)]] as const).sort((a, b) => a[1] - b[1]);
  console.log(`  priority cue over the rest, on a phone: median ${q(0.5)} dB, worst 10% ${q(0.1)} dB (${margins.length} cues)`);
  console.log(`  quietest (median dB): ${byId.slice(0, Number(process.env.QUIET ?? 6)).map(([k, v]) => `${k} ${v.toFixed(1)} (n=${worst.get(k)!.length})`).join(', ')}`);
  if (process.env.WHO) { const tot = [...who.values()].reduce((x, y) => x + y, 0); console.log(`  under ${process.env.WHO}: ${[...who].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k} ${((100 * v) / tot).toFixed(0)}%`).join(', ')}`); }
  console.log(`  priority cues dropped: ${lostPriority.map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`);
}
