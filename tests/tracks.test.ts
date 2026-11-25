import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { HUB_BY_SEASON, THEMES, type ThemeId } from '../client/audio/music';
import { TRACK_VOL, TRACKS, trackFor } from '../client/audio/tracks';

describe("Steve's Suno songs as the music (25 Nov)", () => {
  it('the hub plays Shadow of the Digital Dragon in every season; every delve and raid plays Shadow Protocol', () => {
    for (const id of HUB_BY_SEASON) if (id) expect(trackFor(id)).toBe('hub');
    for (const id of Object.keys(THEMES) as ThemeId[]) expect(trackFor(id)).toBe(id.startsWith('hub') ? 'hub' : 'delve');
    expect(trackFor(null)).toBeNull();
    expect(TRACKS.hub.title).toBe('Shadow of the Digital Dragon');
    expect(TRACKS.delve.title).toBe('Shadow Protocol');
  });

  it('each song ships as a phone-sized AAC file next to the page', () => {
    for (const t of Object.values(TRACKS)) {
      const path = `client/public/${t.src}`;
      expect(statSync(path).size, t.src).toBeLessThan(3_000_000);
      const head = readFileSync(path).subarray(0, 4096).toString('latin1');
      // An MP4 audio file (ftyp M4A/isom) whose sample entry is AAC: every phone browser plays it.
      expect(head.slice(4, 8)).toBe('ftyp');
      expect(readFileSync(path).toString('latin1')).toContain('mp4a');
    }
  });

  it('a song stands in for the synth theme, which only plays when the song cannot', () => {
    const src = readFileSync('client/audio/index.ts', 'utf8');
    expect(src).toContain('if (this.tracks && tr && this.tracks.can(tr)) {');
    expect(src).toContain('this.music?.play(null);');
    expect(src).toContain('this.music?.play(this.wantTheme);');
    // theme() goes through the same choice, and a song that fails to load hands back to the synth.
    expect(src).toContain('new TrackPlayer(ctx, this.musicBus, () => this.applyTheme())');
    expect(TRACK_VOL).toBeGreaterThan(0.3);
    expect(TRACK_VOL).toBeLessThanOrEqual(1);
  });
});
