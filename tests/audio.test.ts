import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, recipeLength } from '../client/audio/synth';
import { PHONE_FLOOR_DB, SOUNDS, SoundId } from '../client/audio/sounds';
import { bedSamples, chordAt, HUB_BY_SEASON, hubThemeFor, sectionAt, themeFor, THEMES } from '../client/audio/music';
import { DUNGEON_IDS, DUNGEONS, SOLO_DUNGEON_IDS } from '../sim/content/dungeon';
import { HEAT_IDS, heatApplies } from '../sim/content/heat';
import { SEASON_START_WEEK, SEASON, SEASONS, seasonOf, seasonRewards } from '../sim/content/season';
import { DEEP_DUCK, millCue, EDGE, EDGE_SOUNDS, EDGE_SPOTS, edgeSpotAt, HD2D_ROOM_R, edgeCue, withoutBankedSoaks, ISLAND_SLACK, islandCues, myIsland, DIECUT_R, WANDERING_VENTS, ROLLING_VENTS, FLOOR_HEATS, HEAT_STING, WAVE_SOUNDS, ARENA_EVENT_SOUNDS, ARENA_LAND, AFFIX_SPAWN, VENT_SOUNDS, PILLAR_STING, inLavaNow, inRimeNow, landCueFor, LAYOUT_STING, spentCue, behindColossusNow, colossusCue, SHADOW_STING, BELLY, beatGap, bellyCues, DRY, pressedCue, CAST_SOUNDS, cueFor, DUCK, partyCues, PHASE_STING, phaseSting, pickCue, ebbCue, panFor, PAN_MAX, PRIORITY, setCues, setFlagsOf, THROTTLE, reviveCues, targetCue } from '../client/audio/cues';
import { ENEMIES } from '../sim/content/enemies';
import { buzzFor, BUZZ, Haptics } from '../client/audio/haptics';
import { uiSoundFor, Tappable } from '../client/audio/ui';
import { phoneDb, phoneShare } from '../tools/mixcheck';
import { LOOT_DEAL, lootCues, rewardCues } from '../client/audio/rewards';
import { nextTake, VARIANTS, variantOf } from '../client/audio/variants';
import { CREEPING_RIME, GLARE, HOMEWARD, INHALE, REGENT, TITHE, OSKEL, OVERFLOW, PUNCH, isPunchR, ROLLING, KILN_DRAW, KILN_TURN, MAELRA_SEAL, STIR, STIR_IDS, WAVES, ARENA_EVENTS, ARENA_EVENT_POOLS, BRIM, COLO, IRONLOAD, LAYOUT, LAYOUTS, VARIETY, World, type SimEvent } from '../sim/world';
import { AFFIXES } from '../sim/content/named';
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
      // Up to 200 simulated seconds per class: the Lumen bot casts its Burst only every minute or so, and a
      // Kiln pillar layout (V2) can push its first one past 75 s. With U2's seventh Kiln opener re-rolling the
      // routes, seed 14's Lumen first Bursts at 153 s.
      for (let i = 0; i < 30 * 200 && w.state !== 'ended'; i++) {
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
    // Seed 19 since Phase 15 Y2: raid trash events changed seed 3's run, which no longer reached Meltdown.
    const w = new World({ seed: 19, dungeon: 'smeltery', tier: 10, omens: [], cls: 'duskblade', party: (['bulwark', 'lumen', 'emberwright'] as const).map((cls, k) => ({ cls, name: `${cls}${k}` })) });
    // Phase 15 Y3 added a third version (Millstone), so seed 19 no longer rolls the Wheel by itself: keep its Wheel run.
    (w as unknown as { rollColossusVariant(): string }).rollColossusVariant = () => 'wheel';
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
    // Each dungeon's vents are its own: no two share a warn, burst or sting, and each warn ends inside the fuse.
    for (const part of ['warn', 'land', 'sting'] as const) {
      const ids = Object.values(VENT_SOUNDS).map((v) => v[part]);
      expect(new Set(ids).size, part).toBe(ids.length);
    }
    for (const [d, v] of Object.entries(VENT_SOUNDS)) expect(recipeLength(SOUNDS[v.warn]), d).toBeLessThanOrEqual(LAYOUT.ventCast);
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

  it('plays the 3D rooms\' edge sounds from the props you can see, and keeps the random side in 2D', () => {
    // The spots match client/hd2d/renderer.ts: its room radius, and each prop's placement radius.
    const src = readFileSync('client/hd2d/renderer.ts', 'utf8');
    expect(src).toContain(`const ROOM_R = ${HD2D_ROOM_R};`);
    expect(src).toContain('Math.sin(a) * (9.2 + r * 0.25)'); // kilns, r 2.3 and 1.65
    expect(src).toMatch(/\[Math\.PI, 2\.3\], \[Math\.PI - 0\.8, 1\.65\]/);
    expect(src).toContain('Math.sin(a) * 8.62, 0.22'); // braziers
    expect(src).toContain('[Math.PI - 0.5, Math.PI + 0.5, Math.PI - 1.1, Math.PI + 1.1]');
    expect(src).toContain('Math.sin(a) * 9.4, 0, Math.cos(a) * 9.4'); // boilers
    expect(src).toContain('Math.sin(a) * 9.5, 0, Math.cos(a) * 9.5'); // anvils
    expect(src).toContain('Math.sin(a) * 9.7, 0, Math.cos(a) * 9.7'); // chimneys
    expect(src).toContain('lg.position.set(0, 6.2, -9.6)'); // the Glarewell's lens, at the back wall centre (z -9.6)
    expect(src).toContain('lg.position.set(0, 0, -9.3)'); // the Crucible's ladle
    expect(src).toContain('for (const a of [Math.PI - 0.8, Math.PI + 0.8]) {\n      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.5, 0, Math.cos(a) * 9.5);'); // its slag pots
    expect(src).toContain('[[Math.PI, 3.4], [Math.PI - 0.85, 2.0], [Math.PI + 0.85, 2.0]]'); // the Hoard's mounds
    expect(src).toContain('mound.position.set(Math.sin(a) * (9.4 + r * 0.25)');
    expect(src).toMatch(/\[\[Math\.PI, 3\.2\], \[Math\.PI - 0\.8, 2\.2\], \[Math\.PI \+ 0\.8, 2\.2\]\] as const\) \{\n\s+const g = new THREE\.Group\(\); g\.position\.set\(Math\.sin\(a\) \* 9\.6/); // the Coldmarrow's arches
    expect(src).toMatch(/\[\[Math\.PI, 3\.0\], \[Math\.PI - 0\.8, 2\.2\], \[Math\.PI \+ 0\.8, 2\.2\]\] as const\) \{\n\s+const g = new THREE\.Group\(\); g\.position\.set\(Math\.sin\(a\) \* 9\.5/); // the presses
    expect(src).toContain('for (const a of [Math.PI - 0.55, Math.PI - 0.95, Math.PI + 0.6, Math.PI + 1.0]) {\n      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.9'); // the ore carts
    expect(src).toContain('wg.position.set(0, -0.2, -9.6)'); // the Wrackline's hull
    expect(src).toContain('[Math.PI - 0.7, Math.PI - 1.0, Math.PI - 1.3, Math.PI + 0.7, Math.PI + 1.0, Math.PI + 1.3]'); // its posts
    expect(src).toContain('new THREE.Vector3(Math.sin(a) * 8.9, 0.9, Math.cos(a) * 8.9)');
    expect(src).toMatch(/\[Math\.PI, 2\.2\], \[Math\.PI - 0\.8, 1\.6\], \[Math\.PI \+ 0\.8, 1\.6\]\] as const\) \{\n\s+const g = new THREE\.Group\(\); g\.position\.set\(Math\.sin\(a\) \* 9\.5/); // fumaroles
    // Only dungeons with their own 3D room get spots (the rest share the Flue room, whose props aren't theirs). A new room
    // without spots yet just keeps the random side, so visuals' room PRs never wait on sound.
    const own = [...(src.match(/const OWN_ROOMS[^=]*= \[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(own.length).toBeGreaterThanOrEqual(5);
    for (const d of Object.keys(EDGE_SPOTS)) expect(['flue', ...own], d).toContain(d);
    for (const d of Object.keys(EDGE_SPOTS)) expect(EDGE_SPOTS[d]![0].length, d).toBeGreaterThan(0);
    [2.3, 1.65, 1.65].forEach((r, k) => expect(EDGE_SPOTS.kiln?.[0][k][1]).toBeCloseTo(9.2 + r * 0.25, 9));
    // The back wall is world -y, scaled to the arena.
    const back = edgeSpotAt([Math.PI, HD2D_ROOM_R], 560);
    expect(back.x).toBeCloseTo(0, 6); expect(back.y).toBeCloseTo(-560, 6);
    // A stand-in 3D view: screen x = 400 + world x / 2, half-width 200 px; the hero at x 0.
    const listen = { x: 0, y: 0, half: 280, screen: (x: number, y: number) => ({ x: 400 + x / 2, y: 300 + y / 2 }), screenHalf: 200 };
    const room = { listen, arenaR: 560 };
    const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
    // rnd order: the next gap, side, which prop, the side's spread, then (3D) the spot. The kiln at PI + 0.8 is on the left.
    const kiln = edgeCue({ next: 1 }, 'kiln', 1, false, seq([0.5, 0.9, 0.1, 0.99, 0.99]), room);
    const at = edgeSpotAt(EDGE_SPOTS.kiln![0][2], 560);
    expect(at.x).toBeLessThan(0);
    expect(kiln?.id).toBe('edgeFurnace');
    expect(kiln?.pan).toBeCloseTo(Math.max(-1, (at.x / 2) / 200) * EDGE.pan, 6);
    expect(kiln?.pan).toBeLessThan(0); // drawn left, heard left, although the side roll said right
    // The middle kiln is straight up the screen from a hero at x 0: centred.
    expect(edgeCue({ next: 1 }, 'kiln', 1, false, seq([0.5, 0.9, 0.1, 0.5, 0]), room)?.pan).toBeCloseTo(0, 6);
    // In 2D (no screen), or a sound with no spot (the Foundry's valve, the Hoard's bones), the random side stays.
    const twoD = edgeCue({ next: 1 }, 'kiln', 1, false, seq([0.5, 0.9, 0.1, 0.99]), { listen: { x: 0, half: 280 }, arenaR: 560 });
    expect(twoD?.pan).toBeCloseTo(EDGE.pan * (0.6 + 0.4 * 0.99), 6);
    expect(edgeCue({ next: 1 }, 'foundry', 1, false, seq([0.5, 0.9, 0.9, 0.5]), room)).toMatchObject({ id: 'edgeValve', pan: EDGE.pan * 0.8 });
    expect(edgeCue({ next: 1 }, 'hoard', 1, false, seq([0.5, 0.1, 0.9, 0.5]), room)).toMatchObject({ id: 'edgeBones' });
    expect(edgeCue({ next: 1 }, 'hoard', 1, false, seq([0.5, 0.1, 0.9, 0.5]), room)?.pan).toBeCloseTo(-EDGE.pan * 0.8, 6);
    // Every own 3D room so far (all twelve dungeons) has its big prop placed.
    for (const d of ['kiln', 'foundry', 'hammerdeep', 'glarewell', 'ashvents', 'crucible', 'hoard', 'coldmarrow', 'pressworks', 'smeltery', 'wrackline', 'flue']) expect(EDGE_SPOTS[d]?.[0].length, d).toBeGreaterThan(0);
  });

  it('sounds the Regent\'s Summons as a must-hear call, and the Brimming\'s Churn as a quiet stir (Phase 12 W3)', () => {
    expect(CAST_SOUNDS.summons).toEqual({ start: 'summonsWarn', done: 'summonsFall' });
    expect(PRIORITY.has('summonsWarn')).toBe(true);
    // The call ends well inside the 2.5 s to come before the throne.
    expect(recipeLength(SOUNDS.summonsWarn)).toBeLessThanOrEqual(1.8);
    const flue = { cls: 'bulwark' as const, acting: 0, dungeon: 'flue' };
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'summons', name: 'Summons' } as never, flue)?.id).toBe('summonsFall');
    const crucible = { ...flue, dungeon: 'crucible' };
    expect(cueFor({ type: 'castStart', index: 0, id: 'churn', name: 'Churn' } as never, crucible)?.id).toBe('churn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'churn', name: 'Churn' } as never, crucible)).toBeNull();
    expect(PRIORITY.has('churn')).toBe(false);
    expect(CAST_SOUNDS.churn).toBeUndefined();
    for (const id of ['summonsFall', 'churn'] as const) expect(recipeLength(SOUNDS[id]), id).toBeLessThan(3);
  });

  it('ducks the rest deeper under "you\'re down", which lands with the hit that downed you', () => {
    for (const [id, g] of Object.entries(DEEP_DUCK)) {
      expect(PRIORITY.has(id as never), id).toBe(true);
      expect(g, id).toBeLessThan(DUCK.gain);
      expect(g, id).toBeGreaterThan(0);
    }
    expect(DEEP_DUCK.selfDown).toBeDefined();
    // The engine and busycheck both use it.
    expect(readFileSync('client/audio/index.ts', 'utf8')).toContain('DEEP_DUCK[id] ?? DUCK.gain');
    expect(readFileSync('tools/busycheck.ts', 'utf8')).toContain('DEEP_DUCK[p.id] ?? DUCK.gain');
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

  it('gives every dungeon with its own drawn stones its own stones sting, under 1 s and level with layoutPillars (Phase 13)', () => {
    const scene = readFileSync(new URL('../client/GameScene.ts', import.meta.url), 'utf8');
    const raidStone = scene.match(/const RAID_STONE[^=]*= \{([^}]*)\}/);
    expect(raidStone).not.toBeNull();
    const drawn = [...raidStone![1].matchAll(/(\w+):/g)].map((m) => m[1]);
    expect(drawn.length).toBeGreaterThanOrEqual(5);
    const stings = Object.values(PILLAR_STING);
    expect(new Set(stings).size).toBe(stings.length);
    const base = phoneDb(render(SOUNDS.layoutPillars, 22050), 22050);
    for (const d of drawn) {
      const id = cueFor({ type: 'layout', id: 'pillars' } as never, { cls: 'emberwright' as const, acting: 0, dungeon: d })?.id;
      expect(id, d).toBe(PILLAR_STING[d]);
      expect(recipeLength(SOUNDS[id!]), d).toBeLessThan(1);
      expect(Math.abs(phoneDb(render(SOUNDS[id!], 22050), 22050) - base), d).toBeLessThan(1.5);
    }
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

  it('gives Today\'s Heat its own sting in every solo dungeon, the same figure at the same level (Phase 14 X1)', () => {
    const c = { cls: 'emberwright' as const, acting: 0, heat: 'richHaul' };
    const first = { type: 'encounterStart', index: 0, id: 'pack' } as never;
    const base = phoneDb(render(SOUNDS.heatSting, 22050), 22050);
    for (const d of SOLO_DUNGEON_IDS) {
      const id = cueFor(first, { ...c, dungeon: d })?.id;
      expect(id, d).toBe(HEAT_STING[d]);
      expect(recipeLength(SOUNDS[id!]), d).toBeLessThan(1);
      expect(Math.abs(phoneDb(render(SOUNDS[id!], 22050), 22050) - base), d).toBeLessThan(1.5);
    }
    expect(new Set(Object.values(HEAT_STING)).size).toBe(Object.keys(HEAT_STING).length);
    // Anywhere else (a group dungeon, if X1 ever reaches one) falls back to the Kiln's.
    expect(cueFor(first, { ...c, dungeon: 'hammerdeep' })?.id).toBe('heatSting');
  });

  it('sounds each arena event: a must-hear warning inside its fuse, then a landing in that dungeon\'s own sound (Phase 14 X7)', () => {
    type Q = { rollLayout(id: string): void; rollArenaEvent(id: string): void; arenaEventClock(dt: number): void; encounter: number };
    const tier = { kiln: 2, foundry: 4, glarewell: 7, coldmarrow: 10, wrackline: 13 } as const;
    const pack = { coldmarrow: 'rimepack' } as Record<string, string>;
    const fuse: Record<string, number> = { caveIn: ARENA_EVENTS.caveWarn, ventSurge: ARENA_EVENTS.surgeWarn, coldSnap: ARENA_EVENTS.snapWarn };
    const lands: Record<string, string[]> = {};
    for (const [dungeon, pool] of Object.entries(ARENA_EVENT_POOLS)) {
      for (const id of pool!) {
        const w = new World({ seed: 1, dungeon: dungeon as DungeonId, tier: tier[dungeon as keyof typeof tier], omens: [], cls: 'emberwright' });
        const q = w as unknown as Q;
        ARENA_EVENTS.force = id;
        try { q.encounter = 1; q.rollLayout(pack[dungeon] ?? 'pack'); q.rollArenaEvent(pack[dungeon] ?? 'pack'); } finally { ARENA_EVENTS.force = ''; }
        expect(w.arenaEvent, `${dungeon} ${id}`).toBe(id);
        w.events.length = 0;
        q.arenaEventClock(w.arenaEventT + 0.01);
        q.arenaEventClock((fuse[id] ?? 0) + 0.01);
        const c = { cls: 'emberwright' as const, acting: 0, dungeon };
        const got = w.events.filter((e) => e.type === 'arenaEvent').map((e) => cueFor(e, c)?.id ?? null);
        const set = ARENA_EVENT_SOUNDS[id];
        expect(got[0], `${dungeon} ${id} warn`).toBe(set.warn);
        if (id === 'highWater') {
          // Its warn and land arrive together and the Ebb's own call follows: one ordinary swell, no landing.
          expect(PRIORITY.has(set.warn)).toBe(false);
          expect(got.slice(1).every((x) => x === null), `${dungeon} ${id}: ${got}`).toBe(true);
          continue;
        }
        expect(PRIORITY.has(set.warn), id).toBe(true);
        expect(recipeLength(SOUNDS[set.warn]), id).toBeLessThan(fuse[id]);
        expect(got[1], `${dungeon} ${id} land`).toBeTruthy();
        (lands[id] ??= []).push(got[1]!);
      }
    }
    // Every dungeon that rolls an event lands it in its own sound.
    for (const [id, ids] of Object.entries(lands)) expect(new Set(ids).size, `${id}: ${ids}`).toBe(ids.length);
    expect(Object.keys(lands).sort()).toEqual(['caveIn', 'coldSnap', 'ventSurge']);
  });

  it('lets a Brood named foe\'s pack be heard spilling out when it falls; every other named foe falls as usual (Phase 14 X7)', () => {
    const c = { cls: 'emberwright' as const, acting: 0 };
    const kill = { type: 'namedKill', x: 0, y: 0, name: 'X' } as never;
    for (const affix of AFFIXES) expect(cueFor(kill, { ...c, namedAffix: affix })?.id, affix).toBe(affix === 'Brood' ? 'namedKillBrood' : 'namedKill');
    expect(cueFor(kill, c)?.id).toBe('namedKill');
    expect(Math.abs(phoneDb(render(SOUNDS.namedKillBrood, 22050), 22050) - phoneDb(render(SOUNDS.namedKill, 22050), 22050))).toBeLessThan(1);
    // The sim spawns the pack on the same kill that fires namedKill, and the game and busycheck pass the run's affix.
    const world = readFileSync(new URL('../sim/world.ts', import.meta.url), 'utf8');
    expect(world).toMatch(/if \(AFFIXES\[e\.affix\] === 'Brood'\) \{[\s\S]{0,400}this\.spawn\(kind[\s\S]{0,200}type: 'namedKill'/);
    const w = new World({ seed: 1, dungeon: 'kiln', tier: 2, omens: [], cls: 'emberwright' });
    expect(typeof w.namedPlan).toBe('function');
    for (const f of ['../client/GameScene.ts', '../tools/busycheck.ts']) {
      expect(readFileSync(new URL(f, import.meta.url), 'utf8'), f).toContain('namedAffix: w.namedPlan()?.affix');
    }
  });

  it('has the raids\' own cave-in and vent-surge landings ready for their trash fights (Phase 15 Y2)', () => {
    const raids = (Object.keys(DUNGEONS) as DungeonId[]).filter((d) => DUNGEONS[d].raid);
    expect(raids.sort()).toEqual(['crucible', 'flue', 'hoard', 'smeltery']);
    const base = { caveIn: phoneDb(render(SOUNDS.caveInLand, 22050), 22050), ventSurge: phoneDb(render(SOUNDS.ventSurgeLand, 22050), 22050) };
    for (const ev of ['caveIn', 'ventSurge'] as const) {
      const all = Object.entries(ARENA_LAND).filter(([k]) => k.startsWith(`${ev}.`)).map(([, v]) => v);
      expect(new Set(all).size, ev).toBe(all.length);
      for (const d of raids) {
        const id = cueFor({ type: 'arenaEvent', id: ev, stage: 'land' } as never, { cls: 'emberwright' as const, acting: 0, dungeon: d })?.id;
        expect(id, `${ev}.${d}`).toBe(ARENA_LAND[`${ev}.${d}`]);
        expect(id).not.toBe(ARENA_EVENT_SOUNDS[ev].land);
        expect(recipeLength(SOUNDS[id!]), id).toBeLessThan(1);
        expect(Math.abs(phoneDb(render(SOUNDS[id!], 22050), 22050) - base[ev]), id).toBeLessThan(3.5);
      }
    }
  });

  it('calls a marked foe in by its mark, as a must-hear cue; other named foes keep the usual call (Phase 14 X7)', () => {
    const c = { cls: 'emberwright' as const, acting: 0 };
    for (const affix of AFFIXES) {
      const id = cueFor({ type: 'namedSpawn', index: 0, name: 'X', affix } as never, c)?.id;
      expect(id, affix).toBe(AFFIX_SPAWN[affix] ?? 'namedSpawn');
      expect(PRIORITY.has(id!), affix).toBe(true);
      expect(recipeLength(SOUNDS[id!]), affix).toBeLessThan(1.5);
    }
    expect(Object.keys(AFFIX_SPAWN).sort()).toEqual(['Brood', 'Smoldering']);
    expect(new Set(Object.values(AFFIX_SPAWN)).size).toBe(2);
  });

  it('sounds each wave shape: a call as a pincer or ring starts, and reinforcements warn from their flank, then land (Phase 15 Y7)', () => {
    type Q = { startEncounter(): void; encounter: number; route: string[] };
    const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'kiln', listen: { x: 0, half: 400 } };
    const heard = (shape: string, ticks: number) => {
      const w = new World({ seed: 1, dungeon: 'kiln', tier: 2, omens: [], cls: 'emberwright' });
      const q = w as unknown as Q;
      for (const e of w.enemies) e.alive = false;
      q.route[1] = 'pack';
      q.encounter = 1;
      WAVES.force = shape;
      try { q.startEncounter(); } finally { WAVES.force = ''; }
      const evs = [...w.events];
      for (let k = 0; k < ticks; k++) { w.step({ mx: 0, my: 0 } as never); evs.push(...w.events); }
      return evs.filter((e) => e.type === 'waveShape').map((e) => ({ stage: (e as { stage: string }).stage, id: cueFor(e, c)?.id ?? null, pan: panFor(e, c) }));
    };
    expect(heard('pincer', 0)).toEqual([{ stage: 'start', id: 'wavePincer', pan: undefined }]);
    expect(heard('ring', 0)).toEqual([{ stage: 'start', id: 'waveRing', pan: undefined }]);
    const r = heard('reinforce', Math.ceil((WAVES.reinforceAt + 0.5) * 60));
    expect(r.map((x) => [x.stage, x.id])).toEqual([['start', null], ['warn', 'reinforceWarn'], ['land', 'reinforceLand']]);
    // The warning is must-hear, ends before they arrive, and pans to their flank.
    expect(PRIORITY.has('reinforceWarn')).toBe(true);
    expect(recipeLength(SOUNDS.reinforceWarn)).toBeLessThan(WAVES.reinforceWarn);
    expect(typeof r[1].pan).toBe('number');
    expect(Math.abs(r[1].pan!)).toBeGreaterThan(0);
    for (const id of ['wavePincer', 'waveRing', 'reinforceLand'] as const) expect(PRIORITY.has(id), id).toBe(false);
    expect(Object.keys(WAVE_SOUNDS).sort()).toEqual(['pincer', 'reinforce', 'ring']);
  });

  it('groans once when the dungeon stirs, after the fight\'s own stings, whatever the reaction (Phase 15 Y10)', () => {
    type Q = { startEncounter(): void; encounter: number; route: string[] };
    const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'foundry' };
    for (const id of STIR_IDS) {
      const w = new World({ seed: 1, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' });
      const q = w as unknown as Q;
      for (const e of w.enemies) e.alive = false;
      q.route[2] = id === 'named' ? 'wardens' : 'pack'; // a named foe needs a fight with an elite, as in stir.test.ts
      q.encounter = 2;
      STIR.force = id;
      try { q.startEncounter(); } finally { STIR.force = ''; }
      const stirs = w.events.filter((e) => e.type === 'stir');
      // A named stir needs this run to have no named foe planned yet (stirChoices), as stir.test.ts allows for.
      if (id === 'named' && w.stir !== 'named') { expect(stirs.length).toBe(0); continue; }
      expect(stirs.length, id).toBe(1);
      expect(cueFor(stirs[0], c)?.id, id).toBe('dungeonStir');
    }
    expect(PRIORITY.has('dungeonStir')).toBe(false);
    // It waits out the layout and Heat stings (both under 0.9 s) before its groan, and stays under 2 s.
    const firstVoice = Math.min(...SOUNDS.dungeonStir.map((v) => v.delay ?? 0));
    expect(firstVoice).toBeGreaterThanOrEqual(0.6);
    expect(recipeLength(SOUNDS.dungeonStir)).toBeLessThan(2);
    expect(Math.abs(phoneDb(render(SOUNDS.dungeonStir, 22050), 22050) - phoneDb(render(SOUNDS.layoutPillars, 22050), 22050))).toBeLessThan(1);
  });

  it('hisses before Maelra\'s Sealed Vents move the steam and bursts as the new vent opens (Phase 15 Y3)', () => {
    type M = { spawn(k: string, x: number, y: number): number; bossIndex: number; bossSpawned: boolean; startMaelra(): void; runMaelra(i: number, dt: number): void };
    const w = new World({ seed: 9, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' });
    const q = w as unknown as M;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('maelra', 300, 300);
    q.bossIndex = b; q.bossSpawned = true;
    q.startMaelra();
    w.bossVariant = 'seal';
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5; w.enemies[b].abilityT = 99;
    const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'foundry' };
    const heard: string[] = [];
    const tick = (dt: number) => { w.events.length = 0; q.runMaelra(b, dt); for (const e of w.events) if (e.type === 'ventShift') heard.push(`${e.stage}:${cueFor(e, c)?.id}`); };
    tick(0.01); tick(MAELRA_SEAL.every - MAELRA_SEAL.warn); tick(MAELRA_SEAL.warn);
    expect(heard).toEqual(['open:steamMoveOpen', 'warn:steamMoveWarn', 'open:steamMoveOpen']);
    // The warning is a priority call, like Sluicetide's tideTurn, and the hiss has built and ended before the steam arrives.
    expect(PRIORITY.has('steamMoveWarn')).toBe(true);
    expect(PRIORITY.has('tideTurn')).toBe(true);
    expect(recipeLength(SOUNDS.steamMoveWarn)).toBeLessThan(MAELRA_SEAL.warn);
    expect(PRIORITY.has('steamMoveOpen')).toBe(false);
  });

  it('sweeps the light round as the Lensmother\'s Carried Light moves it, after her Glare warning and panned toward her (Phase 15 Y3)', () => {
    type G = { spawn(k: string, x: number, y: number): number; bossIndex: number; bossSpawned: boolean; bossPhase: number; markT: number; bossBrandT: number; glareT: number; runLensmother(i: number, dt: number): void };
    const w = new World({ seed: 6, dungeon: 'glarewell', tier: 7, omens: [], cls: 'emberwright' });
    const q = w as unknown as G;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('lensmother', 400, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = 'walk';
    q.bossPhase = 2; q.markT = 0; q.bossBrandT = 0; q.glareT = 0;
    w.enemies[b].abilityT = 99;
    w.events.length = 0;
    q.runLensmother(b, 0.01);
    const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'glarewell', listen: { x: 0, half: 500 } };
    const move = w.events.find((e) => e.type === 'lightMove');
    const start = w.events.find((e) => e.type === 'castStart');
    expect(move && cueFor(move, c)?.id).toBe('lightSwing');
    expect(start && cueFor(start, c)?.id).toBe('castWarn');
    // It waits for the Glare's warning to end, so the priority duck doesn't bury it, and it ends well inside the warning.
    const first = Math.min(...SOUNDS.lightSwing.map((v) => v.delay ?? 0));
    expect(first).toBeGreaterThanOrEqual(recipeLength(SOUNDS.castWarn));
    expect(recipeLength(SOUNDS.lightSwing)).toBeLessThan(GLARE.glareWarn);
    expect(PRIORITY.has('lightSwing')).toBe(false);
    // She is to the right of the hero, so the swing is too.
    expect(panFor(move!, c)).toBeGreaterThan(0);
    // Phase 1 keeps the light in the centre: no swing.
    w.events.length = 0; q.bossPhase = 1; q.glareT = 0; w.enemies[b].castId = '';
    q.runLensmother(b, 0.01);
    expect(w.events.some((e) => e.type === 'lightMove')).toBe(false);
  });

  it('swells as Nhevra\'s Creeping Rime rises, after her phase sting, and crackles while you stand in it (Phase 15 Y3)', () => {
    type N = { spawn(kind: string, x: number, y: number): number; coldClock(dt: number): void; bossIndex: number; bossSpawned: boolean;
      coldPhase: number; driftT: number; iceT: number; snuffT: number; tideT: number; nightT: number };
    const w = new World({ seed: 8, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
    const q = w as unknown as N;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('nhevra', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = 'rime';
    w.enemies[b].hp = w.enemies[b].maxHp * 0.4;
    q.coldPhase = 2; q.driftT = 0; q.iceT = 0; q.snuffT = 99; q.tideT = 99; q.nightT = 99;
    w.player.x = 500; w.player.y = 500;
    w.events.length = 0;
    q.coldClock(0.01);
    const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'coldmarrow' };
    const rise = w.events.find((e) => e.type === 'rimeRise');
    expect(rise && cueFor(rise, c)?.id).toBe('rimeRise');
    // It waits for Nhevra's phase sting (priority, so it ducks everything else) to end.
    expect(Math.min(...SOUNDS.rimeRise.map((v) => v.delay ?? 0))).toBeGreaterThanOrEqual(recipeLength(SOUNDS[PHASE_STING.nhevra as SoundId]));
    expect(PRIORITY.has('rimeRise')).toBe(false);
    // The crackle follows the sim's own chill test: outside, then just inside, then just past the edge.
    expect(inRimeNow(w)).toBe(false);
    w.player.x = w.rimeX + CREEPING_RIME.r - 1; w.player.y = w.rimeY;
    expect(inRimeNow(w)).toBe(true);
    w.player.chill = 0; q.coldClock(0.1);
    expect(w.player.chill).toBeGreaterThan(0);
    w.player.x = w.rimeX + CREEPING_RIME.r + 1; w.player.y = w.rimeY;
    expect(inRimeNow(w)).toBe(false);
    const hp = w.player.hp; w.player.x = w.rimeX; w.player.y = w.rimeY; w.player.hp = 0;
    expect(inRimeNow(w)).toBe(false);
    w.player.hp = hp;
    // Off on any other version.
    w.rimeOn = false;
    expect(inRimeNow(w)).toBe(false);
    // Throttled like the lava sizzle, and wired from the scene to the mixer.
    expect(THROTTLE.rimeCrackle).toBe(THROTTLE.lavaSizzle);
    expect(recipeLength(SOUNDS.rimeCrackle)).toBeLessThan(THROTTLE.rimeCrackle ?? 0);
    const mixer = readFileSync(new URL('../client/audio/index.ts', import.meta.url), 'utf8');
    expect(mixer).toMatch(/if \(ctx\.inRime\) this\.cue\(\{ id: 'rimeCrackle'/);
    const scene = readFileSync(new URL('../client/GameScene.ts', import.meta.url), 'utf8');
    expect(scene).toMatch(/inRime: inRimeNow\(w\)/);
  });

  it('gives Hessa\'s Whirl its own swirling wind-up and pull, apart from the Ebb and the Outsurge (Phase 15 Y3)', () => {
    type H = { spawn(kind: string, x: number, y: number): number; wrackClock(dt: number): void; bossIndex: number; bossSpawned: boolean;
      wrackPhase: number; ebbT: number; ebbWarnT: number; tideClockT: number; rafts: unknown[] };
    const make = (variant: string, phase = 2) => {
      const w = new World({ seed: 5, dungeon: 'wrackline', tier: 10, omens: [], cls: 'emberwright' });
      const q = w as unknown as H;
      for (const e of w.enemies) e.alive = false;
      const b = q.spawn('hessa', 0, 0);
      q.bossIndex = b; q.bossSpawned = true; q.wrackPhase = phase;
      w.bossVariant = variant as never;
      w.enemies[b].abilityT = 99;
      q.rafts = []; q.ebbT = 0; q.ebbWarnT = 0; q.tideClockT = 0;
      w.player.x = 300; w.player.y = 0;
      w.events.length = 0;
      q.wrackClock(0.01);
      // The context exactly as GameScene builds it.
      const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'wrackline', outsurge: w.outsurge, whirl: w.whirl };
      const start = w.events.find((e) => e.type === 'castStart' && e.id === 'ebb');
      return { w, c, warn: start ? cueFor(start, c)?.id : undefined };
    };
    const whirl = make('whirl');
    expect(whirl.c.whirl).toBe(true);
    expect(whirl.warn).toBe('whirlWarn');
    expect(ebbCue({ on: false }, true, whirl.c.outsurge, whirl.c.whirl)?.id).toBe('whirlPull');
    expect(PRIORITY.has('whirlWarn') && PRIORITY.has('whirlPull')).toBe(true);
    expect(recipeLength(SOUNDS.whirlWarn)).toBe(recipeLength(SOUNDS.ebbWarn));
    // Phase 1 of a whirl run, and the other versions, keep their own sounds.
    const early = make('whirl', 1);
    expect(early.c.whirl).toBe(false);
    expect(early.warn).toBe('ebbWarn');
    expect(make('riptide').warn).toBe('ebbWarn');
    expect(make('outsurge').warn).toBe('outsurgeWarn');
    expect(ebbCue({ on: false }, true, false, false)?.id).toBe('ebbPull');
    // Wired from the scene, the mixer and busycheck.
    const scene = readFileSync(new URL('../client/GameScene.ts', import.meta.url), 'utf8');
    expect(scene).toMatch(/whirl: w\.dungeonId === 'wrackline' && w\.whirl/);
    const mixer = readFileSync(new URL('../client/audio/index.ts', import.meta.url), 'utf8');
    expect(mixer).toMatch(/ebbCue\(this\.ebbing, !!ctx\.ebbPull, !!ctx\.outsurge, !!ctx\.whirl\)/);
  });

  it('spins Ondrel\'s Homeward Hammer out, then rings it home with the return line\'s timing built in (Phase 15 Y3)', () => {
    type O = { ondrelClock(dt: number): void; finishCast(i: number): void; spawn(kind: string, x: number, y: number): number;
      bossIndex: number; bossSpawned: boolean; choirT: number; anvilT: number };
    const party = [{ cls: 'bulwark' as const, name: 'a' }, { cls: 'lumen' as const, name: 'b' }, { cls: 'duskblade' as const, name: 'c' }, { cls: 'emberwright' as const, name: 'd' }];
    const w = new World({ seed: 3, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark', party });
    const q = w as unknown as O;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('ondrel', 0, -200);
    q.bossIndex = b; q.bossSpawned = true; q.anvilT = 99;
    w.bossVariant = 'home';
    for (let k = 0; k < 4; k++) { const p = w.heroData(k).player; p.x = 0; p.y = k === 0 ? -170 : 0; }
    w.heroData(3).player.x = 300; w.heroData(3).player.y = 100;
    const c = { cls: 'bulwark' as const, acting: 0, dungeon: 'hammerdeep', listen: { x: 0, half: 500 } };
    const heard: { stage: string; id?: string; t: number }[] = [];
    let t = 0;
    const grab = () => { for (const ev of w.events) if (ev.type === 'homeward') heard.push({ stage: ev.stage, id: cueFor(ev, c)?.id, t }); w.events.length = 0; };
    w.events.length = 0;
    w.enemies[b].castId = 'homeward';
    q.finishCast(b); grab();
    q.choirT = 99;
    q.ondrelClock(HOMEWARD.fall + 0.01); t = HOMEWARD.fall; grab();
    expect(heard.map((h) => `${h.stage}:${h.id}`)).toEqual(['out:homeOut', 'back:homeBack']);
    const out = { type: 'homeward', stage: 'out', x: 300, y: 100 } as never;
    // The throw is panned toward the hero it is thrown at; the ring-and-return is a priority call (centred).
    expect(panFor(out, c)).toBeGreaterThan(0);
    expect(PRIORITY.has('homeOut')).toBe(false);
    expect(PRIORITY.has('homeBack')).toBe(true);
    // The throw's whoosh ends before it lands; the return whoosh peaks as the line lands and no later.
    expect(recipeLength(SOUNDS.homeOut)).toBeLessThan(HOMEWARD.fall);
    expect(recipeLength(SOUNDS.homeBack)).toBeLessThanOrEqual(HOMEWARD.back);
    expect(recipeLength(SOUNDS.homeBack)).toBeGreaterThan(HOMEWARD.back - 0.1);
  });

  it('counts Ysmeret\'s Rolling Vents: an opening call, then a step up for each next vent and a closing ring on the last (Phase 15 Y3)', () => {
    type Y = { ysmeretClock(dt: number): void; spawn(kind: string, x: number, y: number): number;
      bossIndex: number; bossSpawned: boolean; twinVentT: number; scatterT: number; bellowT: number };
    const w = new World({ seed: 3, dungeon: 'ashvents', tier: 6, omens: [], cls: 'bulwark' });
    const q = w as unknown as Y;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('ysmeret', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = 'roll';
    q.twinVentT = 0; q.scatterT = 99; q.bellowT = 99;
    const c = { cls: 'bulwark' as const, acting: 0, dungeon: 'ashvents' };
    const heard: string[] = [];
    const grab = () => { for (const ev of w.events) if (ev.type === 'castStart' || ev.type === 'ventRoll') heard.push(cueFor(ev, c)?.id ?? 'none'); w.events.length = 0; };
    w.events.length = 0;
    q.ysmeretClock(1 / 30); grab();
    for (let n = 1; n < ROLLING.count; n++) {
      for (const t of w.telegraphs) if (t.alive && t.owner === -2) t.alive = false; // soaked
      q.ysmeretClock(1 / 30); grab();
    }
    expect(heard).toEqual(['rollVentWarn', ...Array(ROLLING.count - 2).fill('ventRollNext'), 'ventRollLast']);
    // Each is a soak call, so each is priority, and each next vent's sound ends long before its fuse does.
    for (const id of ['rollVentWarn', 'ventRollNext', 'ventRollLast'] as const) expect(PRIORITY.has(id)).toBe(true);
    expect(recipeLength(SOUNDS.ventRollLast)).toBeLessThan(ROLLING.fuse / 2);
    // The other versions keep their own calls.
    const ash = { cls: 'bulwark' as const, acting: 0, dungeon: 'ashvents' };
    expect(cueFor({ type: 'castStart', index: 0, id: 'twinVents', name: 'Twin Vents' } as never, ash)?.id).not.toBe('rollVentWarn');
    expect(readFileSync('sim/world.ts', 'utf8')).toContain(`'${ROLLING_VENTS}'`);
  });

  it('winds up Oskel\'s Punch Line on its own beat, then thunks once for each step of the march (Phase 15 Y3)', () => {
    type P = { spawn(kind: string, x: number, y: number): number; oskelClock(dt: number): void; updatePartyTelegraphs(dt: number): void;
      bossIndex: number; rivetT: number; downT: number; stampT: number };
    const w = new World({ seed: 5, dungeon: 'pressworks', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }] });
    const q = w as unknown as P;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('oskel', 0, -300);
    q.bossIndex = b;
    w.bossVariant = 'punch';
    q.downT = 99; q.stampT = 99; q.rivetT = 0;
    w.events.length = 0;
    q.oskelClock(1 / 30);
    const c = { cls: 'bulwark' as const, acting: 0, dungeon: 'pressworks' };
    const start = w.events.find((e) => e.type === 'castStart' && e.id === 'punchLine');
    expect(start && cueFor(start, c)?.id).toBe('punchLineWarn');
    expect(PRIORITY.has('punchLineWarn')).toBe(true);
    expect(recipeLength(SOUNDS.punchLineWarn)).toBeLessThan(PUNCH.first);
    // March the fuses down and listen to every landing.
    const lands: number[] = [];
    const dt = 1 / 60;
    for (let t = 0; t < PUNCH.first + PUNCH.step * PUNCH.n + 0.2; t += dt) {
      w.events.length = 0;
      q.updatePartyTelegraphs(dt);
      const here = w.events.filter((e) => e.type === 'slam' && isPunchR(e.r));
      for (const e of here) expect(cueFor(e, c)?.id).toBe('punchHit');
      if (here.length) lands.push(t);
    }
    // Steps land PUNCH.step apart (all rows in one tick), and each thunk is over before the next step.
    expect(lands.length).toBeGreaterThanOrEqual(2);
    for (let k = 1; k < lands.length; k++) expect(lands[k] - lands[k - 1]).toBeCloseTo(PUNCH.step, 1);
    expect(recipeLength(SOUNDS.punchHit)).toBeLessThan(PUNCH.step);
    // The throttle folds the three rows of one step into one thunk and never swallows the next step.
    expect(THROTTLE.punchHit ?? 0).toBeGreaterThan(dt);
    expect(THROTTLE.punchHit ?? 0).toBeLessThan(PUNCH.step);
    // No other Pressworks landing shares the punch's radius.
    for (const r of [OSKEL.downRadius, OSKEL.rivetRadius, DIECUT_R]) expect(r).not.toBe(PUNCH.r);
  });

  it('calls the raid in before Grandmother Slag\'s Overflow rises, crashes as it burns, and drains as it ebbs (Phase 15 Y3)', () => {
    type G = { slagClock(dt: number): void; spawn(kind: string, x: number, y: number): number; bossIndex: number; bossSpawned: boolean;
      heatT: number; pourT: number; ladleT: number };
    const party = [{ cls: 'lumen' as const, name: 'b' }, { cls: 'duskblade' as const, name: 'c' }, { cls: 'emberwright' as const, name: 'd' }];
    const w = new World({ seed: 3, dungeon: 'crucible', tier: 8, omens: [], cls: 'bulwark', party });
    const q = w as unknown as G;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('grandmotherSlag', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    w.bossVariant = 'flow';
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ladleT = 99;
    const c = { cls: 'bulwark' as const, acting: 0, dungeon: 'crucible' };
    const heard: string[] = [];
    const tick = (dt: number) => { w.events.length = 0; q.heatT = 99; q.pourT = 99; q.slagClock(dt); for (const ev of w.events) if (ev.type === 'overflow') heard.push(`${ev.stage}:${cueFor(ev, c)?.id}`); };
    tick(1 / 30); tick(OVERFLOW.first + 0.01); tick(OVERFLOW.warn + 0.01); tick(OVERFLOW.last + 0.01);
    expect(heard).toEqual(['warn:overflowWarn', 'rise:overflowRise', 'ebb:overflowEbb']);
    // The warning and the rise are calls to act (priority); the ebb is the all-clear (ordinary).
    expect(PRIORITY.has('overflowWarn') && PRIORITY.has('overflowRise')).toBe(true);
    expect(PRIORITY.has('overflowEbb')).toBe(false);
    // The warning has ended before the slag rises, so the crash is heard on its own.
    expect(recipeLength(SOUNDS.overflowWarn)).toBeLessThan(OVERFLOW.warn);
    expect(recipeLength(SOUNDS.overflowRise)).toBeLessThan(OVERFLOW.last);
  });

  it('warns of Old Vorhulm\'s Inhale once, roars in the in-breath, and sighs the all-clear (Phase 15 Y3)', () => {
    type G = { coalClock(dt: number): void; spawn(kind: string, x: number, y: number): number; bossIndex: number;
      gorgeT: number; swallowT: number; spillT: number };
    const w = new World({ seed: 5, dungeon: 'hoard', omens: [], cls: 'bulwark', worldBoss: 'Old Vorhulm',
      party: [{ cls: 'emberwright' }, { cls: 'emberwright' }, { cls: 'emberwright' }] });
    const q = w as unknown as G;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('vorhulm', 0, -200);
    q.bossIndex = b;
    w.bossVariant = 'inhale';
    w.enemies[b].hp = w.enemies[b].maxHp * 0.2;
    w.heroes.forEach((h, k) => { h.player.x = -150 + k * 100; h.player.y = 0; });
    const c = { cls: 'bulwark' as const, acting: 0, dungeon: 'hoard' };
    const heard: string[] = [];
    const tick = (dt: number) => {
      w.events.length = 0; q.gorgeT = 999; q.swallowT = 999; q.coalClock(dt);
      for (const ev of w.events) if (ev.type === 'castStart' || ev.type === 'inhale') heard.push(`${ev.type === 'inhale' ? ev.stage : ev.type}:${cueFor(ev, c)?.id ?? '-'}`);
    };
    q.spillT = 0;
    tick(1 / 30); tick(INHALE.warn + 0.001); q.spillT = 999; tick(INHALE.time);
    // One warning (the castStart), not two: the event's own warn stage is silent.
    expect(heard).toEqual(['castStart:inhaleWarn', 'warn:-', 'draw:inhaleDraw', 'end:inhaleEnd']);
    expect(PRIORITY.has('inhaleWarn') && PRIORITY.has('inhaleDraw')).toBe(true);
    expect(PRIORITY.has('inhaleEnd')).toBe(false);
    // The warning is over before he breathes in, and the in-breath is over before the all-clear.
    expect(recipeLength(SOUNDS.inhaleWarn)).toBeLessThan(INHALE.warn);
    expect(recipeLength(SOUNDS.inhaleDraw)).toBeLessThan(INHALE.time);
  });

  it('warns of the Colossus\'s Millstone, grinds every slag tick panned round with his front, and settles at the end (Phase 15 Y3)', () => {
    const w = new World({ seed: 19, dungeon: 'smeltery', tier: 10, omens: [], cls: 'duskblade', party: (['bulwark', 'lumen', 'emberwright'] as const).map((cls, k) => ({ cls, name: `${cls}${k}` })) });
    (w as unknown as { rollColossusVariant(): string }).rollColossusVariant = () => 'mill';
    const c = { cls: 'duskblade' as const, acting: 0, dungeon: 'smeltery', boss: 'colossus' as const };
    const heard: string[] = [];
    const pans: number[] = [];
    let grinds = 0, lastGrind = -1;
    while (w.state !== 'ended' && w.time < 900 && !heard.includes('end:millEnd')) {
      if (w.state === 'draft') {
        const h = Math.max(0, w.heroes.findIndex((_, i) => w.choicesOf(i).length > 0));
        w.use(h); const pick = botChoose(w); w.use(0); w.choose(pick, h);
        continue;
      }
      const inputs = w.heroes.map((_, i) => { w.use(i); const inp = botInput(w); w.use(0); return inp; });
      w.step(inputs);
      for (const ev of w.events) {
        if ((ev.type === 'castStart' || ev.type === 'castDone') && ev.id === 'millstone') heard.push(`${ev.type}:${cueFor(ev, c)?.id ?? '-'}`);
        if (ev.type === 'millstone') heard.push(`${ev.stage}:${cueFor(ev, c)?.id}`);
      }
      // The grind: only while he turns, panned by where his front faces from the hero (world x, as in 2D).
      const g = millCue({ colossus: colossusCue(w), listen: { x: w.player.x, half: 280 } });
      expect(!!g).toBe(w.millT > 0);
      if (g && w.time - lastGrind >= THROTTLE.millGrind!) { grinds++; lastGrind = w.time; pans.push(g.pan ?? 0); }
    }
    expect(heard.slice(0, 4)).toEqual(['castStart:millWarn', 'start:millStart', 'castDone:-', 'end:millEnd']);
    expect(PRIORITY.has('millWarn')).toBe(true);
    for (const id of ['millStart', 'millGrind', 'millEnd'] as const) expect(PRIORITY.has(id), id).toBe(false);
    // One grind per slag tick over the 6 s turn, and a turn of about 5 radians swings it from one side to the other.
    expect(grinds).toBeGreaterThanOrEqual(11);
    expect(Math.min(...pans)).toBeLessThan(-0.1);
    expect(Math.max(...pans)).toBeGreaterThan(0.1);
    expect(recipeLength(SOUNDS.millWarn)).toBeLessThan(2);
    expect(THROTTLE.millGrind!).toBeLessThan(0.5);
  }, 60000);

  it('calls the Regent\'s Tithe, chimes when it is shared, and stamps hard when everyone pays (Phase 15 Y3)', () => {
    type F = { spawn(k: string, x: number, y: number): number; bossIndex: number; bossSpawned: boolean; decreeT: number; ashT: number;
      regentClock(dt: number): void; updatePartyTelegraphs(dt: number): void };
    const c = { cls: 'bulwark' as const, acting: 0, dungeon: 'flue', boss: 'regent' as const };
    const run = (shared: boolean) => {
      const w = new World({ seed: 7, dungeon: 'flue', omens: [], cls: 'bulwark', worldBoss: 'The Furnace Regent',
        party: [{ cls: 'lumen' }, { cls: 'duskblade' }, { cls: 'emberwright' }] });
      const q = w as unknown as F;
      for (const e of w.enemies) e.alive = false;
      const b = q.spawn('regent', 0, 0);
      q.bossIndex = b; q.bossSpawned = true; q.decreeT = 999; q.ashT = 0;
      w.bossVariant = 'tithe';
      w.enemies[b].hp = w.enemies[b].maxHp * (REGENT.phase2 - 0.01);
      w.heroes.forEach((h, k) => { h.player.x = 60 + k * 200; h.player.y = 0; });
      w.events.length = 0;
      q.regentClock(0.01);
      const heard = w.events.filter((ev) => ev.type === 'castStart' && ev.id === 'tithe').map((ev) => cueFor(ev, c)?.id);
      const t = w.telegraphs.find((x) => x.alive && x.kind === 'soak' && x.owner === -5)!;
      w.heroes.forEach((h, k) => { h.player.x = shared && k < TITHE.need ? t.x : -t.x * 0.5; h.player.y = shared && k < TITHE.need ? t.y : -t.y * 0.5 + k * 40; });
      t.t = t.dur;
      w.events.length = 0;
      q.updatePartyTelegraphs(0.01);
      // The soak event fires too, but the mix drops it for a Tithe: one landing sound, not two.
      expect(w.events.some((ev) => ev.type === 'soak')).toBe(true);
      for (const ev of withoutBankedSoaks(w.events)) { const k = cueFor(ev, c); if (k && ev.type !== 'playerHurt') heard.push(k.id); }
      return heard;
    };
    expect(run(true)).toEqual(['titheWarn', 'titheShared']);
    expect(run(false)).toEqual(['titheWarn', 'titheMissed']);
    expect(PRIORITY.has('titheWarn') && PRIORITY.has('titheMissed')).toBe(true);
    expect(PRIORITY.has('titheShared')).toBe(false);
    expect(recipeLength(SOUNDS.titheWarn)).toBeLessThan(TITHE.fuse);
  });

  it('marks a boss\'s echo with a quiet sting on top of the borrowed move\'s own warning (Phase 16 U1)', () => {
    type B = { spawn(k: string, x: number, y: number): number; bossIndex: number; bossSpawned: boolean; bossPhase: number; runBoss(i: number, dt: number): void; echoNext: boolean };
    const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'kiln' };
    const expectWarn: Record<string, string> = { turning: 'turnFireWarn', draw: 'kilnDraw', cataclysm: 'castWarn' };
    for (const [own, echo] of [['cataclysm', 'turning'], ['turning', 'draw'], ['draw', 'cataclysm']] as const) {
      const w = new World({ seed: 3, dungeon: 'kiln', tier: 8, omens: [], cls: 'emberwright' });
      const q = w as unknown as B;
      for (const e of w.enemies) e.alive = false;
      const b = q.spawn('kilnMother', 0, 0);
      q.bossIndex = b; q.bossSpawned = true; q.bossPhase = 3;
      w.bossVariant = own; w.bossEcho = echo; q.echoNext = true;
      w.enemies[b].hp = w.enemies[b].maxHp * 0.2; w.enemies[b].aux = 0;
      w.player.x = 200; w.player.y = 0;
      w.events.length = 0;
      q.runBoss(b, 0.01);
      const heard = w.events.filter((e) => e.type === 'echo' || e.type === 'castStart').map((e) => cueFor(e, c)?.id);
      // The sting and the echoed move's own warning, in the same tick.
      expect(heard, own).toEqual(['echoSting', expectWarn[echo]]);
    }
    // Ordinary and quiet: the move's warning says what to do, so the sting never takes its voice or sits over it.
    expect(PRIORITY.has('echoSting')).toBe(false);
    const db = (id: SoundId) => phoneDb(render(SOUNDS[id], 22050), 22050);
    expect(db('echoSting')).toBeLessThan(db('turnFireWarn') - 4);
    expect(recipeLength(SOUNDS.echoSting)).toBeLessThan(0.7);
  });

  it('warns of the Kiln Mother\'s Turning Fire and sounds each of its four cones landing (Phase 15 Y3)', () => {
    type B = { spawn(k: string, x: number, y: number): number; bossIndex: number; bossSpawned: boolean; bossPhase: number; runBoss(i: number, dt: number): void };
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    const q = w as unknown as B;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('kilnMother', 0, 0);
    q.bossIndex = b; q.bossSpawned = true; q.bossPhase = 2;
    w.bossVariant = 'turning';
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5; w.enemies[b].aux = 0;
    w.player.x = 200; w.player.y = 0;
    w.events.length = 0;
    q.runBoss(b, 0.01);
    const c = { cls: 'emberwright' as const, acting: 0, dungeon: 'kiln' };
    const start = w.events.find((e) => e.type === 'castStart');
    expect(start && cueFor(start, c)?.id).toBe('turnFireWarn');
    expect(PRIORITY.has('turnFireWarn')).toBe(true);
    expect(recipeLength(SOUNDS.turnFireWarn)).toBeLessThan(KILN_TURN.first);
    // Step through the pour: four slams of KILN_TURN.reach, each heard as a cone.
    const heard: { t: number; id: string | null }[] = [];
    for (let k = 0; k < 60 * (KILN_TURN.first + KILN_TURN.cones * KILN_TURN.step); k++) {
      w.step({ mx: 0, my: 0 } as never);
      for (const e of w.events) if (e.type === 'slam' && e.r === KILN_TURN.reach) heard.push({ t: w.time, id: cueFor(e, c)?.id ?? null });
      if (w.player.hp <= 0) w.player.hp = w.player.maxHp;
    }
    expect(heard.map((h) => h.id)).toEqual(Array(KILN_TURN.cones).fill('turnCone'));
    // Each cone's sound ends before the next lands, so four stay four.
    expect(recipeLength(SOUNDS.turnCone)).toBeLessThan(KILN_TURN.step);
    expect(PRIORITY.has('turnCone')).toBe(false);
    // Nothing else in the Kiln makes a slam that big (Kiln Draw's ring is KILN_DRAW.radius).
    const world = readFileSync(new URL('../sim/world.ts', import.meta.url), 'utf8');
    expect([...world.matchAll(/KILN_TURN\.reach/g)].length).toBe(1);
    expect(KILN_DRAW.radius).not.toBe(KILN_TURN.reach);
  });

  it('lists exactly the Heats that lay a floor in FLOOR_HEATS, so no Heat stings twice or goes silent (Phase 14 X1)', () => {
    let checked = 0;
    for (const heat of HEAT_IDS) {
      const d = SOLO_DUNGEON_IDS.find((id) => heatApplies(id, 1));
      expect(d, heat).toBeDefined();
      const w = new World({ seed: 5, dungeon: d!, tier: 1, omens: [], cls: 'emberwright', heat });
      if (w.heat !== heat) continue; // a Heat of another dungeon's own; X1 will say which
      const seen: string[] = [];
      for (let k = 0; k < 120 && !seen.includes('encounterStart'); k++) {
        if (k) w.step({ mx: 0, my: 0 } as never);
        for (const ev of w.events) seen.push(ev.type === 'layout' ? `layout:${ev.id}` : ev.type);
      }
      const laysFloor = seen.some((x) => x === 'layout:pillars' || x === 'layout:vents' || x === 'layout:channel');
      expect(laysFloor, heat).toBe(FLOOR_HEATS.has(heat));
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
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

  it('chimes once when the run put anything new in the Seen log, after the unlocks, level with unlock (Phase 15 Y4)', () => {
    const base = { heroXp: 0, items: [], levelsGained: 0 } as never;
    expect(rewardCues({ ...(base as object), seenNew: [] } as never)).toEqual([]);
    expect(rewardCues({ ...(base as object), seenNew: ['kiln:arena:caveIn', 'kiln:affix:Brood', 'kiln:heat:richHaul'] } as never).map((c) => c.id)).toEqual(['seenNew']);
    expect(rewardCues({ ...(base as object), title: 'The Bold', seenNew: ['kiln:affix:Brood'] } as never).map((c) => c.id)).toEqual(['unlock', 'seenNew']);
    expect(recipeLength(SOUNDS.seenNew)).toBeLessThan(1.5);
    expect(Math.abs(phoneDb(render(SOUNDS.seenNew, 22050), 22050) - phoneDb(render(SOUNDS.unlock, 22050), 22050))).toBeLessThan(1);
    // main.ts fills seenNew before the end screen plays the chimes.
    const main = readFileSync(new URL('../client/main.ts', import.meta.url), 'utf8');
    expect(main.indexOf('rewards.seenNew = recordSeen(')).toBeGreaterThan(-1);
    expect(main.indexOf('rewards.seenNew = recordSeen(')).toBeLessThan(main.indexOf('audio.rewards(rewards)'));
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

  it('in the 3D view, pans by where a sound shows on screen, not by world x', () => {
    // A stand-in for Hd2dView.project: a tilted perspective camera, so a floor point nearer the camera (larger y) spreads wider.
    const W = 400, spread = (y: number) => 0.9 + 0.002 * y;
    const project = (x: number, y: number) => (y > 600 ? null : { x: W / 2 + (x - 100) * spread(y), y: 300 + y * 0.5 });
    const c3 = { cls: 'emberwright' as const, acting: 0, listen: { x: 100, y: 0, half: 250, screen: project, screenHalf: W / 2 } };
    const hit = (x: number, y: number) => ({ type: 'hit' as const, x, y, amount: 1, crit: false });
    // Same world offset, two depths: the nearer one shows further across the screen, so it pans further.
    const far = panFor(hit(180, -100), c3)!, near = panFor(hit(180, 100), c3)!;
    expect(near).toBeGreaterThan(far);
    expect(far).toBeCloseTo((((180 - 100) * spread(-100) - 0) / (W / 2)) * PAN_MAX, 6);
    // World x alone would put both at the same place.
    expect(panFor(hit(180, -100), c)).toBeCloseTo(panFor(hit(180, 100), c)!, 6);
    // Off the far edge of the screen it still stops at PAN_MAX.
    expect(panFor(hit(2000, 0), c3)).toBeCloseTo(PAN_MAX);
    // A point the camera can't place (behind it) or an event with no y falls back to world x.
    expect(panFor(hit(225, 900), c3)).toBeCloseTo(PAN_MAX / 2);
    expect(panFor({ type: 'slam', x: 225, r: 50 } as never, c3)).toBeCloseTo(PAN_MAX / 2);
    // The scene builds the 3D listener from the 3D view's own projection and width.
    const scene = readFileSync(new URL('../client/GameScene.ts', import.meta.url), 'utf8');
    expect(scene).toMatch(/listen: this\.listenFrom\(w\)/);
    expect(scene).toMatch(/screen: \(x, y\) => view\.project\(x, y\), screenHalf: width \/ 2/);
  });
});
