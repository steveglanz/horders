/**
 * Signalling: the tiny channel two browsers use to find each other before a
 * direct WebRTC connection exists. Only the handshake goes through here (a few
 * dozen messages per party), never game traffic, because the Supabase free
 * plan allows 2M Realtime messages a month and 100 a second for the whole
 * project (docs: supabase.com/docs/guides/realtime/limits).
 */

export interface SignalMsg {
  t: 'hello' | 'offer' | 'answer' | 'ice' | 'full' | 'bye';
  from: string;
  to?: string;
  [k: string]: unknown;
}

export interface Signal {
  /** Resolves once joined; rejects if the room can't be reached. */
  ready: Promise<void>;
  send(msg: SignalMsg): void;
  onMessage: ((msg: SignalMsg) => void) | null;
  close(): void;
}

/** Same-browser signalling over BroadcastChannel, for tests and two-tab play. */
export function localSignal(room: string): Signal {
  const ch = new BroadcastChannel('horders-party-' + room);
  const s: Signal = {
    ready: Promise.resolve(),
    send: (msg) => ch.postMessage(msg),
    onMessage: null,
    close: () => ch.close(),
  };
  ch.onmessage = (e) => s.onMessage?.(e.data as SignalMsg);
  return s;
}

/**
 * Supabase Realtime Broadcast over a raw WebSocket (protocol 1.0.0, JSON text
 * frames), following supabase.com/docs/guides/realtime/protocol: join with
 * phx_join, send `broadcast` events, heartbeat on topic `phoenix` at least
 * every 25 s. No client library, to keep the single-file build small.
 */
export function supabaseSignal(projectUrl: string, apiKey: string, room: string, timeoutMs = 8000): Signal {
  const topic = 'realtime:horders-party-' + room;
  const ws = new WebSocket(`${projectUrl.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(apiKey)}&vsn=1.0.0`);
  let ref = 0;
  const joinRef = '1';
  const out: string[] = [];
  let joined = false;
  let beat: ReturnType<typeof setInterval> | null = null;
  const push = (event: string, payload: object, withJoin = true) => {
    const frame = JSON.stringify({ topic: event === 'heartbeat' ? 'phoenix' : topic, event, payload, ref: String(++ref), ...(withJoin ? { join_ref: joinRef } : {}) });
    if (joined || event === 'phx_join' || event === 'heartbeat') ws.readyState === WebSocket.OPEN ? ws.send(frame) : out.push(frame);
    else out.push(frame);
  };
  const s: Signal = {
    ready: new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('signal timeout')), timeoutMs);
      ws.onopen = () => {
        push('phx_join', { config: { broadcast: { ack: false, self: false }, presence: { enabled: false }, private: false } });
        beat = setInterval(() => push('heartbeat', {}, false), 20000);
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('signal error')); };
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data)) as { event: string; topic: string; payload: { status?: string; event?: string; payload?: SignalMsg } };
        if (m.event === 'phx_reply' && m.topic === topic && !joined) {
          if (m.payload.status !== 'ok') { clearTimeout(timer); reject(new Error('join refused')); return; }
          joined = true;
          clearTimeout(timer);
          for (const f of out.splice(0)) ws.send(f);
          resolve();
        } else if (m.event === 'broadcast' && m.topic === topic && m.payload.payload) {
          s.onMessage?.(m.payload.payload);
        }
      };
    }),
    send: (msg) => push('broadcast', { type: 'broadcast', event: 'signal', payload: msg }),
    onMessage: null,
    close: () => {
      if (beat) clearInterval(beat);
      try { ws.close(); } catch { /* already closed */ }
    },
  };
  return s;
}
