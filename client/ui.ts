/** HTML overlay: HUD, talent drafts, banners, menus and the touch joystick. */
import { World, BOSS_AT, MINI_BOSS_AT } from '../sim/world';
import { BRANCH_NAMES, CAPSTONE_RANKS, TALENTS, TalentId } from '../sim/content/emberwright';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const BRANCH_COLOR: Record<string, string> = {
  wildfire: '#ff7a2f',
  kindling: '#ffc861',
  ashguard: '#9db7d8',
  general: '#c9b8a8',
};

export interface RunHandlers {
  onPick: (i: number) => void;
  onPause: () => void;
  onStick: (x: number, y: number) => void;
}

function fmt(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private handlers?: RunHandlers;
  private lastTick = 0;
  private draftShownFor = -1;
  private bannerTimer = 0;
  showPerf = false;

  constructor() {
    $('pauseBtn').addEventListener('click', () => this.handlers?.onPause());
    $('resumeBtn').addEventListener('click', () => this.handlers?.onPause());
    this.setupStick();
  }

  bindRun(h: RunHandlers): void {
    this.handlers = h;
  }

  showRun(w: World): void {
    $('title').hidden = true;
    $('end').hidden = true;
    $('pause').hidden = true;
    $('draft').hidden = true;
    $('hud').hidden = false;
    $('bossbar').hidden = true;
    $('perf').hidden = !this.showPerf;
    this.draftShownFor = -1;
    this.tick(w, { avg: 0, p95ms: 0 }, true);
  }

  tick(w: World, fps: { avg: number; p95ms: number }, force = false): void {
    const now = performance.now();
    if (!force && now - this.lastTick < 100) return;
    this.lastTick = now;
    const p = w.player;
    $('hpFill').style.width = `${(100 * Math.max(0, p.hp)) / p.maxHp}%`;
    $('hpText').textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`;
    $('xpFill').style.width = `${(100 * p.xp) / p.xpToNext}%`;
    $('level').textContent = String(p.level);
    $('timer').textContent = fmt(w.time);
    $('kills').textContent = String(w.kills);
    let next = '';
    if (w.stress) next = 'Stress test';
    else if (!w.eliteSpawned) next = `Brute in ${fmt(MINI_BOSS_AT - w.time)}`;
    else if (!w.bossSpawned) next = `Boss in ${fmt(BOSS_AT - w.time)}`;
    else next = w.bossEnraged ? 'Boss enraged!' : 'Boss fight';
    $('next').textContent = next;

    const boss = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    if (boss && boss.alive && boss.def.rank === 'boss') {
      $('bossbar').hidden = false;
      $('bossFill').style.width = `${(100 * Math.max(0, boss.hp)) / boss.maxHp}%`;
    } else $('bossbar').hidden = true;

    if (this.showPerf) {
      $('perf').textContent = `${fps.avg.toFixed(0)} fps · p95 ${fps.p95ms.toFixed(1)} ms · ${w.aliveEnemies} enemies`;
    }
    if (this.bannerTimer && now > this.bannerTimer) {
      $('banner').classList.remove('show');
      this.bannerTimer = 0;
    }
  }

  showDraft(w: World): void {
    // Re-render only when a new set of choices appears.
    const key = w.player.level * 100 + w.player.pendingLevels;
    if (!$('draft').hidden && this.draftShownFor === key) return;
    this.draftShownFor = key;
    const cards = $('cards');
    cards.innerHTML = '';
    w.choices.forEach((c, i) => {
      const def = TALENTS[c.id as TalentId];
      const color = BRANCH_COLOR[def.branch];
      const btn = document.createElement('button');
      btn.className = 'card' + (def.capstone ? ' capstone' : '');
      btn.style.setProperty('--branch', color);
      let progress = '';
      if (def.branch !== 'general' && !def.capstone) {
        const have = Math.min(CAPSTONE_RANKS, w.branchRanks(def.branch) + 1);
        progress = `<div class="progress">${BRANCH_NAMES[def.branch]} ${have}/${CAPSTONE_RANKS} toward capstone</div>`;
      }
      const rank = def.maxRank < 99 ? `Rank ${c.nextRank} of ${def.maxRank}` : '';
      btn.innerHTML = `<div class="key">${i + 1}</div><div class="branch">${BRANCH_NAMES[def.branch]}</div><div class="name">${def.name}</div><div class="text">${def.text}</div><div class="rank">${rank}</div>${progress}`;
      btn.addEventListener('click', () => this.handlers?.onPick(i));
      cards.appendChild(btn);
    });
    $('draftTitle').textContent = w.player.pendingLevels > 1 ? `Level up! (${w.player.pendingLevels} picks)` : 'Level up!';
    $('draft').hidden = false;
  }

  hideDraft(): void {
    $('draft').hidden = true;
    this.draftShownFor = -1;
  }

  setPaused(p: boolean): void {
    $('pause').hidden = !p;
  }

  banner(title: string, sub: string): void {
    $('bannerTitle').textContent = title;
    $('bannerSub').textContent = sub;
    $('banner').classList.add('show');
    this.bannerTimer = performance.now() + 3200;
  }

  showEnd(w: World): void {
    const s = w.summary();
    $('draft').hidden = true;
    $('bossbar').hidden = true;
    $('endTitle').textContent = s.victory ? 'Victory' : 'The Tide took you';
    $('endSub').textContent = s.victory
      ? 'Smolderhusk falls. Emberhold will sing of this.'
      : w.bossSpawned
        ? 'So close. The Kiln Mother still burns.'
        : 'Every delve makes you stronger. Try another build.';
    $('stats').innerHTML = [
      ['Time', fmt(s.time)],
      ['Level', String(s.level)],
      ['Kills', String(s.kills)],
      ['Damage', s.damageDealt.toLocaleString()],
    ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    $('endTalents').innerHTML = (Object.keys(s.talents) as TalentId[])
      .map((id) => {
        const def = TALENTS[id];
        return `<span class="chip" style="--branch:${BRANCH_COLOR[def.branch]}">${def.name}${def.maxRank > 1 && def.maxRank < 99 ? ' ' + s.talents[id] : def.maxRank >= 99 ? ' x' + s.talents[id] : ''}</span>`;
      })
      .join('') || '<span class="muted">No talents taken</span>';
    $('end').hidden = false;
  }

  private setupStick(): void {
    const zone = $('touch');
    const base = $('stickBase');
    const knob = $('stickKnob');
    let id: number | null = null;
    let ox = 0;
    let oy = 0;
    const R = 56;
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      base.style.left = `${ox}px`;
      base.style.top = `${oy}px`;
      knob.style.transform = 'translate(-50%, -50%)';
      base.hidden = false;
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox;
      let dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Past 30% deflection the hero runs at full speed; below it, walks.
      const mag = Math.min(1, d / R);
      if (d < 4) this.handlers?.onStick(0, 0);
      else {
        const k = mag > 0.3 ? 1 / R / mag : 1 / R;
        this.handlers?.onStick(dx * k, dy * k);
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      base.hidden = true;
      this.handlers?.onStick(0, 0);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }
}
