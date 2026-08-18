// ============================================================
// PAJAS FIGHTER — motor de pelea
// Loop a ~60fps, fases de ronda, IA, proyectiles, partículas,
// escenario con parallax y efectos de impacto (hitstop, shake).
// ============================================================

import {
  type AnimKey, type CharacterDef,
  animLength, drawCharacter, FRAME_DUR, LOOP_ANIMS,
} from './sprites';
import { sfx, startMusic, stopMusic } from './audio';

export const W = 960;
export const H = 540;
export const GROUND = 464;

export interface FighterInput {
  left: boolean; right: boolean; jump: boolean; block: boolean;
  punch: boolean; kick: boolean; special: boolean;
}
const emptyInput = (): FighterInput =>
  ({ left: false, right: false, jump: false, block: false, punch: false, kick: false, special: false });

interface Rect { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const hexRgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export type Phase = 'intro' | 'fight' | 'ko' | 'roundEnd' | 'matchEnd';

export interface SideHud { hp: number; maxHp: number; meter: number; ready: boolean }
export interface HudSnapshot {
  p1: SideHud; p2: SideHud;
  timer: number; phase: Phase; round: number;
  wins: [number, number];
  paused: boolean; muted: boolean;
  comboP1: number; comboP2: number;
}
export interface AnnounceMsg {
  id: number; text: string; sub?: string;
  kind: 'info' | 'fight' | 'ko' | 'win' | 'time';
}
export interface GameCallbacks {
  onHud: (h: HudSnapshot) => void;
  onAnnounce: (a: AnnounceMsg) => void;
  onMatchEnd: (winner: 1 | 2 | 0, def: CharacterDef | null) => void;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; grav: number;
  ring?: boolean;
}
interface Popup {
  x: number; y: number; life: number; maxLife: number;
  text: string; color: string; big: boolean;
}
const CONFETTI = ['#ffd23f', '#ff3860', '#35e0ff', '#ff4fd8', '#7cff4f', '#efe7ff'];
interface Projectile {
  x: number; y: number; vx: number; vy: number;
  amp: number; ph: number; t: number;
  big: boolean; rayo: boolean;
  owner: Fighter; dmg: number; color: string; dead: boolean;
}

// ------------------------------------------------------------
// Luchador
// ------------------------------------------------------------
class Fighter {
  def: CharacterDef;
  x: number; y = GROUND; vx = 0; vy = 0;
  facing: 1 | -1;
  state: AnimKey = 'idle';
  animT = 0; frame = 0; stun = 0; hasHit = false;
  onGround = true;
  hp: number; maxHp: number; meter = 25;
  isAI: boolean;
  aiT = 0; aiMove = 0; aiBlockT = 0; aiAttack: 'punch' | 'kick' | 'special' | null = null;
  fxSlashT = 0; fxSlashMax = 10; fxSlashColor = '#ffffff';
  combo = 0; comboTimer = 0;

  constructor(def: CharacterDef, x: number, facing: 1 | -1, isAI: boolean) {
    this.def = def; this.x = x; this.facing = facing; this.isAI = isAI;
    this.maxHp = def.stats.vida; this.hp = this.maxHp;
  }

  get s() { return this.def.scale; }

  hurtbox(): Rect {
    const w = 46 * this.s, h = 128 * this.s;
    const airH = this.onGround ? 0 : Math.min(40, GROUND - this.y) * 0; // hurtbox sigue al cuerpo
    return { x: this.x - w / 2, y: this.y - h + airH, w, h };
  }

  setState(s: AnimKey) {
    if (this.state === s) return;
    this.state = s; this.animT = 0; this.frame = 0; this.hasHit = false;
  }

  get attacking() {
    return this.state === 'punch' || this.state === 'kick' || this.state === 'special';
  }
  get free() {
    return !this.attacking && this.state !== 'hit' && this.state !== 'ko' &&
      this.state !== 'win' && this.state !== 'block';
  }

  update(inp: FighterInput) {
    this.animT++;
    if (this.fxSlashT > 0) this.fxSlashT--;
    if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer <= 0) this.combo = 0; }
    const dur = FRAME_DUR[this.state];
    const len = animLength(this.def, this.state);
    this.frame = LOOP_ANIMS[this.state]
      ? Math.floor(this.animT / dur) % len
      : Math.min(Math.floor(this.animT / dur), len - 1);

    if (this.state === 'ko' || this.state === 'win') { this.vx *= 0.85; this.applyPhysics(); return; }

    // fin de ataques / recovery
    if (this.attacking && this.animT >= len * dur) this.setState('idle');
    if (this.state === 'hit') {
      this.stun--;
      if (this.stun <= 0) this.setState('idle');
    }

    // decisiones (solo si está libre y en el suelo, o controlar en aire)
    if (this.free && this.onGround) {
      if (inp.block) this.setState('block');
      else if (inp.punch) { this.setState('punch'); sfx.whiff(); this.vx = this.facing * 3.1; }
      else if (inp.kick) { this.setState('kick'); sfx.whiff(); this.vx = this.facing * 2.4; }
      else if (inp.special) {
        if (this.meter >= 100) { this.setState('special'); this.meter = 0; sfx.charge(); }
        else sfx.denied();
      } else if (inp.jump) {
        this.vy = -16.2; this.onGround = false; this.setState('jump'); sfx.jump();
      } else if (inp.left || inp.right) {
        if (this.state !== 'walk') this.setState('walk');
      } else if (this.state !== 'idle') this.setState('idle');
    } else if (this.state === 'block' && !inp.block) {
      this.setState('idle');
    }

    // movimiento horizontal
    const spd = 3.7 * this.def.stats.velocidad;
    if (this.state === 'walk') {
      this.vx = ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * spd;
    } else if (this.state === 'hit') {
      this.vx *= 0.87;
    } else if (this.onGround && !this.attacking && this.state !== 'block') {
      this.vx *= 0.7;
    } else if (this.onGround && (this.attacking || this.state === 'block')) {
      this.vx *= 0.6;
    }
    if (!this.onGround && this.free) {
      this.vx += (((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * spd - this.vx) * 0.12;
    }

    this.applyPhysics();
  }

  private applyPhysics() {
    if (!this.onGround) {
      this.vy += 0.85;
      this.y += this.vy;
      if (this.y >= GROUND) {
        this.y = GROUND; this.onGround = true; this.vy = 0;
        if (this.state === 'jump') this.setState('idle');
      }
    }
    this.x += this.vx;
    this.x = Math.max(60, Math.min(W - 60, this.x));
  }
}

// ------------------------------------------------------------
// Juego
// ------------------------------------------------------------
export class Game {
  private ctx: CanvasRenderingContext2D;
  private cb: GameCallbacks;
  p1: Fighter; p2: Fighter;
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private phase: Phase = 'intro';
  private phaseT = 0;
  private round = 1;
  private wins: [number, number] = [0, 0];
  private timer = 60;
  private timerAcc = 0;
  private hitstop = 0;
  private shake = 0;
  private flash = 0;
  private timeScale = 1;
  private acc = 0;
  private frameN = 0;
  private paused = false;
  private mutedFlag = false;
  private running = true;
  private raf = 0;
  private last = 0;
  private keys = new Set<string>();
  private prevKeys = new Set<string>();
  private announceId = 0;
  private koByTime = false;
  private matchEndSent = false;
  private mode: 'cpu' | '2p';
  private airPrev: [boolean, boolean] = [false, false];

  // escenario pre-renderizado
  private sky: HTMLCanvasElement;
  private far: HTMLCanvasElement;
  private near: HTMLCanvasElement;
  private windows: { x: number; y: number; c: string }[] = [];
  private stars: { x: number; y: number; p: number }[] = [];

  constructor(canvas: HTMLCanvasElement, d1: CharacterDef, d2: CharacterDef, mode: 'cpu' | '2p', cb: GameCallbacks) {
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.cb = cb;
    this.mode = mode;
    this.p1 = new Fighter(d1, 280, 1, false);
    this.p2 = new Fighter(d2, W - 280, -1, mode === 'cpu');
    this.sky = this.makeSky();
    this.far = this.makeSkyline(1240, 240, '#20103f', 0.5);
    this.near = this.makeSkyline(1240, 300, '#140b2b', 0.85);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    startMusic('fight');
    this.announce('RONDA 1', '¿LISTOS?', 'info');
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    stopMusic();
  }

  setPaused(p: boolean) { this.paused = p; }
  setMuted(m: boolean) { this.mutedFlag = m; }

  private onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Slash', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (this.phase !== 'matchEnd') { this.paused = !this.paused; sfx.select(); }
    }
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };

  // ---------- anuncios ----------
  private announce(text: string, sub: string | undefined, kind: AnnounceMsg['kind']) {
    this.cb.onAnnounce({ id: ++this.announceId, text, sub, kind });
  }

  // ---------- inputs ----------
  private readInputs(): [FighterInput, FighterInput] {
    const k = this.keys, p = this.prevKeys;
    const edge = (c: string) => k.has(c) && !p.has(c);
    const i1 = emptyInput();
    i1.left = k.has('KeyA'); i1.right = k.has('KeyD');
    i1.jump = edge('KeyW'); i1.block = k.has('KeyS');
    i1.punch = edge('KeyF'); i1.kick = edge('KeyG'); i1.special = edge('KeyH');

    const i2 = emptyInput();
    if (this.mode === '2p') {
      i2.left = k.has('ArrowLeft'); i2.right = k.has('ArrowRight');
      i2.jump = edge('ArrowUp'); i2.block = k.has('ArrowDown');
      i2.punch = edge('Comma'); i2.kick = edge('Period'); i2.special = edge('Slash');
    } else {
      this.aiThink(this.p2, this.p1, i2);
    }
    return [i1, i2];
  }

  private aiThink(ai: Fighter, foe: Fighter, inp: FighterInput) {
    ai.aiT--;
    const dx = foe.x - ai.x;
    const dist = Math.abs(dx);
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    if (ai.aiT <= 0) {
      ai.aiT = 10 + Math.floor(Math.random() * 16);
      ai.aiMove = 0; ai.aiAttack = null;
      const foeAtk = foe.attacking;
      if (foeAtk && dist < 170 && Math.random() < 0.55) ai.aiBlockT = 16;
      else if (dist > 250 && ai.meter >= 100 && Math.random() < 0.4) ai.aiAttack = 'special';
      else if (dist > 125) {
        ai.aiMove = dir;
        if (Math.random() < 0.1) ai.aiMove = 0;
        if (dist > 200 && dist < 320 && ai.meter >= 100 && Math.random() < 0.35) ai.aiAttack = 'special';
      } else if (dist < 75 && Math.random() < 0.22) ai.aiMove = dir === 1 ? -1 : 1;
      if (!ai.aiAttack && dist < 125 && Math.random() < 0.6) {
        ai.aiAttack = Math.random() < 0.55 ? 'punch' : 'kick';
      }
    }
    if (ai.aiBlockT > 0) { ai.aiBlockT--; inp.block = true; }
    if (ai.aiMove === 1) inp.right = true;
    if (ai.aiMove === -1) inp.left = true;
    if (ai.aiAttack) { inp[ai.aiAttack] = true; ai.aiAttack = null; }
    if (Math.random() < 0.005 && dist > 160) inp.jump = true;
  }

  // ---------- loop ----------
  private loop = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(50, now - this.last);
    this.last = now;
    if (!this.paused) {
      this.acc += (dt / (1000 / 60)) * this.timeScale;
      let guard = 0;
      while (this.acc >= 1 && guard < 4) { this.stepOnce(); this.acc -= 1; guard++; }
    }
    this.draw();
    this.emitHud();
    this.raf = requestAnimationFrame(this.loop);
  };

  private stepOnce() {
    this.frameN++;
    if (this.hitstop > 0) {
      this.hitstop--;
      this.updateParticles();
      return;
    }
    this.phaseT++;

    // fases
    if (this.phase === 'intro') {
      if (this.phaseT === 110) {
        this.phase = 'fight'; this.phaseT = 0;
        this.announce('¡PELEA!', undefined, 'fight');
        sfx.start();
      }
    } else if (this.phase === 'fight') {
      this.timerAcc++;
      if (this.timerAcc >= 60) {
        this.timerAcc = 0; this.timer--;
        if (this.timer <= 5 && this.timer > 0) sfx.tick();
        if (this.timer <= 0) this.timeUp();
      }
    } else if (this.phase === 'ko') {
      if (this.phaseT === 55) this.timeScale = 1;
      if (this.phaseT === 60) {
        const w = this.winnerOfRound();
        if (w) w.setState('win');
      }
      if (this.phaseT >= 165) this.endRound();
    } else if (this.phase === 'matchEnd') {
      if (this.phaseT === 45 && !this.matchEndSent) {
        this.matchEndSent = true;
        const wn = this.wins[0] >= 2 ? this.p1 : this.wins[1] >= 2 ? this.p2 : null;
        this.cb.onMatchEnd(wn === this.p1 ? 1 : wn === this.p2 ? 2 : 0, wn ? wn.def : null);
      }
      // confeti de celebración
      if (this.frameN % 3 === 0 && this.particles.length < 420) {
        this.particles.push({
          x: Math.random() * W, y: -8,
          vx: (Math.random() - 0.5) * 1.6, vy: 1.6 + Math.random() * 2.2,
          life: 150, maxLife: 150, size: 3 + Math.random() * 3,
          color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)], grav: 0.03,
        });
      }
    }

    // luchadores
    const [i1, i2] = this.readInputs();
    const act = this.phase === 'fight';
    this.p1.update(act ? i1 : emptyInput());
    this.p2.update(act ? i2 : emptyInput());
    this.prevKeys = new Set(this.keys);

    // polvo de aterrizaje
    const prevAir = this.airPrev;
    this.airPrev = [!this.p1.onGround, !this.p2.onGround];
    const pairs: [Fighter, boolean][] = [[this.p1, prevAir[0]], [this.p2, prevAir[1]]];
    for (const [f, wasAir] of pairs) {
      if (wasAir && f.onGround && f.y >= GROUND - 1) {
        sfx.land();
        for (let i = 0; i < 6; i++) {
          this.particles.push({
            x: f.x + (Math.random() - 0.5) * 36 * f.s, y: f.y - 2,
            vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.6,
            life: 16, maxLife: 16, size: 3 + Math.random() * 3,
            color: '#9c8cc9', grav: 0.18,
          });
        }
      }
    }

    // orientación automática
    if (act) {
      if (this.p1.free || this.p1.state === 'walk' || this.p1.state === 'idle')
        this.p1.facing = this.p2.x >= this.p1.x ? 1 : -1;
      if (this.p2.free || this.p2.state === 'walk' || this.p2.state === 'idle')
        this.p2.facing = this.p1.x >= this.p2.x ? 1 : -1;
    }

    if (act) {
      this.checkAttack(this.p1, this.p2);
      this.checkAttack(this.p2, this.p1);
      this.pushApart();
      this.updateProjectiles();
      this.spawnSpecials();
    }

    // aura de especial listo
    for (const f of [this.p1, this.p2]) {
      if (f.meter >= 100 && this.frameN % 5 === 0) {
        this.particles.push({
          x: f.x + (Math.random() - 0.5) * 40 * f.s, y: f.y - Math.random() * 30,
          vx: (Math.random() - 0.5) * 0.6, vy: -1.4 - Math.random(),
          life: 26, maxLife: 26, size: 3, color: f.def.energyColor, grav: 0,
        });
      }
    }

    // brasas ambientales
    if (this.frameN % 14 === 0 && this.particles.length < 380) {
      const colors = ['#ffd23f', '#ff4fd8', '#35e0ff'];
      this.particles.push({
        x: Math.random() * W, y: H + 8,
        vx: (Math.random() - 0.5) * 0.4, vy: -0.5 - Math.random() * 0.9,
        life: 260, maxLife: 260, size: 2,
        color: colors[Math.floor(Math.random() * colors.length)], grav: 0,
      });
    }

    this.updateParticles();
    if (this.shake > 0.3) this.shake *= 0.88; else this.shake = 0;
    if (this.flash > 0) this.flash--;
  }

  // ---------- combate ----------
  private checkAttack(a: Fighter, b: Fighter) {
    if (a.hasHit || !a.attacking || a.state === 'special') return;
    const t = a.animT;
    let box: Rect | null = null;
    let dmg = 0;
    if (a.state === 'punch' && t >= 4 && t <= 10) {
      const wBox = 68 * a.s;
      box = {
        x: a.facing === 1 ? a.x + 14 * a.s : a.x - 14 * a.s - wBox,
        y: a.y - 102 * a.s, w: wBox, h: 46 * a.s,
      };
      dmg = Math.max(1, Math.round(6 * a.def.stats.fuerza));
    } else if (a.state === 'kick' && t >= 10 && t <= 17) {
      const wBox = 88 * a.s;
      box = {
        x: a.facing === 1 ? a.x + 12 * a.s : a.x - 12 * a.s - wBox,
        y: a.y - 78 * a.s, w: wBox, h: 42 * a.s,
      };
      dmg = Math.max(1, Math.round(9 * a.def.stats.fuerza));
    }
    if (box && overlap(box, b.hurtbox())) {
      a.hasHit = true;
      const cx = a.facing === 1 ? box.x + box.w * 0.7 : box.x + box.w * 0.3;
      this.hitFighter(a, b, dmg, a.facing, a.state === 'kick', cx, box.y + box.h / 2);
    }
  }

  private hitFighter(attacker: Fighter, target: Fighter, dmg: number, dir: number, heavy: boolean, cx: number, cy: number) {
    if (this.phase !== 'fight' || target.state === 'ko') return;
    const blocking = target.state === 'block' && target.onGround;
    if (blocking) {
      const chip = Math.max(1, Math.round(dmg * 0.15));
      target.hp = Math.max(0, target.hp - chip);
      target.vx = dir * 3.4;
      target.meter = Math.min(100, target.meter + 4);
      attacker.combo = 0; attacker.comboTimer = 0;
      attacker.fxSlashT = attacker.fxSlashMax = 8; attacker.fxSlashColor = '#7ce7ff';
      this.burst(cx, cy, '#35e0ff', 8, 3);
      this.ring(cx, cy, '#35e0ff', 5);
      this.popup(cx, cy - 34, 'BLOQUEO', '#7ce7ff', false);
      this.shake = Math.max(this.shake, 3);
      sfx.block();
      if (target.hp <= 0) this.doKO(target, attacker);
      return;
    }
    target.hp = Math.max(0, target.hp - dmg);
    target.setState('hit');
    target.stun = heavy ? 20 : 15;
    target.vx = dir * (heavy ? 8.5 : 5.5);
    if (heavy) { target.vy = -5; target.onGround = false; }
    attacker.meter = Math.min(100, attacker.meter + 9);
    target.meter = Math.min(100, target.meter + 13);
    attacker.combo = attacker.comboTimer > 0 ? attacker.combo + 1 : 1;
    attacker.comboTimer = 100;
    attacker.fxSlashT = attacker.fxSlashMax = heavy ? 11 : 8;
    attacker.fxSlashColor = heavy ? '#ffd23f' : '#ffffff';
    const hfx = attacker.def.hitFx;
    const hs = hfx?.kind ?? 'chispa';
    const hc = hfx?.color ?? '#ffd23f';
    let stop = heavy ? 10 : 7;
    let shk = heavy ? 14 : 8;
    if (hs === 'impacto') { stop += 3; shk += 5; }
    if (hs === 'electrico') { stop += 1; shk += 2; }
    this.hitstop = stop;
    this.shake = Math.max(this.shake, shk);
    this.burst(cx, cy, hc, heavy ? 22 : 14, heavy ? 5.5 : 4.2);
    // chispas direccionales
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x: cx, y: cy, vx: dir * (2 + Math.random() * 4.5), vy: (Math.random() - 0.5) * 4.5,
        life: 13, maxLife: 13, size: 3, color: '#ffffff', grav: 0.12,
      });
    }
    if (hs === 'electrico') {
      this.burst(cx, cy, '#ffffff', 10, 5);
      this.burst(cx, cy, attacker.def.energyColor, 10, 4.5);
      this.ring(cx, cy, '#ffffff', heavy ? 9 : 6);
    }
    if (hs === 'impacto') {
      this.burst(cx, cy, '#ffffff', 10, 3);
      this.ring(cx, cy, hc, heavy ? 13 : 10);
    }
    this.ring(cx, cy, hs === 'electrico' ? '#ffffff' : (heavy ? hc : '#ffffff'), heavy ? 8 : 5);
    this.popup(cx, cy - 30, `-${dmg}`, attacker === this.p1 ? '#ff5c7a' : '#5cd6ff', heavy);
    this.burst(cx, cy, '#ffffff', 6, 3);
    if (heavy) sfx.heavy(); else sfx.hit(1);
    if (target.hp <= 0) this.doKO(target, attacker);
  }

  private doKO(loser: Fighter, winner: Fighter) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko'; this.phaseT = 0; this.koByTime = false;
    loser.setState('ko');
    loser.vx = -loser.facing * 6;
    winner.meter = Math.min(100, winner.meter + 20);
    this.timeScale = 0.35;
    this.hitstop = 12;
    this.shake = 18;
    this.flash = 10;
    this.announce('¡K.O.!', undefined, 'ko');
    sfx.ko();
    this.burst(loser.x, loser.y - 70, '#ff3860', 26, 6);
    this.burst(loser.x, loser.y - 70, '#ffd23f', 16, 5);
    this.ring(loser.x, loser.y - 70, '#ff3860', 12);
    this.ring(loser.x, loser.y - 70, '#ffd23f', 8);
  }

  private timeUp() {
    if (this.phase !== 'fight') return;
    this.phase = 'ko'; this.phaseT = 0; this.koByTime = true;
    this.announce('¡TIEMPO!', undefined, 'time');
    sfx.ko();
    this.flash = 6;
  }

  private winnerOfRound(): Fighter | null {
    if (this.p1.hp <= 0 && this.p2.hp > 0) return this.p2;
    if (this.p2.hp <= 0 && this.p1.hp > 0) return this.p1;
    if (this.p1.hp === this.p2.hp) return null;
    return this.p1.hp > this.p2.hp ? this.p1 : this.p2;
  }

  private endRound() {
    const w = this.winnerOfRound();
    if (w === this.p1) this.wins[0]++;
    else if (w === this.p2) this.wins[1]++;
    if (this.wins[0] >= 2 || this.wins[1] >= 2) {
      this.phase = 'matchEnd'; this.phaseT = 0;
      const wn = this.wins[0] >= 2 ? this.p1 : this.p2;
      wn.setState('win');
      this.announce(`¡${wn.def.name} GANA!`, `${this.wins[0]} — ${this.wins[1]}`, 'win');
      sfx.win();
      return;
    }
    // siguiente ronda
    this.round++;
    this.resetRound();
    this.phase = 'intro'; this.phaseT = 0;
    this.announce(`RONDA ${this.round}`, '¿LISTOS?', 'info');
  }

  private resetRound() {
    this.p1.x = 280; this.p2.x = W - 280;
    this.p1.facing = 1; this.p2.facing = -1;
    for (const f of [this.p1, this.p2]) {
      f.hp = f.maxHp; f.y = GROUND; f.vx = 0; f.vy = 0;
      f.onGround = true; f.stun = 0; f.setState('idle');
      f.combo = 0; f.comboTimer = 0; f.fxSlashT = 0;
    }
    this.timer = 60; this.timerAcc = 0;
    this.projectiles = [];
    this.popups = [];
    this.timeScale = 1;
  }

  // ---------- proyectiles ----------
  private spawnSpecials() {
    for (const f of [this.p1, this.p2]) {
      if (f.state === 'special' && f.animT === 12) {
        const style = f.def.specialStyle ?? 'onda';
        const base = Math.max(2, Math.round(16 * f.def.stats.fuerza));
        const x = f.x + f.facing * 46 * f.s;
        const y = f.y - 72 * f.s;
        const mk = (dmg: number, vy: number, ph: number, big: boolean, rayo: boolean, vxMul: number): Projectile => ({
          x, y, vx: f.facing * 8.4 * vxMul, vy, amp: ph !== 0 ? 26 : 0, ph, t: 0,
          big, rayo, owner: f, dmg, color: f.def.energyColor, dead: false,
        });
        if (style === 'triple') {
          for (const ph of [-1.35, 0, 1.35]) this.projectiles.push(mk(Math.max(2, Math.round(base * 0.6)), 0, ph, false, false, 1));
        } else if (style === 'gigante') {
          this.projectiles.push(mk(Math.max(3, Math.round(base * 1.6)), 0, 0, true, false, 0.78));
        } else if (style === 'rayo') {
          this.projectiles.push(mk(Math.max(2, Math.round(base * 0.8)), 0, 0, false, true, 2.1));
        } else {
          this.projectiles.push(mk(base, 0, 0, false, false, 1));
        }
        sfx.fire();
        this.flash = 3;
        this.burst(x, y, f.def.energyColor, style === 'gigante' ? 18 : 12, 4);
        this.ring(x, y, f.def.energyColor, style === 'gigante' ? 9 : 5);
      }
    }
    // colisión entre proyectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      for (let j = i + 1; j < this.projectiles.length; j++) {
        const a = this.projectiles[i], b = this.projectiles[j];
        if (a.owner !== b.owner && Math.abs(a.x - b.x) < 26 && Math.abs(a.y - b.y) < 26) {
          a.dead = b.dead = true;
          this.burst((a.x + b.x) / 2, a.y, '#ffffff', 16, 5);
          sfx.projectileHit();
        }
      }
    }
  }

  private updateProjectiles() {
    for (const p of this.projectiles) {
      p.t++;
      p.x += p.vx;
      if (p.amp > 0) {
        p.y += Math.cos(p.t * 0.12 + p.ph) * p.amp * 0.12;
        p.y = Math.max(GROUND - 260, Math.min(GROUND - 26, p.y));
      }
      this.particles.push({
        x: p.x - Math.sign(p.vx) * (p.big ? 18 : 10), y: p.y + (Math.random() - 0.5) * (p.big ? 22 : 12),
        vx: -Math.sign(p.vx) * (0.5 + Math.random()), vy: (Math.random() - 0.5) * 0.8,
        life: 14, maxLife: 14, size: 3 + Math.random() * (p.big ? 5 : 3), color: p.color, grav: 0,
      });
      const target = p.owner === this.p1 ? this.p2 : this.p1;
      const hr = p.big ? 21 : 14;
      const box: Rect = { x: p.x - hr, y: p.y - hr, w: hr * 2, h: hr * 2 };
      if (overlap(box, target.hurtbox())) {
        p.dead = true;
        this.hitFighter(p.owner, target, p.dmg, Math.sign(p.vx) as 1 | -1, true, p.x, p.y);
        this.burst(p.x, p.y, p.color, 20, 5);
        sfx.projectileHit();
      }
      if (p.x < -60 || p.x > W + 60) p.dead = true;
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  // ---------- utilidades de combate ----------
  private pushApart() {
    const a = this.p1.hurtbox(), b = this.p2.hurtbox();
    if (!overlap(a, b)) return;
    if (this.p1.state === 'ko' || this.p2.state === 'ko') return;
    const ov = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const dir = this.p1.x <= this.p2.x ? 1 : -1;
    this.p1.x -= (dir * ov) / 2;
    this.p2.x += (dir * ov) / 2;
    this.p1.x = Math.max(60, Math.min(W - 60, this.p1.x));
    this.p2.x = Math.max(60, Math.min(W - 60, this.p2.x));
  }

  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random()) * speed;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
        life: 18 + Math.random() * 14, maxLife: 30,
        size: 2 + Math.random() * 4, color, grav: 0.25,
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  private ring(x: number, y: number, color: string, size = 5) {
    this.particles.push({
      x, y, vx: size * 1.35, vy: 0, life: 13, maxLife: 13, size, color, grav: 0, ring: true,
    });
  }

  private popup(x: number, y: number, text: string, color: string, big: boolean) {
    this.popups.push({
      x: x + (Math.random() - 0.5) * 18, y, life: 48, maxLife: 48, text, color, big,
    });
    if (this.popups.length > 24) this.popups.shift();
  }

  private updateParticles() {
    for (const p of this.particles) {
      p.life--;
      if (p.ring) { p.size += p.vx; continue; }
      p.x += p.vx; p.y += p.vy; p.vy += p.grav;
    }
    this.particles = this.particles.filter(p => p.life > 0 && p.y < H + 30);
    for (const pp of this.popups) { pp.life--; pp.y -= 0.85; }
    this.popups = this.popups.filter(p => p.life > 0);
  }

  // ---------- HUD ----------
  private emitHud() {
    this.cb.onHud({
      p1: { hp: this.p1.hp, maxHp: this.p1.maxHp, meter: this.p1.meter, ready: this.p1.meter >= 100 },
      p2: { hp: this.p2.hp, maxHp: this.p2.maxHp, meter: this.p2.meter, ready: this.p2.meter >= 100 },
      timer: Math.max(0, this.timer),
      phase: this.phase,
      round: this.round,
      wins: [this.wins[0], this.wins[1]],
      paused: this.paused,
      muted: this.mutedFlag,
      comboP1: this.p1.combo >= 2 ? this.p1.combo : 0,
      comboP2: this.p2.combo >= 2 ? this.p2.combo : 0,
    });
  }

  // ---------- dibujo ----------
  private draw() {
    const c = this.ctx;
    const camRaw = (this.p1.x + this.p2.x) / 2 - W / 2;
    const cam = Math.max(-70, Math.min(70, camRaw));
    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;

    c.save();
    c.translate(shx, shy);

    c.drawImage(this.sky, 0, 0);

    // estrellas titilantes
    for (const s of this.stars) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.frameN * 0.03 + s.p));
      c.fillStyle = `rgba(255,240,200,${(tw * 0.8).toFixed(3)})`;
      c.fillRect(s.x, s.y, 2, 2);
    }

    c.drawImage(this.far, -140 - cam * 0.12, H - 240 - 84);
    c.drawImage(this.near, -140 - cam * 0.26, H - 300 - 64);

    // ventanas encendidas (parpadeo)
    for (let i = 0; i < this.windows.length; i++) {
      const wnd = this.windows[i];
      const on = ((i * 7919 + Math.floor(this.frameN / 24)) % 7) > 1;
      if (!on) continue;
      c.fillStyle = wnd.c;
      c.fillRect(wnd.x - 140 - cam * 0.26, wnd.y + H - 300 - 64, 5, 7);
    }

    // letreros neón
    this.neon(c, 'PAJAS', 205 - cam * 0.26, 168, '#ff4fd8', 0.07);
    this.neon(c, 'RECORDS', 730 - cam * 0.26, 148, '#35e0ff', 0.11);

    // suelo
    c.fillStyle = '#170e33';
    c.fillRect(0, GROUND, W, H - GROUND);
    const sweep = (this.frameN * 3) % (W + 300) - 150;
    const gg = c.createLinearGradient(sweep - 120, 0, sweep + 120, 0);
    gg.addColorStop(0, 'rgba(255,210,63,0)');
    gg.addColorStop(0.5, 'rgba(255,210,63,0.06)');
    gg.addColorStop(1, 'rgba(255,210,63,0)');
    c.fillStyle = gg;
    c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = 'rgba(255,210,63,0.5)';
    c.fillRect(0, GROUND - 2, W, 3);
    c.fillStyle = 'rgba(74,47,143,0.55)';
    for (let x = -80; x < W + 80; x += 80) {
      const lx = x - ((cam * 0.5) % 80);
      c.fillRect(lx, GROUND + 4, 3, H - GROUND - 4);
    }
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, GROUND + 34, W, 3);

    // farolas
    this.lamp(c, 84 - cam * 0.4, 0);
    this.lamp(c, 876 - cam * 0.4, 2.1);

    // sombras + aura
    for (const f of [this.p1, this.p2]) {
      const air = Math.max(0, GROUND - f.y);
      const rx = 42 * f.s * (1 - Math.min(0.45, air / 300));
      c.fillStyle = 'rgba(5,2,14,0.5)';
      c.beginPath();
      c.ellipse(f.x, GROUND + 12, rx, 9, 0, 0, Math.PI * 2);
      c.fill();
      if (f.meter >= 100) {
        const gl = c.createRadialGradient(f.x, GROUND + 6, 4, f.x, GROUND + 6, 60 * f.s);
        gl.addColorStop(0, hexRgba(f.def.energyColor, 0.4));
        gl.addColorStop(1, hexRgba(f.def.energyColor, 0));
        c.fillStyle = gl;
        c.beginPath();
        c.ellipse(f.x, GROUND + 8, 62 * f.s, 16, 0, 0, Math.PI * 2);
        c.fill();
      }
    }

    // luchadores (el que está en K.O. detrás)
    const order = this.p1.state === 'ko' ? [this.p1, this.p2] : [this.p2, this.p1];
    for (const f of order) drawCharacter(c, f.def, f.state, f.frame, f.x, f.y, f.facing);

    // estelas de golpe (arco de slash)
    for (const f of [this.p1, this.p2]) {
      if (f.fxSlashT <= 0) continue;
      if (!(f.state === 'punch' || f.state === 'kick' || f.state === 'special')) continue;
      const t = 1 - f.fxSlashT / f.fxSlashMax;
      const px = f.x + f.facing * 16 * f.s;
      const py = f.y - (f.state === 'kick' ? 66 : 84) * f.s;
      const r = (f.state === 'kick' ? 54 : f.state === 'special' ? 60 : 47) * f.s;
      const a0 = -2.3 + t * 0.5;
      const sweep = 1.1 + t * 1.5;
      c.save();
      c.translate(px, py);
      if (f.facing < 0) c.scale(-1, 1);
      c.lineCap = 'round';
      c.shadowColor = f.fxSlashColor; c.shadowBlur = 14;
      c.globalAlpha = (1 - t) * 0.95;
      c.strokeStyle = f.fxSlashColor;
      c.lineWidth = 5 * f.s;
      c.beginPath(); c.arc(0, 0, r, a0, a0 + sweep); c.stroke();
      c.shadowBlur = 0;
      c.globalAlpha = (1 - t) * 0.55;
      c.lineWidth = 2 * f.s;
      c.beginPath(); c.arc(0, 0, r * 0.76, a0 + 0.3, a0 + sweep * 0.8); c.stroke();
      c.restore();
    }

    // proyectiles
    for (const p of this.projectiles) {
      if (p.rayo) {
        c.save();
        c.translate(p.x, p.y);
        c.shadowColor = p.color; c.shadowBlur = 18;
        const gl = c.createLinearGradient(0, -10, 0, 10);
        gl.addColorStop(0, hexRgba(p.color, 0));
        gl.addColorStop(0.5, hexRgba(p.color, 0.95));
        gl.addColorStop(1, hexRgba(p.color, 0));
        c.fillStyle = gl;
        c.fillRect(-34, -10, 68, 20);
        c.shadowBlur = 0;
        c.fillStyle = '#ffffff';
        c.fillRect(-30, -3, 60, 6);
        c.fillStyle = p.color;
        c.fillRect(Math.sign(p.vx) > 0 ? 26 : -34, -6, 8, 12);
        c.restore();
      } else {
        const R = p.big ? 20 : 11;
        const GR = p.big ? 52 : 30;
        const gl = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, GR);
        gl.addColorStop(0, hexRgba(p.color, 0.85));
        gl.addColorStop(1, hexRgba(p.color, 0));
        c.fillStyle = gl;
        c.beginPath(); c.arc(p.x, p.y, GR, 0, Math.PI * 2); c.fill();
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(p.x, p.y, p.big ? 9 : 5, 0, Math.PI * 2); c.fill();
        if (p.big) {
          c.strokeStyle = hexRgba('#ffffff', 0.5 + 0.4 * Math.sin(this.frameN * 0.4));
          c.lineWidth = 2;
          c.beginPath(); c.arc(p.x, p.y, R + 5 + Math.sin(this.frameN * 0.4) * 2, 0, Math.PI * 2); c.stroke();
        }
      }
    }

    // partículas (chispas + anillos de impacto)
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      if (p.ring) {
        c.globalAlpha = a * 0.95;
        c.strokeStyle = p.color;
        c.lineWidth = 4;
        c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = a * 0.45;
        c.lineWidth = 2;
        c.beginPath(); c.arc(p.x, p.y, p.size * 0.68, 0, Math.PI * 2); c.stroke();
      } else {
        c.globalAlpha = a;
        c.fillStyle = p.color;
        c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    c.globalAlpha = 1;

    if (this.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${(this.flash / 12).toFixed(3)})`;
      c.fillRect(-20, -20, W + 40, H + 40);
    }

    // números de daño / avisos
    for (const pp of this.popups) {
      const t = 1 - pp.life / pp.maxLife;
      const scale = t < 0.16 ? 0.55 + (t / 0.16) * 0.6 : 1.15 - Math.min(0.15, (t - 0.16) * 0.18);
      c.save();
      c.translate(pp.x, pp.y);
      c.scale(scale, scale);
      c.globalAlpha = Math.min(1, pp.life / 12);
      c.font = `${pp.big ? 17 : 12}px "Press Start 2P", monospace`;
      c.textAlign = 'center';
      c.lineWidth = 5;
      c.lineJoin = 'round';
      c.strokeStyle = '#0b0618';
      c.strokeText(pp.text, 0, 0);
      c.fillStyle = pp.color;
      c.fillText(pp.text, 0, 0);
      c.restore();
    }
    c.globalAlpha = 1;
    c.restore();
  }

  private neon(c: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, flick: number) {
    const on = Math.sin(this.frameN * flick * 3) > -0.82;
    c.font = '13px "Press Start 2P", monospace';
    if (on) {
      c.shadowColor = color; c.shadowBlur = 14;
      c.fillStyle = color;
      c.fillText(text, x, y);
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillText(text, x, y);
    } else {
      c.fillStyle = 'rgba(120,90,160,0.35)';
      c.fillText(text, x, y);
    }
  }

  private lamp(c: CanvasRenderingContext2D, x: number, phase: number) {
    const flick = 0.55 + 0.45 * Math.abs(Math.sin(this.frameN * 0.08 + phase));
    c.fillStyle = '#0d0722';
    c.fillRect(x - 3, GROUND - 150, 6, 150);
    c.fillRect(x - 14, GROUND - 150, 28, 6);
    c.fillStyle = '#241548';
    c.fillRect(x - 9, GROUND - 162, 18, 14);
    const gl = c.createRadialGradient(x, GROUND - 152, 2, x, GROUND - 152, 70);
    gl.addColorStop(0, `rgba(255,210,63,${(0.5 * flick).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(255,210,63,0)');
    c.fillStyle = gl;
    c.beginPath(); c.arc(x, GROUND - 152, 70, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(255,235,150,${(0.5 + 0.5 * flick).toFixed(3)})`;
    c.fillRect(x - 5, GROUND - 158, 10, 6);
  }

  // ---------- escenario pre-renderizado ----------
  private makeSky(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0522');
    g.addColorStop(0.42, '#241051');
    g.addColorStop(0.7, '#4a1663');
    g.addColorStop(0.86, '#7c2168');
    g.addColorStop(1, '#2a1145');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    // luna pixelada
    const mx = 730, my = 110, r = 46;
    x.fillStyle = '#ffe9c4';
    for (let yy = -r; yy <= r; yy += 4) {
      const wdt = Math.floor(Math.sqrt(r * r - yy * yy) / 4) * 4;
      x.fillRect(mx - wdt, my + yy, wdt * 2, 4);
    }
    x.fillStyle = '#e8c996';
    x.fillRect(mx - 18, my - 14, 12, 10);
    x.fillRect(mx + 6, my + 4, 14, 12);
    x.fillRect(mx - 8, my + 18, 10, 8);
    // banda de neblina
    x.fillStyle = 'rgba(255,79,216,0.08)';
    x.fillRect(0, 330, W, 26);
    x.fillStyle = 'rgba(53,224,255,0.06)';
    x.fillRect(0, 366, W, 18);
    // estrellas base
    for (let i = 0; i < 70; i++) {
      x.fillStyle = 'rgba(255,245,215,0.5)';
      x.fillRect(Math.random() * W, Math.random() * 300, 2, 2);
    }
    this.stars = Array.from({ length: 26 }, () => ({
      x: Math.random() * W, y: Math.random() * 280, p: Math.random() * 10,
    }));
    return c;
  }

  private makeSkyline(w: number, h: number, color: string, density: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d')!;
    let bx = 0;
    const winColors = ['rgba(255,210,63,0.9)', 'rgba(53,224,255,0.85)', 'rgba(255,79,216,0.85)'];
    while (bx < w) {
      const bw = 46 + Math.random() * 70;
      const bh = h * (0.35 + Math.random() * 0.6) * density + h * 0.2;
      const by = h - bh;
      x.fillStyle = color;
      x.fillRect(bx, by, bw, bh);
      if (Math.random() < 0.4) x.fillRect(bx + bw * 0.3, by - 14, 4, 14);
      if (density > 0.7) {
        for (let wy = by + 10; wy < h - 14; wy += 16) {
          for (let wx = bx + 6; wx < bx + bw - 10; wx += 13) {
            if (Math.random() < 0.3) {
              x.fillStyle = 'rgba(10,5,25,0.9)';
              x.fillRect(wx, wy, 5, 7);
              if (Math.random() < 0.45) {
                this.windows.push({ x: wx, y: wy, c: winColors[Math.floor(Math.random() * winColors.length)] });
              }
            }
          }
        }
      }
      bx += bw + 4 + Math.random() * 16;
    }
    return c;
  }
}
