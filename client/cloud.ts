/**
 * Online features: cloud hero saves and the shared world boss, on Supabase.
 *
 * Players sign in anonymously (no account or password); the session lives in
 * browser storage. The page only holds the publishable key, which is safe to
 * ship: every table has row level security and the boss changes only through
 * server functions that clamp what a run can claim.
 *
 * Every call fails soft. When the backend can't be reached (offline, or a host
 * like a claude.ai page that blocks outside requests) the game keeps working
 * on its local save and the hub says the world boss is offline.
 */
import { HeroProfile } from '../sim/hero';

const URL_BASE = 'https://gadnkjsxpnchmvsjgnum.supabase.co';
const KEY = 'sb_publishable_dNWKvm5ECZJiG90XkAwveA_J_1tdRKB';
/** For co-op signalling (client/net/signal.ts): the same public project and publishable key. */
export const SUPABASE = { url: URL_BASE, key: KEY };
const SESSION_KEY = 'horders.auth.v1';
const TIMEOUT_MS = 6000;

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // seconds since epoch
  user_id: string;
}

export interface BossStatus {
  id: number;
  name: string;
  title: string;
  hp: number;
  max_hp: number;
  /** OmenId the boss adds to every delve while it lives (null on old servers). */
  omen?: string | null;
  fighters: number;
  my_damage: number;
  unclaimed: { boss_id: number; name: string; damage: number; max_hp: number }[];
}

export interface StrikeResult {
  ok: boolean;
  reason?: string;
  name?: string;
  dealt?: number;
  /** The shadow fight's share of `dealt`, already tripled. */
  shadow?: number;
  hp: number;
  max_hp: number;
  defeated?: boolean;
}

let session: Session | null = readSession();
let online: boolean | null = null; // null until the first call settles

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null): void {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // The session then lasts only for this page load.
  }
}

async function request(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers: Record<string, string> = { apikey: KEY, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (auth && session) headers.Authorization = `Bearer ${session.access_token}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL_BASE + path, { ...init, headers, signal: ctl.signal });
    online = true;
    return res;
  } catch (e) {
    online = false;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function fromAuth(body: { access_token: string; refresh_token: string; expires_in: number; user: { id: string } }): Session {
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + body.expires_in,
    user_id: body.user.id,
  };
}

/** Signs in (anonymously the first time) and keeps the token fresh. */
async function ensureSession(): Promise<Session | null> {
  try {
    if (session && session.expires_at - 60 > Date.now() / 1000) return session;
    if (session?.refresh_token) {
      const res = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }),
      }, false);
      if (res.ok) {
        writeSession(fromAuth(await res.json()));
        return session;
      }
      // A dead refresh token means a new anonymous player; the local save carries over.
      writeSession(null);
    }
    const res = await request('/auth/v1/signup', { method: 'POST', body: '{}' }, false);
    if (!res.ok) return null;
    writeSession(fromAuth(await res.json()));
    return session;
  } catch {
    return null;
  }
}

async function rpc<T>(fn: string, args: object, needAuth = true): Promise<T | null> {
  try {
    if (needAuth && !(await ensureSession())) return null;
    const res = await request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }, needAuth || !!session);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const cloud = {
  /** false once a request has failed to reach the server. */
  get online(): boolean | null {
    return online;
  },

  async loadHero(): Promise<HeroProfile | null> {
    try {
      if (!(await ensureSession())) return null;
      const res = await request('/rest/v1/hero_saves?select=hero');
      if (!res.ok) return null;
      const rows = (await res.json()) as { hero: HeroProfile }[];
      return rows[0]?.hero ?? null;
    } catch {
      return null;
    }
  },

  async saveHero(hero: HeroProfile): Promise<boolean> {
    try {
      const s = await ensureSession();
      if (!s) return false;
      const res = await request('/rest/v1/hero_saves?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: s.user_id, hero, updated_at: new Date().toISOString() }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  bossStatus(): Promise<BossStatus | null> {
    return rpc<BossStatus>('world_boss_status', {}, !!session);
  },

  strike(damage: number, seconds: number, shadowDamage = 0, shadowSeconds = 0): Promise<StrikeResult | null> {
    return rpc<StrikeResult>('strike_world_boss', {
      p_damage: Math.round(damage), p_seconds: Math.round(seconds),
      p_shadow_damage: Math.round(shadowDamage), p_shadow_seconds: Math.round(shadowSeconds),
    });
  },

  claim(bossId: number): Promise<{ ok: boolean; damage?: number; name?: string } | null> {
    return rpc('claim_world_boss_reward', { p_boss_id: bossId });
  },

  /** Delver's Keys: report a beaten key (supabase/migrations/0004). Null when offline or before the migration. */
  submitKey(dungeon: string, cls: string, level: number, seconds: number, week: number, name: string): Promise<KeySubmit | null> {
    return rpc<KeySubmit>('submit_key', {
      p_dungeon: dungeon, p_cls: cls, p_level: Math.round(level), p_seconds: Math.round(seconds), p_week: Math.round(week), p_name: name,
    });
  },

  /** The top keys for a dungeon, and your own row once you have one. */
  topKeys(dungeon: string, limit = 10): Promise<KeyBoard | null> {
    return rpc<KeyBoard>('top_keys', { p_dungeon: dungeon, p_limit: limit }, !!session);
  },
};

export interface KeyRow { rank: number; name: string; cls: string; level: number; seconds: number }
/** `season` (a season id, seasonOf) comes from migration 0005; before it the board is all-time and has none. */
export interface KeyBoard { dungeon: string; season?: number; top: KeyRow[]; me: KeyRow | null }
export interface KeySubmit { ok: boolean; reason?: 'too_soon' | 'bad_input'; best?: boolean; level?: number; seconds?: number; clamped?: boolean; rank?: number }

/** Coalesces rapid saves (equip, salvage, talent clicks) into one upload. */
let pending: ReturnType<typeof setTimeout> | null = null;
export function queueCloudSave(hero: () => HeroProfile, delayMs = 1500): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    void cloud.saveHero(hero());
  }, delayMs);
}
