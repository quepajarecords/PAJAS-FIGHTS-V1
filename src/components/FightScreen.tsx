import { useEffect, useRef, useState } from 'react';
import { Game, W, H, type AnnounceMsg, type HudSnapshot } from '../game/engine';
import type { CharacterDef } from '../game/sprites';
import { isMuted, setMuted, sfx } from '../game/audio';
import { SoundIcon, PauseIcon } from './ui';

const KIND_COLOR: Record<AnnounceMsg['kind'], string> = {
  info: '#efe7ff', fight: '#ffd23f', ko: '#ff3860', win: '#ff4fd8', time: '#35e0ff',
};

function SideHud({
  side, name, title, color,
  mainRef, ghostRef, meterRef, readyRef, pipsRef,
}: {
  side: 1 | 2; name: string; title: string; color: string;
  mainRef: React.Ref<HTMLDivElement>; ghostRef: React.Ref<HTMLDivElement>;
  meterRef: React.Ref<HTMLDivElement>; readyRef: React.Ref<HTMLDivElement>;
  pipsRef: React.Ref<HTMLDivElement>;
}) {
  const right = side === 2;
  return (
    <div className={`flex-1 ${right ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <div
          className="font-display text-[8px] px-2 py-1.5 border-2 border-[#060310] shrink-0"
          style={{ background: color, color: '#0b0618' }}
        >
          {name.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className={`font-display text-[10px] text-white text-outline truncate leading-none ${right ? 'text-right' : ''}`}>{name}</div>
          <div className={`font-body text-[9px] font-bold text-[#b9a8e8] truncate leading-tight ${right ? 'text-right' : ''}`}>{title}</div>
        </div>
      </div>
      <div
        className={`relative mt-1 h-6 border-[3px] border-[#060310] bg-[#38102a] overflow-hidden ${right ? '-skew-x-12' : 'skew-x-12'}`}
      >
        <div ref={ghostRef} className={`hp-ghost absolute inset-y-0 ${right ? 'right-0' : 'left-0'} bg-[#ff3860]`} style={{ width: '100%' }} />
        <div ref={mainRef} className={`hp-main absolute inset-y-0 ${right ? 'right-0' : 'left-0'}`} style={{ width: '100%', background: 'linear-gradient(180deg,#ffe98a 0%,#ffd23f 55%,#f5a623 100%)' }} />
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 10px, rgba(0,0,0,0.8) 10px 12px)' }} />
      </div>
      <div className={`flex items-center gap-2 mt-1.5 ${right ? 'flex-row-reverse' : ''}`}>
        <div ref={pipsRef} className={`flex gap-1.5 ${right ? 'flex-row-reverse' : ''}`}>
          {[0, 1].map(i => (
            <span key={i} data-pip={i} className="w-3 h-3 rotate-45 border-2 border-[#060310] bg-[#241548]" />
          ))}
        </div>
        <div className={`flex-1 h-3 border-2 border-[#060310] bg-[#120a28] relative overflow-hidden ${right ? '-skew-x-12' : 'skew-x-12'}`}>
          <div ref={meterRef} className={`meter-fill absolute inset-y-0 ${right ? 'right-0' : 'left-0'}`} style={{ width: '25%', background: `linear-gradient(180deg,#ffffff22,#0000), ${color}` }} />
        </div>
        <div ref={readyRef} className="font-display text-[7px] text-[#ffd23f] opacity-0 whitespace-nowrap">¡LISTO!</div>
      </div>
    </div>
  );
}

export function FightScreen({
  p1, p2, mode, onRematch, onExit,
}: {
  p1: CharacterDef; p2: CharacterDef; mode: 'cpu' | '2p';
  onRematch: () => void; onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [announce, setAnnounce] = useState<AnnounceMsg | null>(null);
  const [over, setOver] = useState<{ winner: 1 | 2 | 0; def: CharacterDef | null } | null>(null);
  const [paused, setPaused] = useState(false);
  const [timer, setTimer] = useState(60);
  const [round, setRound] = useState(1);
  const [mutedUi, setMutedUi] = useState(isMuted());

  const p1Main = useRef<HTMLDivElement>(null); const p1Ghost = useRef<HTMLDivElement>(null);
  const p2Main = useRef<HTMLDivElement>(null); const p2Ghost = useRef<HTMLDivElement>(null);
  const p1Meter = useRef<HTMLDivElement>(null); const p2Meter = useRef<HTMLDivElement>(null);
  const p1Ready = useRef<HTMLDivElement>(null); const p2Ready = useRef<HTMLDivElement>(null);
  const p1Pips = useRef<HTMLDivElement>(null); const p2Pips = useRef<HTMLDivElement>(null);
  const lastTimer = useRef(60); const lastRound = useRef(1);
  const [combos, setCombos] = useState<[number, number]>([0, 0]);
  const lastCombo = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let annTimer = 0;
    const game = new Game(canvas, p1, p2, mode, {
      onHud: (h: HudSnapshot) => {
        const setW = (el: HTMLDivElement | null, pct: number) => { if (el) el.style.width = `${pct}%`; };
        setW(p1Main.current, (h.p1.hp / h.p1.maxHp) * 100);
        setW(p1Ghost.current, (h.p1.hp / h.p1.maxHp) * 100);
        setW(p2Main.current, (h.p2.hp / h.p2.maxHp) * 100);
        setW(p2Ghost.current, (h.p2.hp / h.p2.maxHp) * 100);
        setW(p1Meter.current, h.p1.meter);
        setW(p2Meter.current, h.p2.meter);
        if (p1Ready.current) p1Ready.current.style.opacity = h.p1.ready ? '1' : '0';
        if (p2Ready.current) p2Ready.current.style.opacity = h.p2.ready ? '1' : '0';
        if (p1Ready.current) p1Ready.current.classList.toggle('anim-blink', h.p1.ready);
        if (p2Ready.current) p2Ready.current.classList.toggle('anim-blink', h.p2.ready);
        const pips = (el: HTMLDivElement | null, wins: number) => {
          if (!el) return;
          el.querySelectorAll('[data-pip]').forEach((n, i) => {
            (n as HTMLElement).style.background = i < wins ? '#ffd23f' : '#241548';
            (n as HTMLElement).style.boxShadow = i < wins ? '0 0 8px #ffd23f' : 'none';
          });
        };
        pips(p1Pips.current, h.wins[0]);
        pips(p2Pips.current, h.wins[1]);
        if (h.timer !== lastTimer.current) { lastTimer.current = h.timer; setTimer(h.timer); }
        if (h.round !== lastRound.current) { lastRound.current = h.round; setRound(h.round); }
        if (h.comboP1 !== lastCombo.current[0] || h.comboP2 !== lastCombo.current[1]) {
          lastCombo.current = [h.comboP1, h.comboP2];
          setCombos([h.comboP1, h.comboP2]);
        }
        setPaused(h.paused);
        if (h.phase === 'matchEnd') setPaused(false);
      },
      onAnnounce: (a) => {
        setAnnounce(a);
        window.clearTimeout(annTimer);
        if (a.kind !== 'win') {
          annTimer = window.setTimeout(() => setAnnounce(null), a.kind === 'fight' ? 900 : 1500);
        }
      },
      onMatchEnd: (winner, def) => setOver({ winner, def }),
    });
    gameRef.current = game;
    game.setMuted(isMuted());

    const onMute = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        const m = !isMuted();
        setMuted(m);
        game.setMuted(m);
        setMutedUi(m);
        sfx.select();
      }
    };
    window.addEventListener('keydown', onMute);
    return () => {
      window.removeEventListener('keydown', onMute);
      window.clearTimeout(annTimer);
      game.destroy();
      gameRef.current = null;
    };
  }, [p1, p2, mode]);

  const toggleMute = () => {
    const m = !isMuted();
    setMuted(m);
    gameRef.current?.setMuted(m);
    setMutedUi(m);
    sfx.select();
  };

  return (
    <div className="relative h-full w-full bg-[#05020e] overflow-hidden crt vignette select-none">
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas
          ref={canvasRef} width={W} height={H}
          className="pixelated max-w-full max-h-full w-full h-full"
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* HUD superior */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-3 flex items-start gap-3 pointer-events-none z-20">
        <SideHud side={1} name={p1.name} title={p1.title} color="#ff3860"
          mainRef={p1Main} ghostRef={p1Ghost} meterRef={p1Meter} readyRef={p1Ready} pipsRef={p1Pips} />
        <div className="shrink-0 text-center">
          <div className="font-display text-[6px] text-[#ff4fd8] tracking-[0.2em] mb-1 text-outline">TORNEO PAJERO V.1</div>
          <div className={`pixel-panel px-3 py-1.5 font-display text-xl ${timer <= 10 ? 'text-[#ff3860]' : 'text-[#ffd23f]'}`}>
            {String(timer).padStart(2, '0')}
          </div>
          <div className="font-display text-[7px] text-[#8f7cc9] mt-1 text-outline">RONDA {round}</div>
        </div>
        <SideHud side={2} name={p2.name} title={mode === 'cpu' ? `${p2.title} · CPU` : p2.title} color="#35e0ff"
          mainRef={p2Main} ghostRef={p2Ghost} meterRef={p2Meter} readyRef={p2Ready} pipsRef={p2Pips} />
      </div>

      {/* contadores de combo */}
      {combos[0] >= 2 && !over && (
        <div key={`c1-${combos[0]}`} className="absolute top-[96px] left-5 z-20 anim-pop pointer-events-none">
          <span className="font-display text-xl text-[#ff3860] text-outline">×{combos[0]}</span>
          <span className="font-display text-[8px] text-[#ffd23f] text-outline ml-2">¡COMBO!</span>
        </div>
      )}
      {combos[1] >= 2 && !over && (
        <div key={`c2-${combos[1]}`} className="absolute top-[96px] right-5 z-20 anim-pop pointer-events-none text-right">
          <span className="font-display text-xl text-[#35e0ff] text-outline">×{combos[1]}</span>
          <span className="font-display text-[8px] text-[#ffd23f] text-outline ml-2">¡COMBO!</span>
        </div>
      )}

      {/* avisos inferiores */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-6 pointer-events-none z-20">
        <span className="font-display text-[7px] text-[#5c4a99]">P1 · A/D/W/S + F·G·H</span>
        {mode === '2p' && <span className="font-display text-[7px] text-[#5c4a99]">P2 · FLECHAS + , · . · /</span>}
        <span className="font-display text-[7px] text-[#5c4a99]">P PAUSA · M SONIDO</span>
      </div>

      {/* botones */}
      <div className="absolute top-3 right-3 z-30 hidden" />
      <button
        onClick={() => { gameRef.current?.setPaused(!paused); sfx.select(); }}
        className="absolute bottom-8 right-3 z-30 pixel-btn pixel-btn--dark text-[8px] px-2.5 py-2 cursor-pointer flex items-center gap-1.5"
      >
        <PauseIcon size={12} />
      </button>
      <button
        onClick={toggleMute}
        className="absolute bottom-8 right-16 z-30 pixel-btn pixel-btn--dark text-[8px] px-2.5 py-2 cursor-pointer flex items-center gap-1.5"
      >
        <SoundIcon size={12} off={mutedUi} />
      </button>

      {/* anunciador */}
      {announce && !over && (
        <div key={announce.id} className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
          <div
            className="anim-slam font-display text-4xl md:text-6xl text-outline text-center px-4"
            style={{ color: KIND_COLOR[announce.kind] }}
          >
            {announce.text}
          </div>
          {announce.sub && (
            <div className="anim-pop font-display text-xs md:text-sm text-[#efe7ff] text-outline mt-4">
              {announce.sub}
            </div>
          )}
        </div>
      )}

      {/* pausa */}
      {paused && !over && (
        <div className="absolute inset-0 z-40 bg-[#05020ecc] flex items-center justify-center">
          <div className="pixel-panel p-6 w-[min(92vw,480px)] anim-pop">
            <h3 className="font-display text-lg text-[#ffd23f] text-outline text-center mb-4">PAUSA</h3>
            <div className="grid grid-cols-2 gap-4 font-body text-[12px] text-[#b9a8e8] mb-5">
              <div>
                <div className="font-display text-[8px] text-[#ff3860] mb-1.5">JUGADOR 1</div>
                A/D mover · W saltar<br />S bloquear<br />F golpe · G patada<br />H especial
              </div>
              <div>
                <div className="font-display text-[8px] text-[#35e0ff] mb-1.5">{mode === 'cpu' ? 'CPU' : 'JUGADOR 2'}</div>
                {mode === '2p' ? <>←/→ mover · ↑ saltar<br />↓ bloquear<br />, golpe · . patada<br />/ especial</> : <>Controlado por la máquina.<br />¡Dale una paliza!</>}
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => { gameRef.current?.setPaused(false); sfx.select(); }} className="pixel-btn text-[9px] px-5 py-3 cursor-pointer">
                ▶ SEGUIR
              </button>
              <button onClick={toggleMute} className="pixel-btn pixel-btn--dark text-[9px] px-4 py-3 cursor-pointer flex items-center gap-2">
                <SoundIcon size={13} off={mutedUi} /> {mutedUi ? 'ACTIVAR' : 'SILENCIAR'}
              </button>
              <button onClick={() => { sfx.back(); onExit(); }} className="pixel-btn pixel-btn--magenta text-[9px] px-4 py-3 cursor-pointer">
                SALIR
              </button>
            </div>
            <div className="font-display text-[7px] text-[#5c4a99] mt-4 text-center">
              PAJAS FIGHTER · CREADO POR <span className="text-[#ff4fd8]">QUE PAJA RECORDS</span>
            </div>
          </div>
        </div>
      )}

      {/* fin de combate */}
      {over && (
        <div className="absolute inset-0 z-50 bg-[#05020ed9] flex items-center justify-center">
          <div className="pixel-panel p-7 w-[min(92vw,440px)] text-center anim-pop">
            <div className="hazard-strip h-2.5 border-2 border-[#060310] mb-5" />
            <div className="font-display text-[10px] text-[#8f7cc9] mb-2">FIN DEL COMBATE</div>
            <h3 className="font-display text-2xl text-[#ffd23f] text-outline mb-1">
              {over.def ? over.def.name : '—'}
            </h3>
            <div className="font-display text-sm text-[#ff4fd8] text-outline mb-5">
              {over.winner === 0 ? '¡EMPATE!' : over.winner === 1 ? '¡VICTORIA DE P1!' : mode === 'cpu' ? 'GANA LA CPU' : '¡VICTORIA DE P2!'}
            </div>
            {over.def && (
              <p className="font-body text-[12.5px] text-[#b9a8e8] mb-6 leading-snug">{over.def.bio}</p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => { sfx.start(); onRematch(); }} className="pixel-btn text-[9px] px-5 py-3 cursor-pointer">
                ⟳ REVANCHA
              </button>
              <button onClick={() => { sfx.select(); onExit(); }} className="pixel-btn pixel-btn--cyan text-[9px] px-5 py-3 cursor-pointer">
                LUCHADORES
              </button>
            </div>
            <div className="hazard-strip h-2.5 border-2 border-[#060310] mt-6" />
            <div className="font-display text-[7px] text-[#5c4a99] mt-3">
              TORNEO PAJERO V.1 · <span className="text-[#ff4fd8]">QUE PAJA RECORDS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
