/**
 * Co-op parties over direct WebRTC data channels. The host's browser runs the
 * authoritative sim; guests send inputs and draw the host's snapshots. Host
 * authority (rather than lockstep) because Math.sin/cos are only
 * "implementation-approximated" in the JS spec, so two engines can drift.
 *
 * Each link has two channels: `rel` (reliable, ordered) for joins, drafts and
 * run control, and `fast` (unordered, no retransmits) for inputs and
 * snapshots, where a late packet is worse than a lost one.
 */
import { Signal, SignalMsg } from './signal';

export const MAX_PARTY = 4;
/** Public STUN only; no TURN relay, so a few strict networks can't connect. */
export const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type Channel = 'rel' | 'fast';

export interface Member {
  id: string;
  name: string;
  cls: string;
}

export interface PartyEvents {
  /** A peer's channels are both open (host: a guest joined; guest: linked to host). */
  onJoin?: (m: Member) => void;
  onLeave?: (id: string) => void;
  onMessage?: (from: string, ch: Channel, data: unknown) => void;
  /** Guest only: the host refused (party full). */
  onRefused?: (reason: string) => void;
}

interface Link {
  member: Member;
  pc: RTCPeerConnection;
  rel?: RTCDataChannel;
  fast?: RTCDataChannel;
  open: boolean;
  pendingIce: RTCIceCandidateInit[];
}

export function partyCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return s;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class Party {
  readonly id = newId();
  readonly links = new Map<string, Link>();
  closed = false;
  private hostId: string | null = null;

  constructor(
    readonly signal: Signal,
    readonly role: 'host' | 'guest',
    readonly me: Omit<Member, 'id'>,
    readonly events: PartyEvents = {},
    private readonly iceServers: RTCIceServer[] = ICE_SERVERS,
  ) {
    signal.onMessage = (m) => void this.onSignal(m);
  }

  /** Members with open channels, not counting yourself. */
  get members(): Member[] {
    return [...this.links.values()].filter((l) => l.open).map((l) => l.member);
  }

  async start(): Promise<void> {
    await this.signal.ready;
    if (this.role === 'guest') this.signal.send({ t: 'hello', from: this.id, name: this.me.name, cls: this.me.cls });
  }

  send(to: string, ch: Channel, data: unknown): boolean {
    const l = this.links.get(to);
    const dc = l && (ch === 'rel' ? l.rel : l.fast);
    if (!dc || dc.readyState !== 'open') return false;
    dc.send(JSON.stringify(data));
    return true;
  }

  /** Host: to every guest. Guest: to the host. */
  broadcast(ch: Channel, data: unknown): void {
    for (const id of this.links.keys()) this.send(id, ch, data);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.signal.send({ t: 'bye', from: this.id });
    for (const l of this.links.values()) l.pc.close();
    this.links.clear();
    this.signal.close();
  }

  private async onSignal(m: SignalMsg): Promise<void> {
    if (this.closed || m.from === this.id || (m.to && m.to !== this.id)) return;
    if (m.t === 'bye') return this.drop(m.from);
    if (this.role === 'host') {
      if (m.t === 'hello') return this.acceptGuest(m);
    } else {
      if (m.t === 'full') { this.events.onRefused?.('full'); return; }
      if (m.t === 'offer' && !this.hostId) return this.answerHost(m);
    }
    const l = this.links.get(m.from);
    if (!l) return;
    if (m.t === 'answer') {
      await l.pc.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
      for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c);
    } else if (m.t === 'ice') {
      if (l.pc.remoteDescription) await l.pc.addIceCandidate(m.cand as RTCIceCandidateInit);
      else l.pendingIce.push(m.cand as RTCIceCandidateInit);
    }
  }

  private link(member: Member): Link {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const l: Link = { member, pc, open: false, pendingIce: [] };
    this.links.set(member.id, l);
    pc.onicecandidate = (e) => { if (e.candidate) this.signal.send({ t: 'ice', from: this.id, to: member.id, cand: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.drop(member.id); };
    return l;
  }

  private wire(l: Link, dc: RTCDataChannel): void {
    if (dc.label === 'rel') l.rel = dc; else l.fast = dc;
    dc.onmessage = (e) => this.events.onMessage?.(l.member.id, dc.label as Channel, JSON.parse(String(e.data)));
    dc.onopen = () => {
      if (!l.open && l.rel?.readyState === 'open' && l.fast?.readyState === 'open') {
        l.open = true;
        this.events.onJoin?.(l.member);
      }
    };
    dc.onclose = () => this.drop(l.member.id);
  }

  private async acceptGuest(m: SignalMsg): Promise<void> {
    if (this.links.has(m.from)) return;
    if (this.links.size + 1 >= MAX_PARTY) { this.signal.send({ t: 'full', from: this.id, to: m.from }); return; }
    const l = this.link({ id: m.from, name: String(m.name ?? 'Hero'), cls: String(m.cls ?? 'emberwright') });
    this.wire(l, l.pc.createDataChannel('rel', { ordered: true }));
    this.wire(l, l.pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }));
    await l.pc.setLocalDescription(await l.pc.createOffer());
    this.signal.send({ t: 'offer', from: this.id, to: m.from, sdp: l.pc.localDescription!.toJSON(), name: this.me.name, cls: this.me.cls });
  }

  private async answerHost(m: SignalMsg): Promise<void> {
    this.hostId = m.from;
    const l = this.link({ id: m.from, name: String(m.name ?? 'Host'), cls: String(m.cls ?? 'emberwright') });
    l.pc.ondatachannel = (e) => this.wire(l, e.channel);
    await l.pc.setRemoteDescription(m.sdp as RTCSessionDescriptionInit);
    for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c);
    await l.pc.setLocalDescription(await l.pc.createAnswer());
    this.signal.send({ t: 'answer', from: this.id, to: m.from, sdp: l.pc.localDescription!.toJSON() });
  }

  private drop(id: string): void {
    const l = this.links.get(id);
    if (!l) return;
    this.links.delete(id);
    l.pc.close();
    if (l.open) this.events.onLeave?.(id);
    if (id === this.hostId) this.hostId = null;
  }
}
