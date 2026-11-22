import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, recipeLength } from '../client/audio/synth';
import { PHONE_FLOOR_DB, SOUNDS, SoundId } from '../client/audio/sounds';
import { bedSamples, chordAt, HUB_BY_SEASON, hubThemeFor, sectionAt, themeFor, THEMES } from '../client/audio/music';
import { DUNGEON_IDS } from '../sim/content/dungeon';
import { SEASON_START_WEEK, SEASON, SEASONS, seasonOf, seasonRewards } from '../sim/content/season';
import { EDGE, EDGE_SOUNDS, edgeCue, withoutBankedSoaks, ISLAND_SLACK, islandCues, myIsland, DIECUT_R, WANDERING_VENTS, FLOOR_HEATS, VENT_SOUNDS, inLavaNow, landCueFor, LAYOUT_STING, spentCue, behindColossusNow, colossusCue, SHADOW_STING, BELLY, beatGap, bellyCues, DRY, pressedCue, CAST_SOUNDS, cueFor, DUCK, partyCues, PHASE_STING, phaseSting, pickCue, ebbCue, panFor, PAN_MAX, PRIORITY, setCues, setFlagsOf, THROTTLE, reviveCues, targetCue } from '../client/audio/cues';
import { ENEMIES } from '../sim/content/enemies';
import { buzzFor, BUZZ, Haptics } from '../client/audio/haptics';
import { uiSoundFor, Tappable } from '../client/audio/ui';
import { phoneDb, phoneShare } from '../tools/mixcheck';
import { LOOT_DEAL, lootCues, rewardCues } from '../client/audio/rewards';
import { nextTake, VARIANTS, variantOf } from '../client/audio/variants';
import { BRIM, COLO, IRONLOAD, LAYOUT, LAYOUTS, VARIETY, World, type SimEvent } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';
import type { DungeonId } from '../sim/content/dungeon';

const RATE = 22050;

describe('audio', () => {
  it('renders every sound effect as short, audible, unclipped samples', () => {
    for (const [id, recipe] of Object.entries(SOUNDS)) {
      const len = recipeLength(recipe);
      expect(len, id).toBeGreaterThan(0.02);
      expect(len, id).toBeLessThan(3);
      const s = render(recipe, RATE);
      let peak = 0;
      let finite = true;
      for (const v of s) {
        finite &&= Number.isFinite(v);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(finite, id).toBe(true);
      expect(peak, id).toBeGreaterThan(0.03);
      expect(peak, id).toBeLessThanOrEqual(1);
    }
  });

  it('renders repeatably', () => {
    expect(render(SOUNDS.hit, RATE)).toEqual(render(SOUNDS.hit, RATE));
  });

  it('builds seamless, normalized texture beds for every theme', () => {
    for (const th of Object.values(THEMES)) {
      const s = bedSamples(th.bed, RATE, 2);
      let peak = 0;
      for (const v of s) peak = Math.max(peak, Math.abs(v));
      expect(peak, th.bed).toBeCloseTo(1, 5);
      // Wrapping from the last sample to the first is no bigger a step than the bed's own jitter.
      expect(Math.abs(s[s.length - 1] - s[0]), th.bed).toBeLessThan(0.5);
    }
  });

  it('has a music theme for every dungeon', () => {
    for (const d of ['kiln', 'foundry', 'glarewell'] satisfies DungeonId[]) expect(THEMES[d]).toBeDefined();
  });

  it('gives real runs sounds that exist, for every class and dungeon', () => {
    const heard = new Set<SoundId>();
    const classes: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];
    const dungeons: DungeonId[] = ['kiln', 'foundry', 'glarewell'];
    classes.forEach((cls, k) => {
      const w = new World({ seed: 11 + k, cls, dungeon: dungeons[k % dungeons.length], tier: 1 });
      // Up to 150 simulated seconds per class: the Lumen bot casts its Burst only every minute or so, and a
      // Kiln pillar layout (V2) can push its first one past 75 s.
      for (let i = 0; i < 30 * 150 && w.state !== 'ended'; i++) {
        if (w.state === 'draft') w.choose(botChoose(w));
        else w.step(botInput(w));
        for (const ev of w.events) {
          const c = cueFor(ev, { cls, acting: w.acting });
          if (!c) continue;
          expect(SOUNDS[c.id], `${ev.type} -> ${c.id}`).toBeDefined();
          heard.add(c.id);
        }
      }
    });
    // The core moments of a run all make a sound.
    for (const id of ['hit', 'levelUp', 'emberWave', 'duskDash', 'bulwarkSlam', 'lumenBurst', 'slagLob', 'slagPlate'] as SoundId[]) expect(heard, id).toContain(id);
    // Four bot runs of up to 150 s each: about 2.4 s locally and 3.7 s on CI on main, so the 5 s default is too tight.
  }, 20000);

  it('keeps every sound audible on a phone speaker (a quarter of its energy above 350 Hz)', () => {
    for (const [id, recipe] of Object.entries(SOUNDS)) expect(phoneShare(render(recipe, 32000), 32000), id).toBeGreaterThan(0.25);
  });

  it('keeps every must-hear cue at least as loud on a phone as the floor, so none is buried in a 4-hero fight', () => {
    for (const id of PRIORITY) {
      const db = phoneDb(render(SOUNDS[id], 22050), 22050);
      expect(db, `${id} ${db.toFixed(1)} dB`).toBeGreaterThanOrEqual(PHONE_FLOOR_DB);
    }
  });

  it('plays every dungeon its own theme (the Crucible plays the raid), and GameScene asks themeFor', () => {
    for (const id of DUNGEON_IDS) expect(themeFor(id) in THEMES, id).toBe(true);
    expect(themeFor('hoard')).toBe('hoard');
    expect(themeFor('crucible')).toBe('raid');
    // #296's Hoard theme was lost once in a merge: GameScene must go through themeFor, not its own mapping.
    const scene = readFileSync(new URL('../client/GameScene.ts', import.meta.url), 'utf8');
    expect(scene).toContain('audio.theme(themeFor(w.dungeonId))');
  });

  it('gives raid 3, the Smeltery, its own theme (Y7): the Colossus stride, unlike the other raids', () => {
    expect(THEMES.smeltery.bed).toBe('stride');
    for (const other of ['raid', 'hoard'] as const) {
      expect(THEMES.smeltery.bed).not.toBe(THEMES[other].bed);
      expect(THEMES.smeltery.scale).not.toEqual(THEMES[other].scale);
    }
  });

  it('gives raid 4, the Flue, its own theme (B3): the chimney draft and the Regent shadow\'s call', () => {
    expect(THEMES.flue.bed).toBe('draft');
    expect(THEMES.flue.pluck).toBe('brass');
    for (const other of ['raid', 'hoard', 'smeltery'] as const) {
      expect(THEMES.flue.bed).not.toBe(THEMES[other].bed);
      expect(THEMES.flue.scale).not.toEqual(THEMES[other].scale);
    }
    const bed = bedSamples('draft', RATE);
    expect(bed.every(Number.isFinite)).toBe(true);
    expect(phoneShare(bed, RATE)).toBeGreaterThan(0.25);
  });

  it('gives every Furnace Regent moment in the Flue a sound (B3)', () => {
    const c = { cls: 'lumen' as const, acting: 1, boss: 'regent' as const };
    expect(themeFor('flue')).toBe('flue');
    expect(cueFor({ type: 'decree', hero: 1 }, c)?.id).toBe('decreeOnMe');
    expect(cueFor({ type: 'decree', hero: 2 }, c)).toEqual({ id: 'decreeLands', vol: 0.8 });
    // Handed to you is the same alarm as a landing; handed on by you is the handoff; between others, a quiet handoff.
    expect(cueFor({ type: 'decreePassed', from: 2, hero: 1, done: false }, c)?.id).toBe('decreeOnMe');
    expect(cueFor({ type: 'decreePassed', from: 1, hero: 3, done: false }, c)).toEqual({ id: 'decreePass' });
    expect(cueFor({ type: 'decreePassed', from: 1, hero: 3, done: true }, c)).toEqual({ id: 'decreePass' });
    expect(cueFor({ type: 'decreePassed', from: 2, hero: 1, done: true }, c)).toEqual({ id: 'decreePass', vol: 0.5 });
    expect(cueFor({ type: 'decreePassed', from: 2, hero: 3, done: false }, c)).toEqual({ id: 'decreePass', vol: 0.5 });
    expect(cueFor({ type: 'decreeBurst', hero: 3 }, c)?.id).toBe('decreeBurst');
    expect(cueFor({ type: 'officePulse', n: 1 }, c)?.vol).toBeCloseTo(0.73);
    expect(cueFor({ type: 'officePulse', n: 50 }, c)?.vol).toBe(1.3);
    expect(cueFor({ type: 'phase', phase: 2 }, c)?.id).toBe('phaseEdict');
    expect(cueFor({ type: 'phase', phase: 3 }, c)?.id).toBe('phaseAbdication');
    expect(cueFor({ type: 'castStart', index: 0, id: 'lastWord', name: 'Last Word' }, c)?.id).toBe('lastWordWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'lastWord', name: 'Last Word' }, c)?.id).toBe('lastWord');
    for (const id of ['decreeOnMe', 'lastWordWarn', 'phaseEdict', 'phaseAbdication'] as const) expect(PRIORITY.has(id), id).toBe(true);
    // GameScene passes Spent to the engine, which plays spentCue.
    const scene = readFileSync(new URL('../client/GameScene.ts', import.meta.url), 'utf8');
    expect(scene).toContain("spent: w.dungeonId === 'flue' && (w.player.spentT ?? 0) > 0");
  });

  it('hears the Flue\'s Spent end once, and nothing going in', () => {
    const st = { on: false };
    expect(spentCue(st, false)).toBeNull();
    expect(spentCue(st, true)).toBeNull();
    expect(spentCue(st, true)).toBeNull();
    expect(spentCue(st, false)?.id).toBe('spentEnd');
    expect(spentCue(st, false)).toBeNull();
    // Last Word's wind-up fits inside its 5 s cast; the Decree cues are short enough to stack.
    expect(recipeLength(SOUNDS.lastWordWarn)).toBeLessThan(5);
    expect(recipeLength(SOUNDS.decreePass)).toBeLessThan(0.6);
  });

  it('gives each world boss shadow its own sting, keyed by the server names', () => {
    const c = { cls: 'bulwark' as const, acting: 0, boss: 'worldShadow' as const };
    const sql = readFileSync(new URL('../supabase/migrations/0007_rename_old_ashmaw.sql', import.meta.url), 'utf8');
    const names = /names\s+text\[\]\s*:=\s*array\[([^\]]+)\]/.exec(sql)![1].split(',').map((n) => n.trim().replace(/^'|'$/g, ''));
    expect(names.length).toBe(4);
    const stings = new Set<string>();
    for (const n of names) {
      const id = cueFor({ type: 'phase', phase: 2 }, { ...c, worldBoss: n })?.id;
      expect(id, n).toBe(SHADOW_STING[n]);
      expect(PRIORITY.has(id as SoundId), n).toBe(true);
      stings.add(id!);
    }
    expect(stings.size).toBe(4);
    expect(cueFor({ type: 'phase', phase: 2 }, { ...c, worldBoss: 'Old Ashmaw' })?.id).toBe('shadowCoal');
    expect(cueFor({ type: 'phase', phase: 2 }, { ...c, worldBoss: 'Someone New' })?.id).toBe('phaseShadow');
    expect(cueFor({ type: 'phase', phase: 2 }, c)?.id).toBe('phaseShadow');
    // A real boss fight in a world boss's dungeon keeps its own sting.
    expect(cueFor({ type: 'phase', phase: 2 }, { ...c, boss: 'vorhulm', worldBoss: 'Old Vorhulm' })?.id).toBe('phaseSwallow');
  });

  it('gives the hub its equip, passive point and world boss claim sounds', () => {
    const stub = (sfx: string): Tappable => ({ closest: () => stub(sfx), getAttribute: (n) => (n === 'data-sfx' ? sfx : null) });
    expect(uiSoundFor(stub('equip'))).toBe('equip');
    expect(uiSoundFor(stub('passive'))).toBe('passive');
    const hub = readFileSync(new URL('../client/hub.ts', import.meta.url), 'utf8');
    expect(hub).toContain('data-sfx="equip"');
    expect(hub).toContain("data-sfx=\"${can ? 'passive' : 'click'}\"");
    expect(hub).toContain('this.onClaimed();');
    expect(readFileSync(new URL('../client/main.ts', import.meta.url), 'utf8')).toContain("hub.onClaimed = () => audio.play('bossClaim');");
  });

  it('gives the Hoard its own theme and every Old Vorhulm moment a sound', () => {
    expect(THEMES.hoard.bed).toBe('chew');
    expect(THEMES.hoard).not.toEqual(THEMES.raid);
    const c = { cls: 'bulwark' as const, acting: 0, boss: 'vorhulm' as const };
    expect(cueFor({ type: 'swallowed', hero: 1 }, c)?.id).toBe('swallowed');
    expect(PRIORITY.has('swallowed')).toBe(true);
    expect(cueFor({ type: 'spatOut', hero: 0 }, c)).toEqual({ id: 'spatOut' });
    expect(cueFor({ type: 'spatOut', hero: 1 }, c)).toEqual({ id: 'spatOut', vol: 0.7 });
    expect(cueFor({ type: 'digested', hero: 1 }, c)).toEqual({ id: 'digested', vol: 0.8 });
    expect(cueFor({ type: 'kill', x: 0, y: 0, kind: 'craw' }, c)?.id).toBe('crawBreak');
    expect(cueFor({ type: 'emberTaken', x: 0, y: 0 }, c)?.id).toBe('emberTaken');
    expect(cueFor({ type: 'emberEaten', x: 0, y: 0, fed: 1 }, c)?.vol).toBeCloseTo(0.84);
    expect(cueFor({ type: 'emberEaten', x: 0, y: 0, fed: 30 }, c)?.vol).toBe(1.2);
    expect(cueFor({ type: 'castStart', index: 0, id: 'coalGorge', name: 'Gorge' }, c)?.id).toBe('gorgeWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'lastMeal', name: 'Last Meal' }, c)?.id).toBe('lastMealWarn');
    expect(PRIORITY.has('gorgeWarn') && PRIORITY.has('lastMealWarn')).toBe(true);
    expect(cueFor({ type: 'phase', phase: 2 }, c)?.id).toBe('phaseSwallow');
    expect(cueFor({ type: 'phase', phase: 3 }, c)?.id).toBe('phaseFeast');
    // The Gorge wind-up has to fit inside its 3 s cast, so the interrupt lands on a sound that is still going.
    expect(recipeLength(SOUNDS.gorgeWarn)).toBeLessThanOrEqual(3);
  });

  it('gives every Cinder Colossus moment in the Smeltery a sound', () => {
    expect(THEMES.smeltery).not.toEqual(THEMES.raid);
    const c = { cls: 'duskblade' as const, acting: 0, boss: 'colossus' as const };
    expect(cueFor({ type: 'castStart', index: 0, id: 'slagSweep', name: 'Slag Sweep' }, c)?.id).toBe('sweepWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'slagSweep', name: 'Slag Sweep' }, c)?.id).toBe('slagSweep');
    expect(cueFor({ type: 'castStart', index: 0, id: 'wheel', name: 'Wheel' }, c)?.id).toBe('wheelWarn');
    // Wheel's end is the wheel event plus the Sweep wind-up on the same tick, so its own castDone stays quiet.
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'wheel', name: 'Wheel' }, c)).toBeNull();
    expect(cueFor({ type: 'castStart', index: 0, id: 'pourOut', name: 'Pour Out' }, c)?.id).toBe('pourOutWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'pourOut', name: 'Pour Out' }, c)?.id).toBe('pourOut');
    expect(cueFor({ type: 'wheel', hero: 0 }, c)?.id).toBe('wheelOnMe');
    expect(cueFor({ type: 'wheel', hero: 2 }, c)).toBeNull();
    expect(cueFor({ type: 'meltPulse', n: 1 }, c)?.vol).toBeCloseTo(0.73);
    expect(cueFor({ type: 'meltPulse', n: 40 }, c)?.vol).toBe(1.3);
    expect(cueFor({ type: 'phase', phase: 2 }, c)?.id).toBe('phaseWheel');
    expect(cueFor({ type: 'phase', phase: 3 }, c)?.id).toBe('phaseMeltdown');
    for (const id of ['sweepWarn', 'wheelWarn', 'pourOutWarn', 'wheelOnMe', 'phaseWheel', 'phaseMeltdown'] as const) expect(PRIORITY.has(id), id).toBe(true);
    // Front and back: only this screen's own hits on him, and only while the plate holds (colossusCue unset in phase 3).
    const hit = (hero: number | undefined, x = 100, y = 50) => ({ type: 'hit' as const, x, y, amount: 10, crit: false, hero });
    const at = (side: number) => ({ ...c, colossus: { x: 100, y: 50, side } });
    expect(cueFor(hit(0), at(0.5))?.id).toBe('plateHit');
    expect(cueFor(hit(0), at(1.5))?.id).toBe('backHit');
    expect(cueFor(hit(0), at(1))?.id).toBe('hit');
    expect(cueFor(hit(1), at(1.5))?.id).toBe('hit');
    expect(cueFor(hit(0, 300, 50), at(1.5))?.id).toBe('hit');
    expect(cueFor(hit(0), c)?.id).toBe('hit');
    // Pour Out's wind-up fits inside its 5 s cast.
    expect(recipeLength(SOUNDS.pourOutWarn)).toBeLessThan(5);
  });

  it('hears the real Smeltery fight: wheel, Meltdown pulses and both sides of the Colossus', () => {
    const w = new World({ seed: 3, dungeon: 'smeltery', tier: 10, omens: [], cls: 'duskblade', party: (['bulwark', 'lumen', 'emberwright'] as const).map((cls, k) => ({ cls, name: `${cls}${k}` })) });
    const heard = new Set<string>();
    let phase3Side = false;
    while (w.state !== 'ended' && w.time < 900) {
      if (w.state === 'draft') {
        const h = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
        w.use(h);
        const pick = botChoose(w);
        w.use(0);
        w.choose(pick, h);
        continue;
      }
      const inputs = w.heroes.map((_, i) => { w.use(i); const inp = botInput(w); w.use(0); return inp; });
      w.step(inputs);
      const col = colossusCue(w);
      if (col && w.bossPhase >= 3) phase3Side = true;
      for (const ev of w.events) {
        const cue = cueFor(ev, { cls: w.cls, acting: 0, boss: w.bossIndex >= 0 ? w.enemies[w.bossIndex]?.kind : undefined, colossus: col });
        if (cue) heard.add(cue.id);
      }
    }
    for (const id of ['sweepWarn', 'slagSweep', 'wheelWarn', 'phaseWheel', 'phaseMeltdown', 'meltPulse', 'backHit']) expect(heard.has(id), id).toBe(true);
    expect(phase3Side).toBe(false);
  }, 60_000);

  it('gives the Anvil Slagbinder plated hits and each stance its own pick sound', () => {
    const anvil = { cls: 'slagbinder' as const, acting: 0, stance: 'anvil' };
    const bellows = { cls: 'slagbinder' as const, acting: 0, stance: 'bellows' };
    expect(cueFor({ type: 'playerHurt', hero: 0, amount: 5 } as never, anvil)?.id).toBe('hurtAnvil');
    expect(cueFor({ type: 'playerHurt', hero: 0, amount: 30 } as never, anvil)?.id).toBe('hurtBigAnvil');
    expect(cueFor({ type: 'playerHurt', hero: 0, amount: 5 } as never, bellows)?.id).toBe('hurt');
    expect(cueFor({ type: 'playerHurt', hero: 0, amount: 5 } as never, { cls: 'bulwark' as const, acting: 0, stance: 'anvil' })?.id).toBe('hurt');
    expect(cueFor({ type: 'playerHurt', hero: 1, amount: 5 } as never, anvil)).toBeNull();
    const stub = (sfx: string): Tappable => ({ closest: () => stub(sfx), getAttribute: (n) => (n === 'data-sfx' ? sfx : null) });
    expect(uiSoundFor(stub('anvilPick'))).toBe('anvilPick');
    expect(uiSoundFor(stub('bellowsPick'))).toBe('bellowsPick');
  });

  it('hears the Pressworks turn rule: a clamp when Pressed, a release when it wears off', () => {
    const st = { on: false };
    expect(pressedCue(st, false)).toBeNull();
    expect(pressedCue(st, true)?.id).toBe('pressed');
    expect(pressedCue(st, true)).toBeNull();
    expect(pressedCue(st, false)?.id).toBe('pressedClear');
    expect(pressedCue(st, false)).toBeNull();
    // The clamp waits for the soak chime that lands on the same tick.
    expect(Math.min(...SOUNDS.pressed.map((v) => v.delay ?? 0))).toBeGreaterThanOrEqual(0.2);
  });

  it('muffles the mix and runs a quickening heartbeat while swallowed', () => {
    expect(BELLY.shut).toBeLessThan(BELLY.open);
    // A phone speaker plays little below 350 Hz: the muffle must leave it something.
    expect(BELLY.shut).toBeGreaterThan(700);
    expect(DRY.has('heartbeat')).toBe(true);
    const st = { on: false, next: 0 };
    expect(bellyCues(st, 0, 0)).toEqual([]);
    expect(bellyCues(st, 8, 10)).toEqual([]); // swallowed: the gulp lands first
    expect(st.on).toBe(true);
    expect(bellyCues(st, 7.9, 10.2)).toEqual([]);
    expect(bellyCues(st, 7.8, 10.4).map((b) => b.id)).toEqual(['heartbeat']);
    expect(st.next).toBeCloseTo(10.4 + beatGap(7.8));
    expect(beatGap(1)).toBeLessThan(beatGap(8));
    expect(bellyCues(st, 0.5, 20)[0].vol).toBeGreaterThan(bellyCues({ on: true, next: 0 }, 8, 0)[0].vol ?? 1);
    expect(bellyCues(st, 0, 21)).toEqual([]); // out
    expect(st.on).toBe(false);
  });

  it('gives the Hammerdeep its theme and Ondrel\'s casts their own sounds', () => {
    expect(THEMES.hammerdeep).toBeDefined();
    for (const s of Object.values(CAST_SOUNDS)) for (const id of [s.start, s.done]) if (id) expect(SOUNDS[id]).toBeDefined();
    const c = { cls: 'bulwark' as const, acting: 0 };
    expect(cueFor({ type: 'castStart', index: 0, id: 'anvilfall', name: 'Anvilfall' }, c)?.id).toBe('anvilWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'anvilfall', name: 'Anvilfall' }, c)?.id).toBe('anvilfall');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'choir', name: 'Choir of Iron' }, c)?.id).toBe('choir');
    expect(cueFor({ type: 'castStart', index: 0, id: 'cataclysm', name: 'Molten Cataclysm' }, c)?.id).toBe('castWarn');
    expect(cueFor({ type: 'slagGrip', x: 0, y: 0, stacks: 5 }, c)).toMatchObject({ id: 'slag', vol: 1.05 });
    expect(cueFor({ type: 'cleanse', x: 0, y: 0 }, c)?.id).toBe('cleanse');
  });

  it('gives every boss its own phase-change sting', () => {
    const bosses = Object.values(ENEMIES).filter((e) => e.rank === 'boss').map((e) => e.id);
    expect(bosses.length).toBeGreaterThan(0);
    for (const b of bosses) {
      const id = cueFor({ type: 'phase', phase: 2 }, { cls: 'lumen', acting: 0, boss: b })?.id;
      expect(id, b).toBe(phaseSting(b, 2)); // a brand-new boss falls back to the generic sting
      expect(id === 'phase', b).toBe(!PHASE_STING[b]);
      expect(SOUNDS[id!], b).toBeDefined();
    }
    expect(cueFor({ type: 'phase', phase: 2 }, { cls: 'lumen', acting: 0 })?.id).toBe('phase');
  });

  it('stings once when Anvilfall winds up on you, and again on the next one', () => {
    const t = { on: false };
    expect(targetCue(t, false)).toBeNull();
    expect(targetCue(t, true)?.id).toBe('targeted');
    expect(targetCue(t, true)).toBeNull(); // same wind-up
    expect(targetCue(t, false)).toBeNull();
    expect(targetCue(t, true)?.id).toBe('targeted');
  });

  it('hears co-op heroes go down and get back up', () => {
    const down: boolean[] = [];
    expect(partyCues(down, [100, 80, 60], 0)).toEqual([]); // first look only records
    expect(partyCues(down, [100, 0, 60], 0).map((c) => c.id)).toEqual(['allyDown']);
    expect(partyCues(down, [100, 0, 60], 0)).toEqual([]); // still down: no repeat
    expect(partyCues(down, [0, 0, 60], 0).map((c) => c.id)).toEqual(['selfDown']);
    expect(partyCues(down, [30, 24, 60], 0).map((c) => c.id)).toEqual(['allyUp', 'allyUp']);
    expect(partyCues(down, [30, 24], 0)).toEqual([]); // someone left: start over quietly
    const roles = ['dps', 'tank', 'healer', 'dps'];
    const d2: boolean[] = [];
    partyCues(d2, [9, 9, 9, 9], 0, roles);
    expect(partyCues(d2, [9, 0, 0, 0], 0, roles).map((c) => c.id)).toEqual(['roleDown', 'roleDown', 'allyDown']);
  });

  it('buzzes for your own big hits and boss telegraphs, not for allies', () => {
    const c = { cls: 'bulwark' as const, acting: 0 };
    expect(buzzFor({ type: 'playerHurt', amount: 30, hero: 0 }, c)).toBe(BUZZ.hurtBig);
    expect(buzzFor({ type: 'playerHurt', amount: 5 }, c)).toBe(BUZZ.hurt);
    expect(buzzFor({ type: 'playerHurt', amount: 30, hero: 1 }, c)).toBeNull();
    expect(buzzFor({ type: 'castStart', index: 0, id: 'anvilfall', name: 'Anvilfall' }, c)).toBe(BUZZ.telegraph);
    expect(buzzFor({ type: 'hit', x: 0, y: 0, amount: 9, crit: false }, c)).toBeNull();
    for (const p of Object.values(BUZZ)) expect(p.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(400);
  });

  it('throttles vibration, letting a longer pattern cut in', () => {
    const calls: number[][] = [];
    const g = globalThis as unknown as { navigator?: unknown };
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (p: number[]) => calls.push(p) }, configurable: true });
    try {
      const h = new Haptics();
      h.buzz(BUZZ.hurt, 1000);
      h.buzz(BUZZ.hurt, 1050); // too soon, not longer: dropped
      h.buzz(BUZZ.targeted, 1060); // longer: cuts in
      h.buzz(BUZZ.hurt, 1300);
      h.enabled = false;
      h.buzz(BUZZ.hurtBig, 2000);
      expect(calls).toEqual([BUZZ.hurt, BUZZ.targeted, BUZZ.hurt]);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'navigator', saved);
      else delete g.navigator;
    }
  });

  it('picks interface sounds by what was tapped', () => {
    // A stand-in element: matches a selector if any of its "tags" appear in it.
    const el = (tags: string[], attrs: Record<string, string> = {}): Tappable => {
      const self: Tappable = {
        closest: (sel) => (sel.split(',').some((q) => tags.some((t) => q.trim() === t)) ? self : null),
        getAttribute: (n) => attrs[n] ?? null,
      };
      return self;
    };
    expect(uiSoundFor(el(['button', '#startBtn']))).toBe('confirm');
    expect(uiSoundFor(el(['button', '#menuBtn']))).toBe('back');
    expect(uiSoundFor(el(['button', '#bagBtn']))).toBe('open');
    expect(uiSoundFor(el(['button', '[data-cls]'], { 'aria-pressed': 'false' }))).toBe('select');
    expect(uiSoundFor(el(['button']))).toBe('click');
    expect(uiSoundFor(el(['[data-sfx]', 'button'], { 'data-sfx': 'select' }))).toBe('select');
    expect(uiSoundFor(el(['[data-sfx]', 'button'], { 'data-sfx': 'none' }))).toBeNull();
    expect(uiSoundFor(el(['div']))).toBeNull();
    for (const id of ['salvage', 'salvageAll', 'forge', 'temper', 'brew']) expect(uiSoundFor(el(['[data-sfx]', 'button'], { 'data-sfx': id }))).toBe(id);
  });

  it('makes Salvage all a heavier, longer break than one salvage that ends near the purse animation', () => {
    const one = render(SOUNDS.salvage, RATE), all = render(SOUNDS.salvageAll, RATE);
    const energy = (s: Float32Array) => s.reduce((t, v) => t + v * v, 0);
    expect(energy(all)).toBeGreaterThan(energy(one) * 2);
    expect(recipeLength(SOUNDS.salvageAll)).toBeGreaterThan(0.7);
    expect(recipeLength(SOUNDS.salvageAll)).toBeLessThan(1.2);
  });

  it('hears the Kiln\'s new foes: the lob, the charge and the Rift spitting Ashlings (V6)', () => {
    const c = { cls: 'emberwright' as const, acting: 0 };
    expect(CAST_SOUNDS.emberLob.start).toBe('spitLob');
    expect(CAST_SOUNDS.charge.start).toBe('chargeWindup');
    // Kiln Draw (KILN_DRAW.cast 2.2 s): the inhale fills the cast and the ring's roar plays the moment it lands.
    expect(CAST_SOUNDS.kilnDraw).toEqual({ start: 'kilnDraw', done: 'ringClose' });
    expect(recipeLength(SOUNDS.kilnDraw)).toBeLessThanOrEqual(2.3);
    expect(SOUNDS.ringClose.every((v) => (v.delay ?? 0) < 0.05)).toBe(true);
    expect(cueFor({ type: 'charge', index: 0 } as never, c)?.id).toBe('chargeDash');
    expect(cueFor({ type: 'riftSpawn', index: 0, n: 2 } as never, c)?.id).toBe('riftSpit');
    expect(THROTTLE.riftSpit).toBeGreaterThan(0);
    // The lob's cough plays at the cast start; the event itself only schedules the landing.
    expect(cueFor({ type: 'spitLob', index: 0, x1: 0, y1: 0, x2: 1, y2: 1 } as never, c)).toBeNull();
    expect(landCueFor({ type: 'spitLob', index: 0, x1: 0, y1: 0, x2: 1, y2: 1 } as never)).toMatchObject({ id: 'spitLand', after: VARIETY.lobLand });
    expect(landCueFor({ type: 'charge', index: 0 } as never)).toBeNull();
    // The real sim: a spitter's lob lands its circle exactly when the landing sound is due.
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    for (const e of w.enemies) e.alive = false;
    w.player.x = 0; w.player.y = 0;
    const inner = w as unknown as { spawn(k: string, x: number, y: number): number; runAbilities(i: number, dt: number): void };
    const i = inner.spawn('emberSpitter', 200, 0);
    w.enemies[i].abilityT = 0;
    w.events.length = 0;
    inner.runAbilities(i, 0.01);
    const lob = w.events.find((ev) => ev.type === 'spitLob')!;
    expect(lob).toBeDefined();
    const tele = w.telegraphs.find((q) => q.alive && q.owner === i)!;
    expect(tele.dur).toBeCloseTo(landCueFor(lob)!.after!, 5);
  });

  it('hears the Kiln layouts: a sting per arena, the vent flare landing and lava sizzling underfoot (V6)', () => {
    const c = { cls: 'emberwright' as const, acting: 0 };
    expect(cueFor({ type: 'layout', id: 'open' } as never, c)).toBeNull();
    for (const id of ['pillars', 'channel', 'vents'] as const) {
      expect(cueFor({ type: 'layout', id } as never, c)?.id).toBe(LAYOUT_STING[id]);
      expect(SOUNDS[LAYOUT_STING[id]!], id).toBeDefined();
    }
    expect(cueFor({ type: 'ventFlare', x: 0, y: 0 } as never, c)?.id).toBe('kilnVentWarn');
    expect(landCueFor({ type: 'ventFlare', x: 0, y: 0 } as never)).toMatchObject({ id: 'lavaFlare', after: LAYOUT.ventCast });
    expect(THROTTLE.lavaSizzle).toBeGreaterThan(0.2);
    // inLavaNow agrees with the sim's own burn: in the strip it burns, a step outside it doesn't.
    const strip = { x1: -300, y1: 0, x2: 300, y2: 0, w: LAYOUT.lavaWidth };
    for (const [y, inside] of [[0, true], [LAYOUT.lavaWidth / 2 - 2, true], [LAYOUT.lavaWidth / 2 + 2, false], [200, false]] as const) {
      const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
      for (const e of w.enemies) e.alive = false;
      w.lava = [strip];
      w.player.x = 0; w.player.y = y;
      expect(inLavaNow(w), `y=${y}`).toBe(inside);
      const hp = w.player.hp;
      (w as unknown as { layoutClock(dt: number): void }).layoutClock(0.5);
      expect(w.player.hp < hp, `burns at y=${y}`).toBe(inside);
    }
    expect(inLavaNow({ lava: [strip], player: { x: 0, y: 0, hp: 0 } })).toBe(false);
  });

  it('steams the Drowned Foundry\'s vents instead of fire (V8)', () => {
    const kiln = { cls: 'emberwright' as const, acting: 0, dungeon: 'kiln' };
    const foundry = { ...kiln, dungeon: 'foundry' };
    const vent = { type: 'ventFlare', x: 0, y: 0 } as never;
    expect(cueFor(vent, kiln)?.id).toBe('kilnVentWarn');
    expect(cueFor(vent, foundry)?.id).toBe('steamVentWarn');
    expect(landCueFor(vent, 'kiln')?.id).toBe('lavaFlare');
    expect(landCueFor(vent, 'foundry')).toMatchObject({ id: 'steamBurst', after: LAYOUT.ventCast });
    expect(cueFor({ type: 'layout', id: 'vents' } as never, foundry)?.id).toBe('layoutSteam');
    expect(cueFor({ type: 'layout', id: 'pillars' } as never, foundry)?.id).toBe('layoutPillars');
    expect(cueFor({ type: 'layout', id: 'vents' } as never, kiln)?.id).toBe('layoutVents');
  });

  it('gives every dungeon whose layouts roll vents its own vent sounds (V8)', () => {
    for (const [d, pool] of Object.entries(LAYOUTS)) if (pool?.includes('vents')) expect(VENT_SOUNDS[d], d).toBeDefined();
    const glare = { cls: 'emberwright' as const, acting: 0, dungeon: 'glarewell' };
    expect(cueFor({ type: 'ventFlare', x: 0, y: 0 } as never, glare)?.id).toBe('lensVentWarn');
    expect(landCueFor({ type: 'ventFlare', x: 0, y: 0 } as never, 'glarewell')?.id).toBe('lensFlare');
    expect(cueFor({ type: 'layout', id: 'vents' } as never, glare)?.id).toBe('layoutLens');
    expect(cueFor({ type: 'ventFlare', x: 0, y: 0 } as never, { ...glare, dungeon: undefined as never })?.id).toBe('kilnVentWarn');
  });

  it('gives the Hammerdeep its own forge vents and Ondrel\'s Ironload its own weight (Phase 12 W2)', () => {
    const deep = { cls: 'bulwark' as const, acting: 0, dungeon: 'hammerdeep' };
    expect(cueFor({ type: 'ventFlare', x: 0, y: 0 } as never, deep)?.id).toBe('forgeVentWarn');
    expect(landCueFor({ type: 'ventFlare', x: 0, y: 0 } as never, 'hammerdeep')?.id).toBe('forgeFlare');
    expect(cueFor({ type: 'layout', id: 'vents' } as never, deep)?.id).toBe('layoutForge');
    // The forge set is its own, not the Kiln's borrowed one.
    expect(VENT_SOUNDS.hammerdeep).not.toEqual(VENT_SOUNDS.kiln);
    expect(CAST_SOUNDS.ironload).toEqual({ start: 'ironloadWarn', done: 'ironloadMark' });
    expect(PRIORITY.has('ironloadWarn')).toBe(true);
    // The weight lands as an IRONLOAD.radius slam; other slams keep the plain slam, and so does r 110 elsewhere.
    expect(cueFor({ type: 'slam', x: 0, y: 0, r: IRONLOAD.radius } as never, deep)?.id).toBe('ironload');
    expect(cueFor({ type: 'slam', x: 0, y: 0, r: 160 } as never, deep)?.id).toBe('slam');
    expect(cueFor({ type: 'slam', x: 0, y: 0, r: IRONLOAD.radius } as never, { ...deep, dungeon: 'foundry' })?.id).toBe('slam');
    for (const id of ['ironloadWarn', 'ironloadMark', 'ironload', 'forgeVentWarn', 'forgeFlare', 'layoutForge'] as const) expect(recipeLength(SOUNDS[id]), id).toBeLessThan(3);
  });

  it('tells Ysmeret\'s Wandering Vents from her Twin Vents (Phase 12 W2)', () => {
    const ash = { cls: 'bulwark' as const, acting: 0, dungeon: 'ashvents' };
    expect(cueFor({ type: 'castStart', index: 0, id: 'twinVents', name: WANDERING_VENTS } as never, ash)?.id).toBe('wanderVentWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'twinVents', name: 'Twin Vents' } as never, ash)?.id).toBe('ventWarn');
    expect(PRIORITY.has('wanderVentWarn')).toBe(true);
    expect(recipeLength(SOUNDS.wanderVentWarn)).toBeLessThan(3);
    // The sim must still call the wander version by this exact name.
    expect(readFileSync('sim/world.ts', 'utf8')).toContain(`'${WANDERING_VENTS}'`);
  });

  it('gives Oskel\'s Die Cut a wind-up and a shear, and the Pressworks its own steam-press vents (Phase 12 W2)', () => {
    const press = { cls: 'bulwark' as const, acting: 0, dungeon: 'pressworks' };
    expect(CAST_SOUNDS.dieCut).toEqual({ start: 'dieCutWarn' });
    expect(PRIORITY.has('dieCutWarn')).toBe(true);
    expect(cueFor({ type: 'slam', x: 0, y: 0, r: DIECUT_R } as never, press)?.id).toBe('dieCut');
    expect(cueFor({ type: 'slam', x: 0, y: 0, r: 160 } as never, press)?.id).toBe('slam');
    expect(cueFor({ type: 'slam', x: 0, y: 0, r: DIECUT_R } as never, { ...press, dungeon: 'kiln' })?.id).toBe('slam');
    // The sim's Die Cut cone must still be DIECUT_R across (ARENA * 2).
    expect(readFileSync('sim/world.ts', 'utf8')).toMatch(/addTelegraph\('cone', e\.x, e\.y, ARENA \* 2, a, Math\.PI, DIECUT\.fuse/);
    expect(cueFor({ type: 'ventFlare', x: 0, y: 0 } as never, press)?.id).toBe('pressVentWarn');
    expect(landCueFor({ type: 'ventFlare', x: 0, y: 0 } as never, 'pressworks')?.id).toBe('pressBurst');
    expect(cueFor({ type: 'layout', id: 'vents' } as never, press)?.id).toBe('layoutPress');
    expect(VENT_SOUNDS.pressworks).not.toEqual(VENT_SOUNDS.hammerdeep);
    // The warning must finish well inside the 2.4 s fuse.
    expect(recipeLength(SOUNDS.dieCutWarn)).toBeLessThanOrEqual(1.8);
    for (const id of ['dieCut', 'pressVentWarn', 'pressBurst', 'layoutPress'] as const) expect(recipeLength(SOUNDS[id]), id).toBeLessThan(3);
  });

  it('sounds the Brimming: the pit filling, each island sinking (loudest under you) and rising again (Phase 12 W3)', () => {
    expect(CAST_SOUNDS.brimming).toEqual({ start: 'brimWarn' });
    expect(PRIORITY.has('brimWarn')).toBe(true);
    const st = { t: [] as number[] };
    expect(islandCues(st, [{ t: 4 }, { t: 8 }, { t: 12 }], 1)).toEqual([]);
    // Island 0 crosses into its last BRIM.warn s: a quiet hiss, since this hero is on island 1.
    expect(islandCues(st, [{ t: BRIM.warn - 0.01 }, { t: 7.9 }, { t: 11.9 }], 1)).toEqual([{ id: 'islandSink', vol: 0.55 }]);
    expect(islandCues(st, [{ t: 1 }, { t: 7 }, { t: 11 }], 1)).toEqual([]);
    // It sinks and a new one rises in its slot.
    expect(islandCues(st, [{ t: BRIM.life }, { t: 6.9 }, { t: 10.9 }], 1)).toEqual([{ id: 'islandRise', vol: 0.6 }]);
    expect(islandCues(st, [{ t: 11.9 }, { t: BRIM.warn - 0.01 }, { t: 10.8 }], 1)).toEqual([{ id: 'islandSink', vol: 1.1 }]);
    expect(islandCues(st, [], -1)).toEqual([]);
    expect(st.t).toEqual([]);
    // myIsland uses the sim's own rule: BRIM.radius plus half of PLAYER_RADIUS.
    const src = readFileSync('sim/world.ts', 'utf8');
    expect(src).toContain('const PLAYER_RADIUS = 12;');
    expect(src).toContain('(BRIM.radius + PLAYER_RADIUS * 0.5) ** 2');
    expect(ISLAND_SLACK).toBe(6);
    const w = { islands: [{ x: 0, y: 0, t: 5 }, { x: 300, y: 0, t: 5 }], player: { x: 300 + BRIM.radius + 5, y: 0 } };
    expect(myIsland(w)).toBe(1);
    expect(myIsland({ ...w, player: { x: 300 + BRIM.radius + 7, y: 0 } })).toBe(-1);
    for (const id of ['brimWarn', 'islandSink', 'islandRise'] as const) expect(recipeLength(SOUNDS[id]), id).toBeLessThan(3);
  });

  it('lets the ember cues tell a Banked Coal, not the missed-soak sound (Phase 12 W3)', () => {
    expect(CAST_SOUNDS.bankedCoals).toEqual({ start: 'bankWarn' });
    expect(PRIORITY.has('bankWarn')).toBe(true);
    expect(recipeLength(SOUNDS.bankWarn)).toBeLessThan(3);
    const missed = [{ type: 'soak', ok: false, x: 10, y: 20 }, { type: 'heal', x: 0, y: 0, amount: 5 }, { type: 'emberEaten', x: 10, y: 20, fed: 1 }] as SimEvent[];
    expect(withoutBankedSoaks(missed).map((e) => e.type)).toEqual(['heal', 'emberEaten']);
    const smothered = [{ type: 'soak', ok: true, x: 5, y: 5 }, { type: 'emberTaken', x: 5, y: 5 }] as SimEvent[];
    expect(withoutBankedSoaks(smothered).map((e) => e.type)).toEqual(['emberTaken']);
    // The owner field says it outright (#432), with or without the ember event.
    expect(withoutBankedSoaks([{ type: 'soak', ok: false, x: 9, y: 9, owner: -4 }] as SimEvent[])).toEqual([]);
    expect(withoutBankedSoaks([{ type: 'soak', ok: false, x: 9, y: 9, owner: -2 }] as SimEvent[]).length).toBe(1);
    // Any other soak (no ember at its spot) keeps its cue.
    const other = [{ type: 'soak', ok: false, x: 1, y: 1 }, { type: 'emberTaken', x: 50, y: 50 }] as SimEvent[];
    expect(withoutBankedSoaks(other).map((e) => e.type)).toEqual(['soak', 'emberTaken']);
    // The sim must still answer each Banked Coal with an ember event at the coal's own spot.
    const src = readFileSync('sim/world.ts', 'utf8');
    expect(src).toContain("if (ok) this.events.push({ type: 'emberTaken', x: t.x, y: t.y });");
    expect(src).toContain('else this.feedVorhulm(t.x, t.y);');
  });

  it('sets the Colossus\'s Plate Shift apart from the Wheel (Phase 12 W3)', () => {
    expect(CAST_SOUNDS.plateShift).toEqual({ start: 'plateShiftWarn', done: 'plateLock' });
    expect(PRIORITY.has('plateShiftWarn')).toBe(true);
    expect(CAST_SOUNDS.plateShift.start).not.toBe(CAST_SOUNDS.wheel.start);
    // The wind-up ends inside the 2 s cast (COLO.wheelCast).
    expect(recipeLength(SOUNDS.plateShiftWarn)).toBeLessThanOrEqual(COLO.wheelCast);
    expect(recipeLength(SOUNDS.plateLock)).toBeLessThan(3);
    const smelt = { cls: 'duskblade' as const, acting: 1, dungeon: 'smeltery' };
    expect(cueFor({ type: 'castDone', index: 0, id: 'plateShift' } as never, smelt)?.id).toBe('plateLock');
    expect(cueFor({ type: 'wheel', hero: 1 } as never, smelt)?.id).toBe('wheelOnMe');
  });

  it('gives every arena-edge prop set two quiet sounds, from the side, between boss fights', () => {
    // Every dungeon GameScene dresses with edge props (EDGE_SETS) has sounds.
    const scene = readFileSync('client/GameScene.ts', 'utf8');
    const block = scene.slice(scene.indexOf('const EDGE_SETS'), scene.indexOf('};', scene.indexOf('const EDGE_SETS')));
    const sets = [...block.matchAll(/^\s+([a-z]+): \{ big:/gm)].map((m) => m[1]);
    expect(sets.length).toBeGreaterThanOrEqual(12);
    for (const d of sets) expect(EDGE_SOUNDS[d], d).toBeDefined();
    for (const [a, b] of Object.values(EDGE_SOUNDS)) for (const id of [a, b]) {
      expect(recipeLength(SOUNDS[id]), id).toBeLessThanOrEqual(2);
      expect(PRIORITY.has(id), id).toBe(false);
    }
    // Deterministic rnd: it waits between EDGE.min and EDGE.max, plays to one side, and stays quiet in a boss fight.
    let r = 0;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const st = { next: 0 };
    expect(edgeCue(st, 'kiln', 1, false, rnd)).toBeNull();
    expect(st.next - 1).toBeGreaterThanOrEqual(EDGE.min);
    expect(st.next - 1).toBeLessThanOrEqual(EDGE.max);
    const c = edgeCue(st, 'kiln', st.next, false, rnd);
    expect(EDGE_SOUNDS.kiln).toContain(c?.id);
    expect(Math.abs(c?.pan ?? 0)).toBeGreaterThan(0.3);
    expect(c?.vol).toBe(EDGE.vol);
    expect(edgeCue(st, 'kiln', st.next, true, rnd)).toBeNull();
    expect(edgeCue({ next: 0 }, undefined, 5, false, rnd)).toBeNull();
    // A new run (the clock went back) reschedules instead of firing at once.
    const back = { next: 500 };
    expect(edgeCue(back, 'kiln', 2, false, rnd)).toBeNull();
    expect(back.next).toBeLessThan(2 + EDGE.max + 0.001);
  });

  it('sounds Glintfall once, however many pillars it hits (V8)', () => {
    expect(CAST_SOUNDS.glintfall).toEqual({ start: 'glintWarn', done: 'glintfall' });
    expect(recipeLength(SOUNDS.glintWarn)).toBeLessThanOrEqual(1.8);
    expect(THROTTLE.slam).toBeGreaterThan(1 / 60);
    expect(THROTTLE.slam).toBeLessThan(0.2);
    // The Coldmarrow's ice pillars (#384) clink; elsewhere pillars stay stone.
    expect(cueFor({ type: 'layout', id: 'pillars' } as never, { cls: 'emberwright' as const, acting: 0, dungeon: 'coldmarrow' })?.id).toBe('layoutIce');
    expect(cueFor({ type: 'layout', id: 'pillars' } as never, { cls: 'emberwright' as const, acting: 0, dungeon: 'kiln' })?.id).toBe('layoutPillars');
  });

  it('sounds Nhevra\'s Emberdrift: embers falling, and your own coal brightening (V8)', () => {
    const c = { cls: 'emberwright' as const, acting: 1 };
    expect(cueFor({ type: 'emberDrift', n: 3 } as never, c)?.id).toBe('emberDriftFall');
    expect(cueFor({ type: 'emberPick', x: 0, y: 0, hero: 1 } as never, c)?.id).toBe('emberPickUp');
    expect(cueFor({ type: 'emberPick', x: 0, y: 0, hero: 0 } as never, c)).toMatchObject({ id: 'emberTaken', vol: 0.5 });
  });

  it('gives Hessa\'s Outsurge its own wind-up and backwash, apart from the inward Ebb (W1)', () => {
    const c = { cls: 'emberwright' as const, acting: 0 };
    const ebb = { type: 'castStart', index: 0, id: 'ebb', name: 'The Ebb' } as never;
    expect(cueFor(ebb, c)?.id).toBe('ebbWarn');
    expect(cueFor(ebb, { ...c, outsurge: true })?.id).toBe('outsurgeWarn');
    expect(ebbCue({ on: false }, true)?.id).toBe('ebbPull');
    expect(ebbCue({ on: false }, true, true)?.id).toBe('outsurgePull');
    expect(PRIORITY.has('outsurgeWarn') && PRIORITY.has('outsurgePull')).toBe(true);
  });

  it('sounds the Sluicetide turning, as a must-hear cue (V8)', () => {
    expect(cueFor({ type: 'tideTurn', angle: 1 } as never, { cls: 'emberwright' as const, acting: 0 })?.id).toBe('tideTurn');
    expect(PRIORITY.has('tideTurn')).toBe(true);
  });

  it('stings Today\'s Heat once, with the first Kiln fight, unless its floor already sounds (V4/V6)', () => {
    const c = { cls: 'emberwright' as const, acting: 0 };
    const first = { type: 'encounterStart', index: 0, id: 'pack' } as never;
    expect(cueFor(first, { ...c, heat: 'quickStudy' })?.id).toBe('heatSting');
    expect(cueFor(first, { ...c, heat: 'richHaul' })?.id).toBe('heatSting');
    expect(cueFor({ type: 'encounterStart', index: 1, id: 'pack' } as never, { ...c, heat: 'richHaul' })).toBeNull();
    expect(cueFor(first, c)).toBeNull();
    for (const h of FLOOR_HEATS) expect(cueFor(first, { ...c, heat: h }), h).toBeNull();
    // The real sim: a floor Heat's first fight does fire a layout event, so its layout sting stands in.
    for (const heat of ['stoneFloor', 'ventFloor'] as const) {
      const w = new World({ seed: 5, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright', heat });
      expect(w.heat, heat).toBe(heat);
      const seen: string[] = [];
      for (let k = 0; k < 120 && !seen.includes('encounterStart'); k++) {
        if (k) w.step({ mx: 0, my: 0 } as never);
        for (const ev of w.events) seen.push(ev.type === 'layout' ? `layout:${ev.id}` : ev.type);
      }
      expect(seen.some((s) => s === 'layout:pillars' || s === 'layout:vents'), `${heat}: ${seen.join(',')}`).toBe(true);
    }
  });

  it('has a case in cueFor for every SimEvent type, so a new event is never silent by accident', () => {
    const world = readFileSync(new URL('../sim/world.ts', import.meta.url), 'utf8');
    const cues = readFileSync(new URL('../client/audio/cues.ts', import.meta.url), 'utf8');
    const types = [...world.matchAll(/^\s*\| \{ type: '(\w+)'/gm)].map((m) => m[1]);
    expect(types.length).toBeGreaterThan(50);
    const handled = new Set([...cues.matchAll(/case '(\w+)'/g)].map((m) => m[1]));
    // A silent event still gets its own `case 'x': return null;` line, so the choice is written down.
    expect(types.filter((t) => !handled.has(t))).toEqual([]);
  });

  it('has themes and cues ready for the Ashvents, the Coldmarrow and the raid', () => {
    for (const t of ['ashvents', 'coldmarrow', 'raid'] as const) expect(THEMES[t], t).toBeDefined();
    expect(THEMES.raid.meter).toBe(3);
    expect(THEMES.coldmarrow.coal).toBe(true);
    for (const id of ['twinVents', 'scatter', 'bellowSlam', 'longNight', 'frostLace', 'ladlePour', 'pour', 'crucibleVents', 'lastEmber']) expect(CAST_SOUNDS[id], id).toBeDefined();
    expect(phaseSting('grandmotherSlag', 2)).toBe('phaseRaid2');
    expect(phaseSting('grandmotherSlag', 3)).toBe('phaseRaid3');
    expect(phaseSting('ysmeret', 2)).toBe('phaseYsmeret');
    expect(phaseSting('nobodyYet', 2)).toBe('phase');
    expect(cueFor({ type: 'burnout', warn: true }, { cls: 'lumen', acting: 0 })?.id).toBe('burnoutWarn');
    expect(cueFor({ type: 'burnout', warn: false }, { cls: 'lumen', acting: 0 })?.id).toBe('burnout');
    expect(cueFor({ type: 'namedSpawn', index: 0, name: 'Grisk the Vengeful', affix: 'Vengeful' }, { cls: 'lumen', acting: 0 })?.id).toBe('namedSpawn');
    expect(cueFor({ type: 'namedKill', x: 0, y: 0, name: 'Grisk the Vengeful' }, { cls: 'lumen', acting: 0 })?.id).toBe('namedKill');
    const alt = { type: 'ability', alt: true, slot: 1, x: 0, y: 0, angle: 0, r: 40 } as const;
    expect(cueFor(alt, { cls: 'emberwright', acting: 0 })?.id).toBe('emberWard');
    expect(cueFor({ ...alt, slot: 0 }, { cls: 'duskblade', acting: 0 })?.id).toBe('hamstring');
    expect(cueFor({ ...alt, slot: 2 }, { cls: 'bulwark', acting: 0 })?.id).toBe('rallyingCry');
    expect(cueFor(alt, { cls: 'lumen', acting: 0 })?.id).toBe('lightwell');
    expect(cueFor(alt, { cls: 'slagbinder', acting: 0 })?.id).toBe('slagPit');
    for (const v of Object.values(PHASE_STING)) for (const id of [v].flat()) expect(SOUNDS[id], id).toBeDefined();
  });

  it('chimes the same for every season\'s glow and trail unlocks, Seasons 7 and 8 included (Z4)', () => {
    const base = { heroXp: 0, items: [], levelsGained: 0 };
    expect(SEASONS.slice(6).map((d) => d.trail.id)).toEqual(['emberCrumbs', 'plateShards']);
    for (let id = 0; id < SEASONS.length; id++) {
      const looks = seasonRewards(id).filter((r) => r.kind === 'glow' || r.kind === 'trail');
      // Three glows and three trail stages a season (SEASON.trailAt).
      expect(looks.filter((r) => r.kind === 'glow').length, `season ${id + 1}`).toBe(SEASONS[id].glows.length);
      expect(looks.filter((r) => r.kind === 'trail').length, `season ${id + 1}`).toBe(SEASON.trailAt.length);
      for (const r of looks) expect(rewardCues({ ...base, seasonRewards: [r] } as never).map((c) => c.id), `season ${id + 1} ${r.kind}`).toEqual(['unlock']);
    }
  });

  it('flicks each loot card as the end screen deals it in, and sparkles Epic and Mythic shines', () => {
    // The timings must match the CSS animation (client/index.html lootIn and lootShine).
    const html = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
    const lootIn = html.match(/animation: lootIn[^;]*;\s*animation-delay: calc\(([\d.]+)s \+ min\(var\(--k, 0\), (\d+)\) \* ([\d.]+)s\)/)!;
    const shine = html.match(/animation: lootShine[^;]*;\s*animation-delay: calc\(([\d.]+)s \+ min\(var\(--k, 0\), (\d+)\) \* ([\d.]+)s\)/)!;
    expect(lootIn, 'lootIn delay').not.toBeNull();
    expect(shine, 'lootShine delay').not.toBeNull();
    expect([+lootIn[1], +lootIn[2], +lootIn[3]]).toEqual([LOOT_DEAL.first, LOOT_DEAL.cap, LOOT_DEAL.gap]);
    expect(+shine[1]).toBeCloseTo(LOOT_DEAL.first + LOOT_DEAL.shine, 6);
    const item = (rarity: string) => ({ rarity }) as never;
    const r = { items: [item('common'), item('epic'), item('rare')] } as never;
    expect(lootCues(r).map((c) => [c.id, +c.at.toFixed(2)])).toEqual([['lootDeal', 0.45], ['lootDeal', 0.56], ['lootShine', 0.86], ['lootDeal', 0.67]]);
    expect(lootCues(r, true)).toEqual([]);
    // A big haul: cards past the cap land together, so one flick and one shine for the lot.
    const big = lootCues({ items: Array.from({ length: 14 }, () => item('mythic')) } as never);
    expect(big.filter((c) => c.id === 'lootDeal')).toHaveLength(LOOT_DEAL.cap + 1);
    expect(big.filter((c) => c.id === 'lootShine')).toHaveLength(LOOT_DEAL.cap + 1);
    expect(Math.max(...big.map((c) => c.at))).toBeLessThan(1.8);
  });

  it('chimes for what a run unlocked, after the end sting, at most three times', () => {
    expect(rewardCues(undefined)).toEqual([]);
    const base = { heroXp: 0, items: [], levelsGained: 0 } as never;
    expect(rewardCues(base)).toEqual([]);
    const ach = { id: 'x', name: 'A', title: 'T', embers: 10 };
    const cues = rewardCues({ ...(base as object), achievements: [ach, ach], title: 'The Bold', weeklyDone: [{}, {}] } as never);
    expect(cues.map((c) => c.id)).toEqual(['achievement', 'achievement', 'unlock']);
    expect(cues[0].at).toBeGreaterThan(1.5);
    expect(cues[1].at).toBeGreaterThan(cues[0].at);
    // An in-season win chimes after a season level and before smaller unlocks.
    expect(rewardCues({ ...(base as object), seasonFrom: 3, seasonTo: 4, seasonFeatured: true, title: 'The Bold' } as never).map((c) => c.id)).toEqual(['seasonUp', 'inSeason', 'unlock']);
    expect(rewardCues({ ...(base as object), seasonFeatured: true } as never).map((c) => c.id)).toEqual(['inSeason']);
    // P3 keys and the daily bounty (both listed on the end screen by client/ui.ts).
    expect(rewardCues({ ...(base as object), keyFrom: 4, keyTo: 5 } as never).map((c) => c.id)).toEqual(['keyUp']);
    expect(rewardCues({ ...(base as object), keyFrom: 4, keyTo: 6 } as never).map((c) => c.id)).toEqual(['keyFast']);
    expect(rewardCues({ ...(base as object), keyFrom: 4, keyTo: 3 } as never).map((c) => c.id)).toEqual(['keyDown']);
    expect(rewardCues({ ...(base as object), keyFrom: 4, keyTo: 4 } as never).map((c) => c.id)).toEqual([]);
    expect(rewardCues({ ...(base as object), bountyEmbers: 0 } as never).map((c) => c.id)).toEqual([]);
    expect(rewardCues({ ...(base as object), bountyEmbers: 40, title: 'The Bold' } as never).map((c) => c.id)).toEqual(['bountyPaid', 'unlock']);
    expect(rewardCues({ ...(base as object), seasonFrom: 1, seasonTo: 2, keyFrom: 2, keyTo: 3, seasonFeatured: true } as never).map((c) => c.id)).toEqual(['seasonUp', 'keyUp', 'inSeason']);
  });

  it('keys every boss-cast sound to a cast id the sim really uses', () => {
    const sim = readFileSync(new URL('../sim/world.ts', import.meta.url), 'utf8');
    for (const id of Object.keys(CAST_SOUNDS)) expect(sim.includes(`'${id}'`), id).toBe(true);
  });

  it('hears a boss-fight pick-up start, count up, break off, and the last one spent', () => {
    const st = { t: [] as number[], left: Infinity };
    const ids = (t: number[], left = 1) => reviveCues(st, t, 9, left).map((c) => c.id);
    expect(ids([0, 0])).toEqual([]); // first look only records
    expect(ids([0, 0.03])).toEqual(['reviveStart']);
    expect(ids([0, 0.9])).toEqual([]);
    expect(ids([0, 1.02])).toEqual(['reviveTick']);
    expect(ids([0, 0])).toEqual(['reviveLost']); // stepped off at 1 s of 9
    expect(ids([0, 8.97])).toEqual(['reviveStart']);
    expect(ids([0, 0], 0)).toEqual(['revivesSpent']); // picked up: the pick-up is the 'revive' event, and that was the only one
    expect(ids([0, 0], 0)).toEqual([]);
    expect(ids([0, 0], Infinity)).toEqual([]); // the boss fell: no limit again
  });

  it('gives every boss warning priority over the fight noise', () => {
    for (const id of PRIORITY) expect(SOUNDS[id], id).toBeDefined();
    for (const s of Object.values(CAST_SOUNDS)) if (s.start) expect(PRIORITY.has(s.start), s.start).toBe(true);
    for (const id of ['targeted', 'allyDown', 'selfDown', 'bossSpawn', 'revivesSpent'] as SoundId[]) expect(PRIORITY.has(id), id).toBe(true);
    for (const id of ['hit', 'swing', 'mote', 'crit', 'heal'] as SoundId[]) expect(PRIORITY.has(id), id).toBe(false);
    expect(DUCK.gain).toBeLessThan(1);
  });

  it('plays a season-track level-up after any achievements', () => {
    const r = { heroXp: 0, items: [], levelsGained: 0, seasonFrom: 3, seasonTo: 4, achievements: [{ id: 'x', name: 'A', title: 'T', embers: 1 }] } as never;
    expect(rewardCues(r).map((c) => c.id)).toEqual(['achievement', 'seasonUp']);
  });

  it('varies long sessions: every theme walks a section plan, keeping its chords, and boss fights never break down', () => {
    for (const th of Object.values(THEMES)) {
      const meter = th.meter ?? 4;
      const pass = 2 * th.progression.length * meter; // beats in one pass through the progression
      const names = Array.from({ length: 6 }, (_, k) => sectionAt(k * pass, th, false).name);
      expect(new Set(names).size, th.root + '').toBeGreaterThanOrEqual(3);
      expect(names).toContain('breakdown');
      for (let b = 0; b < pass * 6; b += meter) {
        expect(th.progression).toContain(chordAt(b, th, false));
        expect(sectionAt(b, th, true).name).not.toBe('breakdown');
      }
      // The plan repeats only after six passes.
      expect(sectionAt(6 * pass, th, false)).toEqual(sectionAt(0, th, false));
    }
  });

  it('stings when a capstone is taken (it opens the branch\'s deep cards), and not for other picks', () => {
    expect(pickCue('unbreakable')?.id).toBe('capstone');
    expect(pickCue('bladeStorm')?.id).toBe('capstone');
    expect(pickCue('rivetedPlates')).toBeNull(); // a deep card
    expect(pickCue('stoke')).toBeNull();
    for (const id of ['leeSide', 'frontMend', 'turnedBack', 'closeWarmth', 'wideShell'] as const) expect(pickCue(id)?.id, id).toBe('partyCard');
    expect(pickCue(undefined)).toBeNull();
  });

  it("gives the Pressworks its press-cycle theme, and Oskel's casts and phase their sounds", () => {
    expect(THEMES.pressworks.bed).toBe('press');
    const c = { cls: 'bulwark' as const, acting: 0 };
    expect(cueFor({ type: 'castStart', index: 0, id: 'downstroke', name: 'Downstroke' }, c)?.id).toBe('downstrokeWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'rivets', name: 'Rivets' }, c)?.id).toBe('rivetsWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'stamp', name: 'Stamp' }, c)?.id).toBe('stampWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'stamp', name: 'Stamp' }, c)?.id).toBe('stamp');
    expect(phaseSting('oskel', 2)).toBe('phaseOskel');
    // Rivets come every 9 s: the warning stays short, so its duck is brief.
    expect(recipeLength(SOUNDS.rivetsWarn)).toBeLessThan(0.4);
  });

  it('gives the Wrackline its theme, Hessa\'s casts their sounds, and the Ebb a drag when the pull starts', () => {
    expect(THEMES.wrackline.bed).toBe('surf');
    const c = { cls: 'lumen' as const, acting: 0 };
    expect(cueFor({ type: 'castStart', index: 0, id: 'ebb', name: 'The Ebb' }, c)?.id).toBe('ebbWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'sink', name: 'Sink' }, c)?.id).toBe('sinkWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'sink', name: 'Sink' }, c)?.id).toBe('sink');
    expect(cueFor({ type: 'castStart', index: 0, id: 'haul', name: 'Haul' }, c)?.id).toBe('haulWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'shoalCall', name: 'Call the Shoal' }, c)?.id).toBe('shoalCall');
    expect(phaseSting('hessa', 2)).toBe('phaseHessa');
    const st = { on: false };
    expect(ebbCue(st, false)).toBeNull();
    expect(ebbCue(st, true)?.id).toBe('ebbPull');
    expect(ebbCue(st, true)).toBeNull();
    expect(ebbCue(st, false)).toBeNull();
  });
});

describe('season hub themes', () => {
  it('season 1 keeps the plain hub and season 2, the Deep Bellows, plays over the forge bellows', () => {
    expect(SEASONS[1].name).toBe('the Deep Bellows');
    expect(hubThemeFor(0, SEASONS.length)).toBe('hub');
    expect(hubThemeFor(1, SEASONS.length)).toBe('hubBellows');
    expect(THEMES.hubBellows.bed).toBe('forge');
    // Season 3, the Cold Hearth: the Coldmarrow's frost and its Hearthcoal crackle.
    expect(SEASONS[2].name).toBe('the Cold Hearth');
    expect(hubThemeFor(2, SEASONS.length)).toBe('hubHearth');
    expect(THEMES.hubHearth.bed).toBe('frost');
    expect(THEMES.hubHearth.coal).toBe(true);
    // Seasons 4 to 8 take their featured dungeon's bed: the Glarewell's shimmer, the Pressworks' press, the Wrackline's surf, the Hoard's chew, the Smeltery's stride.
    expect(SEASONS.slice(3).map((d) => d.name)).toEqual(['the Slag Moon', 'the Falling Press', 'the Low Ebb', 'the Long Hunger', 'the Cracked Plate']);
    expect([3, 4, 5, 6, 7].map((i) => THEMES[hubThemeFor(i, SEASONS.length)].bed)).toEqual(['shimmer', 'press', 'surf', 'chew', 'stride']);
    // Every season has its own hub theme.
    expect(new Set(SEASONS.map((_, i) => hubThemeFor(i, SEASONS.length))).size).toBe(SEASONS.length);
    // Season 2 starts on week 2974 (docs/design/season.md).
    expect(hubThemeFor(seasonOf(SEASON_START_WEEK + SEASON.weeks), SEASONS.length)).toBe('hubBellows');
  });
  it('wraps with the season rotation and falls back to the plain hub', () => {
    // Seasons 7 and 8 (Y10, Y11) take the Hoard's chew and the Smeltery's stride; entries past SEASONS wait for their season.
    expect(HUB_BY_SEASON.slice(6)).toEqual(['hubHunger', 'hubPlate']);
    expect([THEMES.hubHunger.bed, THEMES.hubPlate.bed]).toEqual([THEMES.hoard.bed, THEMES.smeltery.bed]);
    expect(new Set(HUB_BY_SEASON).size).toBe(HUB_BY_SEASON.length);
    for (const id of HUB_BY_SEASON) if (id) expect(THEMES[id], id).toBeDefined();
    expect(hubThemeFor(SEASONS.length + 1, SEASONS.length)).toBe('hubBellows');
    expect(hubThemeFor(-1, SEASONS.length)).toBe(HUB_BY_SEASON[SEASONS.length - 1] ?? 'hub');
    for (let i = 0; i < SEASONS.length; i++) expect(THEMES[hubThemeFor(i, SEASONS.length)]).toBeDefined();
  });
});

describe('verb-set proc cues', () => {
  const p = { hp: 100, planted: true, surge: true, kbT: 3, warmth: 5, coverT: 0, bondT: 0 };
  it('reads each flag only with the pieces that grant it, and never on a dead hero', () => {
    expect(setFlagsOf(p, () => 1)).toEqual({ planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false, relayed: false, freed: false, behind: false, handover: false });
    expect(setFlagsOf(p, () => 3)).toEqual({ planted: true, surge: true, sharp: true, warmFull: true, covered: false, bonded: false, relayed: false, freed: false, behind: false, handover: false });
    // Tidewalker's surge and Hearthkeeper's full Warmth are the 3-piece bonuses.
    expect(setFlagsOf(p, () => 2)).toEqual({ planted: true, surge: false, sharp: true, warmFull: false, covered: false, bonded: false, relayed: false, freed: false, behind: false, handover: false });
    expect(setFlagsOf({ ...p, hp: 0 }, () => 3)).toEqual({ planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false, relayed: false, freed: false, behind: false, handover: false });
    expect(setFlagsOf({ ...p, warmth: 4 }, () => 3).warmFull).toBe(false);
  });
  it('sounds a proc as it turns on, once', () => {
    const was = {};
    const off = { planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false, relayed: false, freed: false, behind: false, handover: false };
    expect(setCues(was, off)).toEqual([]);
    expect(setCues(was, { ...off, planted: true }).map((c) => c.id)).toEqual(['planted']);
    expect(setCues(was, { ...off, planted: true })).toEqual([]);
    expect(setCues(was, { planted: true, surge: true, sharp: true, warmFull: true, covered: false, bonded: false, relayed: false, freed: false, behind: false, handover: false }).map((c) => c.id)).toEqual(['surgeReady', 'sharpen', 'warmthFull']);
    expect(setCues(was, off)).toEqual([]);
    expect(setCues(was, { ...off, planted: true }).map((c) => c.id)).toEqual(['planted']);
    expect(THROTTLE.planted).toBeGreaterThan(0);
  });
  it('Handover: a cue as Spent starts with 3 pieces on, none with fewer or once Spent wears off', () => {
    expect(setFlagsOf({ hp: 100, spentT: 9 }, () => 3).handover).toBe(true);
    expect(setFlagsOf({ hp: 100, spentT: 9 }, () => 2).handover).toBe(false);
    expect(setFlagsOf({ hp: 100, spentT: 0 }, () => 3).handover).toBe(false);
    expect(setFlagsOf({ hp: 0, spentT: 9 }, () => 3).handover).toBe(false);
    const was = {};
    setCues(was, setFlagsOf({ hp: 100 }, () => 3));
    expect(setCues(was, setFlagsOf({ hp: 100, spentT: 10 }, () => 3)).map((c) => c.id)).toEqual(['handedOver']);
    expect(setCues(was, setFlagsOf({ hp: 100, spentT: 9 }, () => 3))).toEqual([]);
    expect(Math.min(...SOUNDS.handedOver.map((v) => v.delay ?? 0))).toBeGreaterThanOrEqual(0.3);
  });

  it('Crawsplitter: Freed sounds on the breaker and the freed hero; Platewalker: a soft cue on getting behind him', () => {
    // The freed hero may wear none of the set (crawBroken sets freedT on both), like Bonded.
    expect(setFlagsOf({ hp: 100, freedT: 10 }, () => 0).freed).toBe(true);
    expect(setFlagsOf({ hp: 0, freedT: 10 }, () => 3).freed).toBe(false);
    expect(setFlagsOf({ hp: 100 }, () => 2, true).behind).toBe(true);
    expect(setFlagsOf({ hp: 100 }, () => 1, true).behind).toBe(false);
    expect(setFlagsOf({ hp: 100 }, () => 3, false).behind).toBe(false);
    const was = {};
    setCues(was, setFlagsOf({ hp: 100 }, () => 3));
    expect(setCues(was, setFlagsOf({ hp: 100, freedT: 10 }, () => 3, true))).toEqual([{ id: 'freed', vol: 1 }, { id: 'behindPlate', vol: 0.7 }]);
    expect(THROTTLE.behindPlate).toBeGreaterThanOrEqual(3);
    // Freed waits for the Craw's break, which lands on the same tick.
    expect(Math.min(...SOUNDS.freed.map((v) => v.delay ?? 0))).toBeGreaterThanOrEqual(0.3);
    const col = { kind: 'colossus', alive: true };
    const w = (behind: boolean, e = col) => ({ bossIndex: 0, enemies: [e], player: { x: 0, y: 0 }, behindColossus: () => behind });
    expect(behindColossusNow(w(true))).toBe(true);
    expect(behindColossusNow(w(false))).toBe(false);
    expect(behindColossusNow(w(true, { kind: 'vorhulm', alive: true }))).toBe(false);
    expect(behindColossusNow(w(true, { kind: 'colossus', alive: false }))).toBe(false);
  });

  it('Kinbound: Covered and Bonded sound as they start, and a dead hero hears neither', () => {
    const q = { hp: 100, coverT: 4, bondT: 4 };
    expect(setFlagsOf(q, () => 0)).toMatchObject({ covered: true, bonded: true });
    expect(setFlagsOf({ ...q, hp: 0 }, () => 3)).toMatchObject({ covered: false, bonded: false, relayed: false, freed: false, behind: false, handover: false });
    const was = {};
    const off = setFlagsOf({ hp: 100 }, () => 0);
    setCues(was, off);
    expect(setCues(was, setFlagsOf(q, () => 0)).map((c) => c.id)).toEqual(['covered', 'bonded']);
    expect(setCues(was, setFlagsOf({ ...q, coverT: 2 }, () => 0))).toEqual([]);
    expect(THROTTLE.covered).toBeGreaterThan(0);
    expect(THROTTLE.bonded).toBeGreaterThan(0);
  });
  it('Relayer: Relayed sounds as it starts, not as a gold circle refreshes it', () => {
    const was = {};
    setCues(was, setFlagsOf({ hp: 100 }, () => 0));
    expect(setCues(was, setFlagsOf({ hp: 100, relayT: 12 }, () => 0)).map((c) => c.id)).toEqual(['relayed']);
    expect(setCues(was, setFlagsOf({ hp: 100, relayT: 12 }, () => 0))).toEqual([]);
    expect(setFlagsOf({ hp: 0, relayT: 12 }, () => 0).relayed).toBe(false);
  });
  it("Glarewarden's dodge has its own sound", () => {
    expect(cueFor({ type: 'dodge', x: 0, y: 0, healed: 5 }, { cls: 'emberwright', acting: 0 })?.id).toBe('dodged');
    for (const id of ['planted', 'surgeReady', 'sharpen', 'dodged', 'warmthFull', 'covered', 'bonded', 'relayed'] as const) expect(SOUNDS[id]).toBeDefined();
  });
});

describe('takes for busy sounds', () => {
  const rms = (s: Float32Array) => Math.sqrt(s.reduce((a, v) => a + v * v, 0) / s.length);
  it('each take sounds different, stays as loud (within 2 dB), unclipped and phone-safe', () => {
    for (const [id, n] of Object.entries(VARIANTS) as [SoundId, number][]) {
      const base = render(SOUNDS[id], RATE, 1);
      for (let k = 1; k < n; k++) {
        const take = render(variantOf(SOUNDS[id], k), RATE, 1 + k * 101);
        const db = 20 * Math.log10(rms(take) / rms(base));
        expect(Math.abs(db), `${id}#${k} ${db.toFixed(2)} dB`).toBeLessThan(2);
        expect(Math.max(...take.map(Math.abs)), `${id}#${k}`).toBeLessThanOrEqual(1);
        expect(phoneShare(take, RATE), `${id}#${k}`).toBeGreaterThan(0.25);
        // Not the same waveform: the samples disagree somewhere meaningful.
        let diff = 0;
        for (let i = 0; i < Math.min(base.length, take.length); i++) diff += Math.abs(base[i] - take[i]);
        expect(diff / base.length, `${id}#${k}`).toBeGreaterThan(0.005);
      }
    }
  });
  it('gives the busiest class abilities their own takes', () => {
    for (const id of ['bulwarkSlam', 'emberWave', 'lumenBurst'] as const) expect(VARIANTS[id], id).toBeGreaterThanOrEqual(3);
  });
  it('never plays the same take twice running', () => {
    for (let last = -1; last < 4; last++) for (const r of [0, 0.3, 0.6, 0.999]) {
      const k = nextTake(4, last, r);
      expect(k).not.toBe(last);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(4);
    }
    expect(nextTake(1, 0, 0.5)).toBe(0);
    expect(variantOf(SOUNDS.hit, 0)).toBe(SOUNDS.hit);
  });
});

describe('stereo', () => {
  const c = { cls: 'emberwright' as const, acting: 0, listen: { x: 100, half: 250 } };
  it('leans a sound toward where it happens, at most PAN_MAX, and centres one at the hero or with no place', () => {
    expect(panFor({ type: 'hit', x: 350, y: 0, amount: 1, crit: false }, c)).toBeCloseTo(PAN_MAX);
    expect(panFor({ type: 'hit', x: -900, y: 0, amount: 1, crit: false }, c)).toBeCloseTo(-PAN_MAX);
    expect(panFor({ type: 'hit', x: 225, y: 0, amount: 1, crit: false }, c)).toBeCloseTo(PAN_MAX / 2);
    expect(panFor({ type: 'hit', x: 101, y: 0, amount: 1, crit: false }, c)).toBeUndefined();
    expect(panFor({ type: 'playerHurt', amount: 5 }, c)).toBeUndefined();
    expect(panFor({ type: 'hit', x: 350, y: 0, amount: 1, crit: false }, { cls: 'emberwright', acting: 0 })).toBeUndefined();
  });
});
