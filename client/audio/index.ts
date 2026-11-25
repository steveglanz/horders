/**
 * The Horders audio engine: sound effects, music and the sound settings.
 *
 * Mobile browsers only allow audio after a tap, so nothing is created until
 * the first pointer or key press; calls before that are ignored (music
 * requests are remembered and start on the unlock). Settings live in
 * localStorage. The game keeps running fine if WebAudio is missing.
 */
import type { RunRewards } from '../../sim/hero';
import { lootCues, rewardCues } from './rewards';
import { render } from './synth';
import { SOUNDS, SoundId } from './sounds';
import { MusicPlayer, type RoomBedKind, ThemeId, THEMES } from './music';
import { TrackPlayer, trackFor } from './tracks';
import { BellyState, bellyCues, edgeCue, gazeCues, restCue, roomCues, millCue, islandCues, withoutBankedSoaks, BELLY, DRY, Cue, CueContext, cueFor, DUCK, DEEP_DUCK, ebbCue, landCueFor, pressedCue, spentCue, panFor, partyCues, SetFlags, setCues, PRIORITY, ReviveState, reviveCues, targetCue, THROTTLE } from './cues';
import type { SimEvent } from '../../sim/world';
import { buzzFor, BUZZ, Haptics } from './haptics';
import { uiSoundFor } from './ui';
import { nextTake, VARIANTS, variantOf } from './variants';

export type { ThemeId } from './music';

export interface AudioSettings {
  muted: boolean;
  /** 0 to 1. */
  music: number;
  sfx: number;
  /** Vibrate on big hits and boss telegraphs (Android only). */
  haptics: boolean;
}

const KEY = 'horders.audio';
const DEFAULTS: AudioSettings = { muted: false, music: 0.6, sfx: 0.8, haptics: true };
/**
 * Low-end phones (few cores or little memory) get fewer simultaneous voices.
 * Extra sounds are skipped, never queued.
 */
const LOW_END = typeof navigator !== 'undefined'
  && ((navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 2);
const MAX_VOICES = LOW_END ? 12 : 20;
/**
 * Sound effects render at this rate (the browser resamples on playback): plenty
 * for these sounds, and a third cheaper to build than 48 kHz.
 */
const SFX_RATE = 32000;

function loadSettings(): AudioSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      muted: typeof s.muted === 'boolean' ? s.muted : DEFAULTS.muted,
      music: typeof s.music === 'number' ? Math.max(0, Math.min(1, s.music)) : DEFAULTS.music,
      sfx: typeof s.sfx === 'number' ? Math.max(0, Math.min(1, s.sfx)) : DEFAULTS.sfx,
      haptics: typeof s.haptics === 'boolean' ? s.haptics : DEFAULTS.haptics,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

class AudioEngine {
  settings: AudioSettings = typeof localStorage === 'undefined' ? { ...DEFAULTS } : loadSettings();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  /** Ordinary sounds go through here, so a priority cue can duck them (DUCK). */
  private fxBus!: GainNode;
  /** The music, ducked a little less. */
  private musicDuck!: GainNode;
  /** The Hoard: a low-pass on the whole mix while this screen's hero is swallowed (wide open otherwise). */
  private belly!: BiquadFilterNode;
  /** Sounds that play past the belly's muffle (the heartbeat), at the sound-effects volume. */
  private dry!: GainNode;
  private duckUntil = 0;
  /** Ordinary sounds still playing, oldest first, so a priority cue can take a voice from a full mix. */
  private ordinary: AudioBufferSourceNode[] = [];
  private musicBus!: GainNode;
  private music: MusicPlayer | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private lastTake = new Map<SoundId, number>();
  private last = new Map<SoundId, number>();
  private voices = 0;
  private wantTheme: ThemeId | null = null;
  private wantIntensity = 0;
  private wantRoomBed: RoomBedKind | null = null;
  /** Steve's Suno songs (tracks.ts), in place of the synth themes; null where the browser can't play them. */
  private tracks: TrackPlayer | null = null;
  private listeners = new Set<() => void>();
  private wasDown: boolean[] = [];
  private targeted = { on: false };
  private ebbing = { on: false };
  private pressing = { on: false };
  private spending = { on: false };
  private islanding = { t: [] as number[] };
  private edging = { next: 0 };
  /** When the next room-life drip and chain may sound (roomCues). */
  private rooming = { drip: 0, chain: 0 };
  /** Each Lampeye's last gaze step (gazeCues). */
  private gazing = { lv: [] as number[] };
  /** Halls: whether Catch breath was on last tick (restCue). */
  private resting = { on: false };
  private duckGain = 1;
  private setFlags: Partial<SetFlags> = {};
  private reviving: ReviveState = { t: [], left: Infinity };
  private bellyState: BellyState = { on: false, next: 0 };
  readonly haptics = new Haptics();

  constructor() {
    this.haptics.enabled = this.settings.haptics;
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Call once at start-up: unlocks audio on the first tap, click or key. */
  install(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlock();
      if (this.ctx?.state === 'running') {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('touchend', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchend', unlock, true);
    window.addEventListener('keydown', unlock, true);
    // Silence in the background; pick back up on return.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (!this.settings.muted) void this.ctx.resume();
      this.tracks?.hold(document.hidden);
    });
    // A soft tick on every button press, so the menus feel physical.
    document.addEventListener('click', (e) => {
      const id = uiSoundFor(e.target instanceof Element ? e.target : null);
      if (id) this.play(id);
    }, true);
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'm' || e.key === 'M') && !(e.target instanceof HTMLInputElement)) this.toggleMute();
    });
  }

  private unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      // A gentle limiter so a boss fight's pile of sounds never clips.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      // Nothing below 40 Hz: no phone or laptop plays it, and it eats the limiter's headroom.
      const floor = ctx.createBiquadFilter();
      floor.type = 'highpass';
      floor.frequency.value = 40;
      this.belly = ctx.createBiquadFilter();
      this.belly.type = 'lowpass';
      this.belly.frequency.value = BELLY.open;
      this.master.connect(this.belly).connect(floor).connect(comp).connect(ctx.destination);
      this.dry = ctx.createGain();
      this.dry.connect(floor);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.fxBus = ctx.createGain();
      this.musicDuck = ctx.createGain();
      this.fxBus.connect(this.sfxBus);
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.musicDuck).connect(this.master);
      this.music = new MusicPlayer(ctx, this.musicBus);
      this.applySettings();
      // iOS: playing a silent buffer inside the tap fully wakes the output.
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination);
      silent.start(0);
      try {
        this.tracks = new TrackPlayer(ctx, this.musicBus, () => this.applyTheme());
      } catch {
        this.tracks = null; // no media element routing here: the synth themes play instead
      }
      this.applyTheme();
      this.music.setIntensity(this.wantIntensity);
      this.music.setRoomBed(this.wantRoomBed);
      // Build the sounds a few at a time in the background, combat sounds
      // first, so the first hit or level-up never waits on a render.
      // Each busy sound's extra takes (VARIANTS) warm right after the base sounds.
      const order: [SoundId, number][] = (Object.keys(SOUNDS) as SoundId[]).map((id) => [id, 0]);
      for (const [id, n] of Object.entries(VARIANTS) as [SoundId, number][]) for (let t = 1; t < n; t++) order.push([id, t]);
      let k = 0;
      // When the browser can tell us it is idle, render in idle time only.
      const idle = (window as unknown as { requestIdleCallback?: (f: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => void }).requestIdleCallback;
      const warm = (d?: { timeRemaining(): number }) => {
        do {
          if (k >= order.length) return;
          const [id, t] = order[k++];
          this.buffer(id, t);
        } while (d && d.timeRemaining() > 8);
        if (idle) idle(warm, { timeout: 1000 });
        else setTimeout(warm, 20);
      };
      setTimeout(() => (idle ? idle(warm, { timeout: 1000 }) : warm()), 250);
    }
    if (this.ctx.state !== 'running' && !this.settings.muted) void this.ctx.resume();
  }

  private applySettings(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.03);
    // Squared so the slider feels even to the ear.
    this.sfxBus.gain.setTargetAtTime(s.sfx * s.sfx, t, 0.03);
    this.dry.gain.setTargetAtTime(s.muted ? 0 : s.sfx * s.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(s.music * s.music * 0.8, t, 0.05);
  }

  set(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // Private mode: settings last for this visit only.
    }
    this.haptics.enabled = this.settings.haptics;
    this.applySettings();
    if (this.ctx && !this.settings.muted && this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
    this.listeners.forEach((f) => f());
  }

  toggleMute(): void {
    this.set({ muted: !this.settings.muted });
  }

  onChange(f: () => void): void {
    this.listeners.add(f);
  }

  private buffer(id: SoundId, take = 0): AudioBuffer {
    const key = take ? `${id}#${take}` : id;
    let b = this.buffers.get(key);
    if (!b) {
      const ctx = this.ctx!;
      const data = render(variantOf(SOUNDS[id], take), SFX_RATE, id.length + take * 101);
      b = ctx.createBuffer(1, data.length, SFX_RATE);
      b.getChannelData(0).set(data);
      this.buffers.set(key, b);
    }
    return b;
  }

  /** The take of a busy sound to play next (VARIANTS), never the same one twice running. */
  private take(id: SoundId): number {
    const n = VARIANTS[id] ?? 1;
    if (n <= 1) return 0;
    const k = nextTake(n, this.lastTake.get(id) ?? -1, Math.random());
    this.lastTake.set(id, k);
    return k;
  }

  /** Plays one sound effect now. Quietly does nothing before the unlock or when muted. */
  play(id: SoundId, vol = 1, jitter = 0, pan = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted || this.settings.sfx <= 0 || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = THROTTLE[id];
    if (gap !== undefined && now - (this.last.get(id) ?? -1) < gap) return;
    const priority = PRIORITY.has(id);
    if (this.voices >= MAX_VOICES) {
      // A boss warning or a party moment never loses out to a full mix: it takes the oldest ordinary voice.
      const old = priority ? this.ordinary.shift() : undefined;
      if (!old) return;
      try {
        old.stop();
      } catch {
        // Already ended; its onended frees the voice.
      }
    }
    this.last.set(id, now);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(id, this.take(id));
    if (jitter) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
    let node: AudioNode = src;
    if (vol !== 1) {
      const g = ctx.createGain();
      g.gain.value = vol;
      node = src.connect(g);
    }
    // Ordinary sounds lean toward where they happen; a warning always plays in the middle.
    if (pan && !priority && typeof ctx.createStereoPanner === 'function') {
      const sp = ctx.createStereoPanner();
      sp.pan.value = pan;
      node = node.connect(sp);
    }
    node.connect(DRY.has(id) ? this.dry : priority ? this.sfxBus : this.fxBus);
    this.voices++;
    if (priority) this.duck(now, src.buffer.duration, DEEP_DUCK[id] ?? DUCK.gain);
    else this.ordinary.push(src);
    src.onended = () => {
      this.voices--;
      node.disconnect();
      if (!priority) {
        const k = this.ordinary.indexOf(src);
        if (k >= 0) this.ordinary.splice(k, 1);
      }
    };
    src.start(now);
  }

  /** Pulls ordinary sounds (and a little of the music) down while a priority cue plays, so it reads on a phone. */
  private duck(now: number, dur: number, gain: number = DUCK.gain): void {
    const until = Math.max(this.duckUntil, now + Math.min(DUCK.max, dur));
    // A deeper duck still running (DEEP_DUCK) is not raised by a shallower one that starts under it.
    const fx = this.duckUntil > now ? Math.min(gain, this.duckGain) : gain;
    this.duckGain = fx;
    for (const [g, to] of [[this.fxBus.gain, fx], [this.musicDuck.gain, DUCK.music]] as const) {
      g.cancelScheduledValues(now);
      g.setTargetAtTime(to, now, DUCK.attack / 3);
      g.setTargetAtTime(1, until, DUCK.release / 3);
    }
    this.duckUntil = until;
  }

  /** Cues waiting for a telegraph to land, in game time (Cue.after). */
  private later: { at: number; c: Cue }[] = [];

  cue(c: Cue | null): void {
    if (c) this.play(c.id, c.vol ?? 1, c.jitter ?? 0, c.pan ?? 0);
  }

  /** Plays the sounds for one simulation tick's events. */
  events(evs: readonly SimEvent[], ctx: CueContext): void {
    this.haptics.enabled = this.settings.haptics;
    if (this.haptics.supported && this.haptics.enabled) {
      for (const ev of evs) this.haptics.buzz(buzzFor(ev, ctx));
      if (ctx.anvilOnMe && !this.targeted.on) this.haptics.buzz(BUZZ.targeted);
    }
    if (!this.ctx) {
      this.targeted.on = !!ctx.anvilOnMe;
      return;
    }
    // Banked Coals' soak events are told by their ember cues instead (withoutBankedSoaks).
    for (const ev of withoutBankedSoaks(evs)) {
      if (ev.type === 'bossSpawn') this.intensity(1);
      else if (ev.type === 'encounterClear') this.intensity(0);
      // Boss phases push the music further (the raid's march floods at 2 and doubles at 3).
      else if (ev.type === 'phase') this.intensity(ev.phase);
      // The music bows out under the victory or defeat sting; the menu brings the hub theme back.
      else if (ev.type === 'end') this.theme(null);
      const c = cueFor(ev, ctx);
      if (c) this.cue({ ...c, pan: panFor(ev, ctx) });
      const land = landCueFor(ev, ctx.dungeon);
      if (land && ctx.t !== undefined) this.later.push({ at: ctx.t + (land.after ?? 0), c: { ...land, pan: panFor(ev, ctx) } });
    }
    if (this.later.length && ctx.t !== undefined) {
      const t = ctx.t;
      // A new run restarts the clock: drop anything left from the last one.
      this.later = this.later.filter((l) => l.at - t < 10);
      for (const l of this.later) if (l.at <= t) this.cue(l.c);
      this.later = this.later.filter((l) => l.at > t);
    }
    if (ctx.inLava) this.cue({ id: 'lavaSizzle', jitter: 0.08 });
    if (ctx.inRime) this.cue({ id: 'rimeCrackle', jitter: 0.1 });
    this.cue(millCue(ctx));
    // Anvilfall just started winding up on you: a sting on top of the room-wide warning.
    this.cue(targetCue(this.targeted, !!ctx.anvilOnMe));
    this.cue(ebbCue(this.ebbing, !!ctx.ebbPull, !!ctx.outsurge, !!ctx.whirl));
    this.cue(pressedCue(this.pressing, !!ctx.pressed));
    this.cue(spentCue(this.spending, !!ctx.spent));
    this.cue(gazeCues(this.gazing, ctx.gaze));
    this.cue(restCue(this.resting, !!ctx.hallsResting, ctx.hallsPacks));
    this.roomBed(ctx.hallsBed ?? null);
    for (const c of islandCues(this.islanding, ctx.islands ?? [], ctx.myIsland ?? -1)) this.cue(c);
    // The props round the rim give off a quiet sound now and then (not in a boss fight).
    this.cue(edgeCue(this.edging, ctx.dungeon, ctx.t, !!ctx.boss, Math.random, ctx.arenaR ? { listen: ctx.listen, arenaR: ctx.arenaR } : undefined));
    // The 3D room's drips and chains now and then, and foe lunges as they land.
    for (const c of roomCues(this.rooming, ctx.roomSounds, ctx, Math.random)) this.cue(c);
    if (ctx.sets) for (const c of setCues(this.setFlags, ctx.sets)) this.cue(c);
    else this.setFlags = {};
    if (ctx.hp && ctx.hp.length > 1) {
      for (const c of partyCues(this.wasDown, ctx.hp, ctx.acting, ctx.roles)) {
        this.cue(c);
        if (c.id === 'selfDown') this.haptics.buzz(BUZZ.down);
      }
    }
    else this.wasDown.length = 0;
    if (ctx.revive) for (const c of reviveCues(this.reviving, ctx.revive.t, ctx.revive.need, ctx.revive.left)) this.cue(c);
    else this.reviving = { t: [], left: Infinity };
    // The Hoard: swallowed, the mix closes down to the inside of his belly and a heartbeat runs under it.
    const left = ctx.swallowLeft ?? 0;
    const inside = left > 0;
    if (inside !== this.bellyState.on) this.belly.frequency.setTargetAtTime(inside ? BELLY.shut : BELLY.open, this.ctx.currentTime, inside ? 0.05 : 0.25);
    for (const c of bellyCues(this.bellyState, left, this.ctx.currentTime)) this.cue(c);
  }

  /** Switches the music (null for silence). Crossfades from whatever is playing. */
  theme(place: string | null): void {
    // A place without its own theme yet borrows the Kiln's rather than going silent.
    const id: ThemeId | null = place === null ? null : place in THEMES ? (place as ThemeId) : 'kiln';
    if (id !== this.wantTheme) this.wantIntensity = 0;
    // A new place (or the end screen) never stays muffled from a swallow.
    if (this.ctx && this.bellyState.on) {
      this.bellyState.on = false;
      this.belly.frequency.setTargetAtTime(BELLY.open, this.ctx.currentTime, 0.1);
    }
    this.wantTheme = id;
    this.applyTheme();
    // The end screen and the hub have no room: a Halls room bed never outlives its delve.
    if (id === null || id.startsWith('hub')) this.roomBed(null);
  }

  /** Plays the wanted place's song (tracks.ts), or its synth theme when the song can't play. */
  private applyTheme(): void {
    const tr = trackFor(this.wantTheme);
    if (this.tracks && tr && this.tracks.can(tr)) {
      this.music?.play(null);
      this.tracks.play(tr);
    } else {
      this.tracks?.play(null);
      this.music?.play(this.wantTheme);
    }
  }

  /** Halls: the quiet bed of the room the hero stands in (roomBedFor), or null in a corridor, the boss arena or off the map. */
  roomBed(kind: RoomBedKind | null): void {
    this.wantRoomBed = kind;
    this.music?.setRoomBed(kind);
  }

  /** 0 is exploring, 1 is a boss fight (drums and bass join in). */
  intensity(level: number): void {
    this.wantIntensity = level;
    this.music?.setIntensity(level);
  }

  /** Chimes for what a finished run unlocked (achievements, titles, rewards), after the victory or defeat sting. */
  rewards(r: RunRewards | undefined): void {
    for (const c of rewardCues(r)) setTimeout(() => this.play(c.id), c.at * 1000);
    // The loot cards' flicks follow the end screen's deal-in animation, which reduced motion turns off.
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const c of lootCues(r, reduced)) setTimeout(() => this.play(c.id, c.id === 'lootDeal' ? 0.8 : 1, 0.05), c.at * 1000);
  }

  /** The Coldmarrow's Hearthcoal, 1 (full) to 0 (out): its crackle in the music thins as it dims. */
  warmth(level: number): void {
    this.music?.setWarmth(level);
  }
}

export const audio = new AudioEngine();
