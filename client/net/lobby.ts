/**
 * The Quick join lobby: open parties advertise themselves, and a player who
 * presses Quick join takes the best one with a free spot.
 *
 * Supabase Realtime Presence, not a table: the server drops a host's entry by
 * itself when its socket closes, so a crashed tab never leaves a ghost party,
 * and it needs no migration. Protocol per supabase.com/docs/guides/realtime/protocol
 * (phx_join with presence.enabled and a key, then a `presence` push with
 * event track / untrack; the server sends presence_state and presence_diff).
 * Checked live on 2026-11-21: diffs arrive about once a second, and a closed
 * host socket leaves within about 3 s.
 */
import { MAX_PARTY } from './party';

export interface LobbyAd {
  /** Party code a guest joins with. */
  code: string;
  /** Heroes in the party now. */
  n: number;
  max: number;
  /** The host's hero, for the "Joined X's party" line. */
  name: string;
  /** One role per hero in the party (from CLASSES[cls].role via roleOf). Older clients send none. */
  roles?: LobbyRole[];
}

/** What a party needs for group dungeons: a tank, a healer, and damage. */
export type LobbyRole = 'tank' | 'healer' | 'dps';
const ROLES: readonly LobbyRole[] = ['tank', 'healer', 'dps'];

/** A class's lobby role, from its CLASSES role text ('Tank', 'Healer', anything else is damage). */
export function roleOf(classRole: string): LobbyRole {
  const r = classRole.toLowerCase();
  return r === 'tank' ? 'tank' : r === 'healer' ? 'healer' : 'dps';
}

/** Roles a party still lacks, for a "Needs: Healer" line. Damage counts as filled by anyone. */
export function needs(roles: LobbyRole[] = []): LobbyRole[] {
  return (['tank', 'healer'] as const).filter((r) => !roles.includes(r));
}

export interface Lobby {
  /** Resolves once the lobby is reachable. */
  ready: Promise<void>;
  /** Open parties seen right now. */
  list(): LobbyAd[];
  /** Advertise your party (or stop, with null). */
  advertise(ad: LobbyAd | null): void;
  onChange: (() => void) | null;
  close(): void;
}

/** How long a seeker listens before choosing (diffs arrive about once a second). */
export const LISTEN_MS = 2500;
/** Local lobby: an ad is gone if not repeated within this long. */
const LOCAL_TTL = 3000;

/**
 * The party to quick-join: one with a free spot that isn't yours. A tank or
 * healer goes first to a party that lacks their role; then fullest first, so
 * parties fill up instead of everyone sitting in pairs; then by code so two
 * seekers with the same view agree.
 */
export function pickParty(ads: LobbyAd[], mine?: string, role?: LobbyRole): LobbyAd | null {
  const open = ads.filter((a) => a.code !== mine && a.n >= 1 && a.n < Math.min(a.max, MAX_PARTY));
  const wants = (a: LobbyAd) => (role && role !== 'dps' && a.roles && !a.roles.includes(role) ? 1 : 0);
  open.sort((a, b) => wants(b) - wants(a) || b.n - a.n || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return open[0] ?? null;
}

/**
 * A lone quick-join party should fold into another open party: always into one
 * that already has company, and into another lone one only if that one's code
 * is smaller. Both sides apply the same rule, so only one of two lone parties moves.
 */
export function shouldMerge(mine: LobbyAd, ads: LobbyAd[]): LobbyAd | null {
  if (mine.n !== 1) return null;
  return pickParty(ads.filter((a) => a.n > 1 || a.code < mine.code), mine.code);
}

function newKey(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function cleanAd(meta: Record<string, unknown>): LobbyAd | null {
  const { code, n, max, name } = meta;
  if (typeof code !== 'string' || !/^[A-Z0-9]{5}$/.test(code)) return null;
  if (typeof n !== 'number' || typeof max !== 'number') return null;
  // Names come from other players and end up in the party panel's HTML: keep letters, digits, spaces and simple punctuation.
  const safe = typeof name === 'string' ? name.replace(/[^\p{L}\p{N} '.-]/gu, '').slice(0, 40).trim() : '';
  const roles = Array.isArray(meta.roles) ? (meta.roles.filter((r) => ROLES.includes(r as LobbyRole)).slice(0, MAX_PARTY) as LobbyRole[]) : undefined;
  return { code, n, max, name: safe || 'A hero', ...(roles ? { roles } : {}) };
}

/** Same-browser lobby over BroadcastChannel, for tests and two-tab play. */
export function localLobby(): Lobby {
  const ch = new BroadcastChannel('horders-lobby');
  const seen = new Map<string, { ad: LobbyAd; at: number }>();
  let mine: LobbyAd | null = null;
  const send = () => mine && ch.postMessage({ t: 'ad', ad: mine });
  const beat = setInterval(send, 1000);
  const l: Lobby = {
    ready: Promise.resolve(),
    list: () => {
      const now = Date.now();
      for (const [k, v] of seen) if (now - v.at > LOCAL_TTL) seen.delete(k);
      return [...seen.values()].map((v) => v.ad);
    },
    advertise: (ad) => {
      if (!ad && mine) ch.postMessage({ t: 'gone', code: mine.code });
      mine = ad;
      send();
    },
    onChange: null,
    close: () => {
      clearInterval(beat);
      if (mine) ch.postMessage({ t: 'gone', code: mine.code });
      ch.close();
    },
  };
  ch.onmessage = (e) => {
    const m = e.data as { t: string; ad?: Record<string, unknown>; code?: string };
    if (m.t === 'ask') send();
    else if (m.t === 'ad' && m.ad) {
      const ad = cleanAd(m.ad);
      if (ad) seen.set(ad.code, { ad, at: Date.now() });
    } else if (m.t === 'gone' && m.code) seen.delete(m.code);
    l.onChange?.();
  };
  ch.postMessage({ t: 'ask' });
  return l;
}

/** The lobby over Supabase Realtime Presence on one shared channel. */
export function supabaseLobby(projectUrl: string, apiKey: string, timeoutMs = 8000): Lobby {
  const topic = 'realtime:horders-lobby';
  const key = newKey();
  const ws = new WebSocket(`${projectUrl.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(apiKey)}&vsn=1.0.0`);
  const state = new Map<string, LobbyAd>();
  let ref = 0;
  let joined = false;
  let mine: LobbyAd | null = null;
  let beat: ReturnType<typeof setInterval> | null = null;
  const raw = (frame: object) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
  };
  const push = (event: string, payload: object) => raw({ topic, event, payload, ref: String(++ref), join_ref: '1' });
  const track = () => {
    if (!joined) return;
    if (mine) push('presence', { type: 'presence', event: 'track', payload: mine });
    else push('presence', { type: 'presence', event: 'untrack' });
  };
  type Metas = Record<string, { metas: Record<string, unknown>[] }>;
  const apply = (joins: Metas, leaves: Metas) => {
    for (const k of Object.keys(leaves)) state.delete(k);
    for (const k of Object.keys(joins)) {
      const metas = joins[k].metas;
      const ad = metas.length ? cleanAd(metas[metas.length - 1]) : null;
      if (ad && k !== key) state.set(k, ad);
    }
    l.onChange?.();
  };
  const l: Lobby = {
    ready: new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('lobby timeout')), timeoutMs);
      ws.onopen = () => {
        push('phx_join', { config: { broadcast: { ack: false, self: false }, presence: { enabled: true, key }, private: false } });
        beat = setInterval(() => raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), 20000);
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('lobby error')); };
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data)) as { event: string; topic: string; payload: Record<string, unknown> };
        if (m.topic !== topic) return;
        if (m.event === 'phx_reply' && !joined) {
          clearTimeout(timer);
          if ((m.payload as { status?: string }).status !== 'ok') { reject(new Error('lobby refused')); return; }
          joined = true;
          track();
          resolve();
        } else if (m.event === 'presence_state') {
          state.clear();
          apply(m.payload as Metas, {});
        } else if (m.event === 'presence_diff') {
          const p = m.payload as { joins?: Metas; leaves?: Metas };
          // A re-track arrives as leave+join for the same key, so leaves go first.
          apply(p.joins ?? {}, p.leaves ?? {});
        }
      };
    }),
    list: () => [...state.values()],
    advertise: (ad) => {
      const same = JSON.stringify(ad) === JSON.stringify(mine);
      mine = ad;
      if (!same) track();
    },
    onChange: null,
    close: () => {
      if (beat) clearInterval(beat);
      try { ws.close(); } catch { /* already closed */ }
    },
  };
  return l;
}

export function makeLobby(url: string, key: string): Lobby {
  return new URLSearchParams(location.search).has('localparty') ? localLobby() : supabaseLobby(url, key);
}
