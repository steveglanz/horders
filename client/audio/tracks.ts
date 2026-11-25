/**
 * Recorded music (Steve, 25 Nov 2026: "The music sounds pretty bad ... I used Suno to create an epic song"). Two Suno
 * songs he made take over from the synthesized themes (music.ts): one in the hub, one in every delve. The synth theme
 * only plays when a song can't (it failed to load, or the browser has no audio element).
 *
 * Phones: one <audio> element, unlocked inside the first tap, plays every song in turn (iOS lets a blessed element
 * change its source and play again later without a tap). It is routed through the music bus, so the music slider,
 * mute and the warning duck work on it as on the synth. Each file is AAC at 96 kb/s, about 2.5 MB, streamed (never
 * decoded whole into memory).
 */
import type { ThemeId } from './music';

export type TrackId = 'hub' | 'delve';

export interface Track {
  /** Path next to index.html (client/public/music, copied into dist/music by the build). */
  src: string;
  /** The song's title, as Steve named it in Suno. */
  title: string;
}

export const TRACKS: Record<TrackId, Track> = {
  hub: { src: 'music/shadow-of-the-digital-dragon.m4a', title: 'Shadow of the Digital Dragon' },
  delve: { src: 'music/shadow-protocol.m4a', title: 'Shadow Protocol' },
};

/**
 * The songs' level on the music bus, matched by loudness (EBU R128) to the synth themes they replace: the songs measure
 * -15.3 / -15.2 LUFS, the hub and Kiln themes -17.0 / -18.9 LUFS before the bus, so 0.7 (-3.1 dB) sits them between.
 */
export const TRACK_VOL = 0.7;
/** Seconds to fade a song out before the next one starts. */
export const TRACK_FADE = 0.8;

/** Which song plays for a synth theme: the hub's in the hub (every season), the delve's in every dungeon and raid. */
export function trackFor(theme: ThemeId | null): TrackId | null {
  if (!theme) return null;
  return theme.startsWith('hub') ? 'hub' : 'delve';
}

/** 0.1 s of silent 8 kHz mono WAV, to unlock the element in the first tap. */
const SILENCE = (() => {
  const n = 800, buf = new Uint8Array(44 + n);
  const v = new DataView(buf.buffer);
  const str = (o: number, x: string) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true); buf.fill(128, 44);
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...buf));
})();

export class TrackPlayer {
  private el: HTMLAudioElement;
  private gain: GainNode;
  private want: TrackId | null = null;
  private playing: TrackId | null = null;
  private failed = new Set<TrackId>();
  private swap: ReturnType<typeof setTimeout> | null = null;

  /** `onFail` is told when a song can't play, so the synth theme can stand in for it. */
  constructor(private ctx: AudioContext, dest: AudioNode, private onFail: (id: TrackId) => void) {
    this.el = new Audio();
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.crossOrigin = 'anonymous';
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    ctx.createMediaElementSource(this.el).connect(this.gain).connect(dest);
    this.el.addEventListener('error', () => {
      const id = this.playing;
      if (!id) return;
      this.failed.add(id);
      this.playing = null;
      if (this.want === id) this.onFail(id);
    });
    // Inside the first tap: playing a moment of silence unlocks the element for every later song (iOS Safari, Chrome
    // on Android only let an element play without a tap once it has played inside one).
    this.el.src = SILENCE;
    void this.el.play().then(() => { if (!this.playing) this.el.pause(); }, () => undefined);
  }

  /** Whether this song can play (it hasn't failed to load). */
  can(id: TrackId): boolean {
    return !this.failed.has(id);
  }

  /** The song that should be playing now (null: none). Fades the last one out first. */
  play(id: TrackId | null): void {
    if (id === this.want) return;
    this.want = id;
    if (this.swap) clearTimeout(this.swap);
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(0, t + TRACK_FADE);
    // Nothing playing yet: start now, still inside the tap that called us if there was one.
    if (!this.playing) this.start();
    else this.swap = setTimeout(() => this.start(), TRACK_FADE * 1000);
  }

  private start(): void {
    this.swap = null;
    const id = this.want;
    if (!id || this.failed.has(id)) {
      this.el.pause();
      this.playing = null;
      return;
    }
    if (this.playing !== id) {
      this.el.src = TRACKS[id].src;
      this.playing = id;
    }
    void this.el.play().catch(() => undefined);
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(0, t);
    this.gain.gain.linearRampToValueAtTime(TRACK_VOL, t + 1.2);
  }

  /** The tab went to the background (or came back): pause the element so a phone isn't kept playing. */
  hold(hidden: boolean): void {
    if (hidden) this.el.pause();
    else if (this.playing) void this.el.play().catch(() => undefined);
  }
}
