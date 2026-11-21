import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, recipeLength } from '../client/audio/synth';
import { PHONE_FLOOR_DB, SOUNDS, SoundId } from '../client/audio/sounds';
import { bedSamples, chordAt, HUB_BY_SEASON, hubThemeFor, sectionAt, themeFor, THEMES } from '../client/audio/music';
import { DUNGEON_IDS } from '../sim/content/dungeon';
import { SEASON_START_WEEK, SEASON, SEASONS, seasonOf } from '../sim/content/season';
import { colossusCue, SHADOW_STING, BELLY, beatGap, bellyCues, DRY, pressedCue, CAST_SOUNDS, cueFor, DUCK, partyCues, PHASE_STING, phaseSting, pickCue, ebbCue, panFor, PAN_MAX, PRIORITY, setCues, setFlagsOf, THROTTLE, reviveCues, targetCue } from '../client/audio/cues';
import { ENEMIES } from '../sim/content/enemies';
import { buzzFor, BUZZ, Haptics } from '../client/audio/haptics';
import { uiSoundFor, Tappable } from '../client/audio/ui';
import { phoneDb, phoneShare } from '../tools/mixcheck';
import { rewardCues } from '../client/audio/rewards';
import { nextTake, VARIANTS, variantOf } from '../client/audio/variants';
import { World } from '../sim/world';
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
      // 75 simulated seconds per class is enough to hear every core sound and keeps this test near 1 s.
      for (let i = 0; i < 30 * 75 && w.state !== 'ended'; i++) {
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
    expect(cueFor({ type: 'phase', phase: 2 }, { ...c, boss: 'coalmouth', worldBoss: 'Old Coalmouth' })?.id).toBe('phaseSwallow');
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

  it('gives the Hoard its own theme and every Old Coalmouth moment a sound', () => {
    expect(THEMES.hoard.bed).toBe('chew');
    expect(THEMES.hoard).not.toEqual(THEMES.raid);
    const c = { cls: 'bulwark' as const, acting: 0, boss: 'coalmouth' as const };
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
    for (const id of ['salvage', 'forge', 'temper', 'brew']) expect(uiSoundFor(el(['[data-sfx]', 'button'], { 'data-sfx': id }))).toBe(id);
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
    // Seasons 4 to 6 take their featured dungeon's bed: the Glarewell's shimmer, the Pressworks' press, the Wrackline's surf.
    expect(SEASONS.slice(3).map((d) => d.name)).toEqual(['the Slag Moon', 'the Falling Press', 'the Low Ebb']);
    expect([3, 4, 5].map((i) => THEMES[hubThemeFor(i, SEASONS.length)].bed)).toEqual(['shimmer', 'press', 'surf']);
    // Every season has its own hub theme.
    expect(new Set(SEASONS.map((_, i) => hubThemeFor(i, SEASONS.length))).size).toBe(SEASONS.length);
    // Season 2 starts on week 2974 (docs/design/season.md).
    expect(hubThemeFor(seasonOf(SEASON_START_WEEK + SEASON.weeks), SEASONS.length)).toBe('hubBellows');
  });
  it('wraps with the season rotation and falls back to the plain hub', () => {
    expect(HUB_BY_SEASON.length).toBeLessThanOrEqual(SEASONS.length);
    expect(hubThemeFor(SEASONS.length + 1, SEASONS.length)).toBe('hubBellows');
    expect(hubThemeFor(-1, SEASONS.length)).toBe(HUB_BY_SEASON[SEASONS.length - 1] ?? 'hub');
    for (let i = 0; i < SEASONS.length; i++) expect(THEMES[hubThemeFor(i, SEASONS.length)]).toBeDefined();
  });
});

describe('verb-set proc cues', () => {
  const p = { hp: 100, planted: true, surge: true, kbT: 3, warmth: 5, coverT: 0, bondT: 0 };
  it('reads each flag only with the pieces that grant it, and never on a dead hero', () => {
    expect(setFlagsOf(p, () => 1)).toEqual({ planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false, relayed: false });
    expect(setFlagsOf(p, () => 3)).toEqual({ planted: true, surge: true, sharp: true, warmFull: true, covered: false, bonded: false, relayed: false });
    // Tidewalker's surge and Hearthkeeper's full Warmth are the 3-piece bonuses.
    expect(setFlagsOf(p, () => 2)).toEqual({ planted: true, surge: false, sharp: true, warmFull: false, covered: false, bonded: false, relayed: false });
    expect(setFlagsOf({ ...p, hp: 0 }, () => 3)).toEqual({ planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false, relayed: false });
    expect(setFlagsOf({ ...p, warmth: 4 }, () => 3).warmFull).toBe(false);
  });
  it('sounds a proc as it turns on, once', () => {
    const was = {};
    const off = { planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false, relayed: false };
    expect(setCues(was, off)).toEqual([]);
    expect(setCues(was, { ...off, planted: true }).map((c) => c.id)).toEqual(['planted']);
    expect(setCues(was, { ...off, planted: true })).toEqual([]);
    expect(setCues(was, { planted: true, surge: true, sharp: true, warmFull: true, covered: false, bonded: false, relayed: false }).map((c) => c.id)).toEqual(['surgeReady', 'sharpen', 'warmthFull']);
    expect(setCues(was, off)).toEqual([]);
    expect(setCues(was, { ...off, planted: true }).map((c) => c.id)).toEqual(['planted']);
    expect(THROTTLE.planted).toBeGreaterThan(0);
  });
  it('Kinbound: Covered and Bonded sound as they start, and a dead hero hears neither', () => {
    const q = { hp: 100, coverT: 4, bondT: 4 };
    expect(setFlagsOf(q, () => 0)).toMatchObject({ covered: true, bonded: true });
    expect(setFlagsOf({ ...q, hp: 0 }, () => 3)).toMatchObject({ covered: false, bonded: false, relayed: false });
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
