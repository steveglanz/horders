/**
 * The Horders audio engine: sound effects, music and the sound settings.
 *
 * Mobile browsers only allow audio after a tap, so nothing is created until
 * the first pointer or key press; calls before that are ignored (music
 * requests are remembered and start on the unlock). Settings live in
 * localStorage. The game keeps running fine if WebAudio is missing.
 */
import { render } from './synth';
import { SOUNDS, SoundId } from './sounds';
import { MusicPlayer, ThemeId, THEMES } from './music';
import { Cue, CueContext, cueFor, partyCues, targetCue, THROTTLE } from './cues';
import type { SimEvent } from '../../sim/world';
import { buzzFor, BUZZ, Haptics } from './haptics';
import { uiSoundFor } from './ui';

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
  private musicBus!: GainNode;
  private music: MusicPlayer | null = null;
  private buffers = new Map<SoundId, AudioBuffer>();
  private last = new Map<SoundId, number>();
  private voices = 0;
  private wantTheme: ThemeId | null = null;
  private wantIntensity = 0;
  private listeners = new Set<() => void>();
  private wasDown: boolean[] = [];
  private targeted = { on: false };
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
      this.master.connect(floor).connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.music = new MusicPlayer(ctx, this.musicBus);
      this.applySettings();
      // iOS: playing a silent buffer inside the tap fully wakes the output.
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination);
      silent.start(0);
      this.music.play(this.wantTheme);
      this.music.setIntensity(this.wantIntensity);
      // Build the sounds a few at a time in the background, combat sounds
      // first, so the first hit or level-up never waits on a render.
      const order = Object.keys(SOUNDS) as SoundId[];
      let k = 0;
      // When the browser can tell us it is idle, render in idle time only.
      const idle = (window as unknown as { requestIdleCallback?: (f: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => void }).requestIdleCallback;
      const warm = (d?: { timeRemaining(): number }) => {
        do {
          if (k >= order.length) return;
          this.buffer(order[k++]);
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

  private buffer(id: SoundId): AudioBuffer {
    let b = this.buffers.get(id);
    if (!b) {
      const ctx = this.ctx!;
      const data = render(SOUNDS[id], SFX_RATE, id.length);
      b = ctx.createBuffer(1, data.length, SFX_RATE);
      b.getChannelData(0).set(data);
      this.buffers.set(id, b);
    }
    return b;
  }

  /** Plays one sound effect now. Quietly does nothing before the unlock or when muted. */
  play(id: SoundId, vol = 1, jitter = 0): void {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted || this.settings.sfx <= 0 || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = THROTTLE[id];
    if (gap !== undefined && now - (this.last.get(id) ?? -1) < gap) return;
    if (this.voices >= MAX_VOICES) return;
    this.last.set(id, now);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(id);
    if (jitter) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
    let node: AudioNode = src;
    if (vol !== 1) {
      const g = ctx.createGain();
      g.gain.value = vol;
      node = src.connect(g);
    }
    node.connect(this.sfxBus);
    this.voices++;
    src.onended = () => {
      this.voices--;
      node.disconnect();
    };
    src.start(now);
  }

  cue(c: Cue | null): void {
    if (c) this.play(c.id, c.vol ?? 1, c.jitter ?? 0);
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
    for (const ev of evs) {
      if (ev.type === 'bossSpawn') this.intensity(1);
      else if (ev.type === 'encounterClear') this.intensity(0);
      // The music bows out under the victory or defeat sting; the menu brings the hub theme back.
      else if (ev.type === 'end') this.theme(null);
      this.cue(cueFor(ev, ctx));
    }
    // Anvilfall just started winding up on you: a sting on top of the room-wide warning.
    this.cue(targetCue(this.targeted, !!ctx.anvilOnMe));
    if (ctx.hp && ctx.hp.length > 1) {
      for (const c of partyCues(this.wasDown, ctx.hp, ctx.acting)) {
        this.cue(c);
        if (c.id === 'selfDown') this.haptics.buzz(BUZZ.down);
      }
    }
    else this.wasDown.length = 0;
  }

  /** Switches the music (null for silence). Crossfades from whatever is playing. */
  theme(place: string | null): void {
    // A place without its own theme yet borrows the Kiln's rather than going silent.
    const id: ThemeId | null = place === null ? null : place in THEMES ? (place as ThemeId) : 'kiln';
    if (id !== this.wantTheme) this.wantIntensity = 0;
    this.wantTheme = id;
    this.music?.play(id);
  }

  /** 0 is exploring, 1 is a boss fight (drums and bass join in). */
  intensity(level: number): void {
    this.wantIntensity = level;
    this.music?.setIntensity(level);
  }
}

export const audio = new AudioEngine();
