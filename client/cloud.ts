/**
 * Online features: cloud hero saves and the shared world boss, on Supabase.
 *
 * Players sign in anonymously (no account or password); the session lives in
 * browser storage. Every storage area is its own player: a browser, an iPhone
 * Home Screen web app (WebKit keeps its storage apart from Safari, webkit.org
 * bug 181849) and the store app. A link code (migration 0009) joins two of them
 * to one cloud save. The page only holds the publishable key, which is safe to
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
/** Whether the server has link codes (supabase/migrations/0009); null until a save call settles. */
let linkable: boolean | null = null;

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

  /** false when the server is too old for link codes (before migration 0009). */
  get linkable(): boolean | null {
    return linkable;
  },

  /**
   * This place's hero, or the linked save's hero once a link code joined it to another place.
   * Falls back to the plain hero_saves row on a server from before migration 0009.
   */
  async loadHero(): Promise<HeroProfile | null> {
    try {
      if (!(await ensureSession())) return null;
      if (linkable !== false) {
        const res = await request('/rest/v1/rpc/load_save', { method: 'POST', body: '{}' });
        if (res.ok) {
          linkable = true;
          return ((await res.json()) as { hero: HeroProfile | null }).hero ?? null;
        }
        if (res.status !== 404) return null;
        linkable = false;
      }
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
      if (linkable !== false) {
        const res = await request('/rest/v1/rpc/store_save', { method: 'POST', body: JSON.stringify({ p_hero: hero }) });
        if (res.ok) {
          linkable = true;
          return !!((await res.json()) as { ok?: boolean }).ok;
        }
        if (res.status !== 404) return false;
        linkable = false;
      }
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

  /** A one-use code (15 minutes) another place types to share this hero. Null when offline or before 0009. */
  makeLinkCode(): Promise<{ ok: boolean; code: string; expires_in: number } | null> {
    return rpc('make_link_code', {});
  },

  /**
   * Joins this place to the save a link code came from and returns that save's hero
   * (null hero when the other place never saved). Null when offline or before 0009.
   */
  redeemLinkCode(code: string): Promise<{ ok: boolean; reason?: 'bad_code'; same?: boolean; hero?: HeroProfile | null } | null> {
    return rpc('redeem_link_code', { p_code: code });
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

  /** Daily bounty (supabase/migrations/0006): report a bounty win's time. Null when offline or before the migration. */
  submitBounty(day: number, tier: number, dungeon: string, cls: string, seconds: number, name: string): Promise<BountySubmit | null> {
    return rpc<BountySubmit>('submit_bounty', {
      p_day: Math.round(day), p_tier: Math.round(tier), p_dungeon: dungeon, p_cls: cls, p_seconds: Math.round(seconds), p_name: name,
    });
  },

  /** Today's fastest bounty clears at a tier, and your own row once you have one. */
  topBounty(tier: number, limit = 5): Promise<BountyBoard | null> {
    return rpc<BountyBoard>('top_bounty', { p_tier: tier, p_limit: limit }, !!session);
  },

  /**
   * Delete my account (supabase/migrations/0008, links since 0009): removes this player's auth user,
   * cloud save, links, world boss strikes and leaderboard rows on the server, then forgets the session
   * here. Places linked to this hero keep their own copy and save on their own again.
   * True when nothing is left on the server (also when this browser never signed in).
   */
  async deleteAccount(): Promise<boolean> {
    if (!session) return true;
    const r = await rpc<{ ok: boolean }>('delete_my_account', {});
    if (!r?.ok) return false;
    writeSession(null);
    return true;
  },

  /** The top keys for a dungeon, and your own row once you have one. */
  topKeys(dungeon: string, limit = 10): Promise<KeyBoard | null> {
    return rpc<KeyBoard>('top_keys', { p_dungeon: dungeon, p_limit: limit }, !!session);
  },
};

export interface BountyRow { rank: number; name: string; cls: string; seconds: number }
export interface BountyBoard { day: number; tier: number; top: BountyRow[]; me: BountyRow | null }
export interface BountySubmit { ok: boolean; reason?: 'too_soon' | 'bad_input' | 'wrong_day'; best?: boolean; seconds?: number; rank?: number }
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
