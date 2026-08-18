import { useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ANIM_KEYS, BUILT_INS, makePortrait, renderProceduralFrame,
  type AnimKey, type CharacterDef,
} from '../game/sprites';
import { loadCharactersFromFiles, readDroppedItems } from '../game/loader';
import { sfx, isMuted, setMuted as setAudioMuted } from '../game/audio';
import {
  SpritePreview, FolderIcon, DownloadIcon, GamepadIcon, CpuIcon,
  UsersIcon, BoltIcon, SwordsIcon, SoundIcon,
} from './ui';

const ZIP_PREFIX: Record<AnimKey, string> = {
  idle: 'idle', walk: 'caminar', jump: 'salto', punch: 'golpe', kick: 'patada',
  special: 'especial', hit: 'dano', block: 'bloquear', ko: 'ko', win: 'victoria',
};

const statSegs = (v: number, min: number, max: number) =>
  Math.max(1, Math.min(10, Math.round(((v - min) / (max - min)) * 9) + 1));

function StatBar({ label, segs, color }: { label: string; segs: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-display text-[7px] w-16 text-[#8f7cc9]">{label}</span>
      <div className="flex gap-[3px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 border border-[#060310]"
            style={{ background: i < segs ? color : '#241548' }}
          />
        ))}
      </div>
    </div>
  );
}

function SlotPanel({
  side, def, active, onActivate,
}: {
  side: 1 | 2; def: CharacterDef | null; active: boolean; onActivate: () => void;
}) {
  const color = side === 1 ? '#ff3860' : '#35e0ff';
  return (
    <button
      onClick={onActivate}
      className={`pixel-panel relative w-full md:w-64 p-3 text-left transition-transform cursor-pointer ${
        active ? 'scale-[1.03]' : 'opacity-80 hover:opacity-100'
      }`}
      style={{ borderColor: active ? color : '#060310' }}
    >
      <div
        className="absolute -top-3 left-3 font-display text-[9px] px-2 py-1 border-2 border-[#060310]"
        style={{ background: color, color: '#0b0618' }}
      >
        {side === 1 ? 'P1' : 'P2'} {active ? '· ELIGIENDO' : ''}
      </div>
      {def ? (
        <div className="flex flex-col items-center pt-2">
          <SpritePreview def={def} size={150} flip={side === 2} />
          <div className="font-display text-xs mt-1" style={{ color }}>{def.name}</div>
          <div className="font-body text-[11px] text-[#8f7cc9] font-semibold">{def.title}</div>
          <div className="mt-2 space-y-1">
            <StatBar label="VIDA" segs={statSegs(def.stats.vida, 40, 300)} color="#7cff4f" />
            <StatBar label="FUERZA" segs={statSegs(def.stats.fuerza, 0.4, 2.5)} color="#ff3860" />
            <StatBar label="VELOC." segs={statSegs(def.stats.velocidad, 0.5, 2)} color="#35e0ff" />
          </div>
        </div>
      ) : (
        <div className="h-[268px] flex flex-col items-center justify-center gap-3 text-[#5c4a99]">
          <GamepadIcon size={40} className="opacity-50" />
          <span className="font-display text-[9px] anim-blink">PULSA AQUÍ Y ELIGE</span>
        </div>
      )}
    </button>
  );
}

export function SelectScreen({
  roster, onImport, onStart, onTitle, onOpenCreator,
}: {
  roster: CharacterDef[];
  onImport: (defs: CharacterDef[]) => void;
  onStart: (p1: CharacterDef, p2: CharacterDef, mode: 'cpu' | '2p') => void;
  onTitle: () => void;
  onOpenCreator: () => void;
}) {
  const [p1, setP1] = useState<CharacterDef | null>(null);
  const [p2, setP2] = useState<CharacterDef | null>(null);
  const [slot, setSlot] = useState<1 | 2>(1);
  const [mode, setMode] = useState<'cpu' | '2p'>('cpu');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [muted, setMutedUi] = useState(isMuted());
  const [zipping, setZipping] = useState(false);
  const dirRef = useRef<HTMLInputElement>(null);

  const assign = (def: CharacterDef) => {
    sfx.select();
    if (slot === 1) { setP1(def); setSlot(p2 ? 1 : 2); }
    else { setP2(def); setSlot(p1 ? 2 : 1); }
  };

  const importFiles = async (files: File[]) => {
    if (files.length === 0 || busy) return;
    setBusy(true); setMsg('Leyendo sprites…'); setErrs([]);
    try {
      const res = await loadCharactersFromFiles(files);
      onImport(res.defs);
      setErrs(res.errors);
      if (res.defs.length > 0) {
        setMsg(`¡${res.defs.length} luchador${res.defs.length > 1 ? 'es' : ''} importado${res.defs.length > 1 ? 's' : ''}!`);
        sfx.win();
        if (!p1) { setP1(res.defs[0]); setSlot(2); }
        else if (!p2) setP2(res.defs[0]);
      } else {
        setMsg(null);
      }
    } catch {
      setErrs(['No se pudieron leer los archivos.']);
    }
    setBusy(false);
  };

  const canvasToPngBytes = (c: HTMLCanvasElement): Uint8Array => {
    const url = c.toDataURL('image/png');
    const b64 = url.slice(url.indexOf(',') + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const downloadTemplate = () => {
    if (zipping) return;
    setZipping(true); setErrs([]); setMsg(null); sfx.select();
    try {
      const zip = new JSZip();
      const folder = zip.folder('KaiEjemplo')!;
      const kai = BUILT_INS[0];
      if (!kai.palette || !kai.hair) throw new Error('Sprite base no disponible.');
      for (const anim of ANIM_KEYS) {
        const len = anim === 'idle' ? 4 : anim === 'walk' ? 6 : anim === 'punch' ? 4 : anim === 'kick' ? 5
          : anim === 'special' ? 6 : anim === 'ko' ? 6 : anim === 'win' ? 4 : 2;
        for (let i = 0; i < len; i++) {
          const c = renderProceduralFrame(kai.palette, kai.hair, anim, i, 2);
          folder.file(`${ZIP_PREFIX[anim]}_${i}.png`, canvasToPngBytes(c));
        }
      }
      folder.file('retrato.png', canvasToPngBytes(makePortrait(kai, 160)));
      folder.file('ficha.json', JSON.stringify({
        nombre: 'Kai Ejemplo', titulo: 'Plantilla base', vida: 100,
        fuerza: 1, velocidad: 1, escala: 1, energia: '#35e0ff',
      }, null, 2));
      folder.file('LEEME.txt',
`PAJAS FIGHTER — Torneo Pajero v.1 · plantilla de personaje
============================================================
Creado por Que Paja Records

1) Sustituye estos PNG por tus sprites (misma convención de nombres).
   prefijo_N.png  →  N es el orden del frame (0, 1, 2…)
2) Estados: idle, caminar, salto, golpe, patada, especial,
   dano, bloquear, ko, victoria  (también valen walk, jump,
   punch, kick, special, hit, block, win)
3) Opcional: retrato.png y ficha.json (nombre, titulo, vida,
   fuerza, velocidad, escala, energia).
4) Arrastra la CARPETA a la zona de importación del juego.`);
      void zip.generateAsync({ type: 'blob' }).then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pajas-fighter-plantilla.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        setMsg('Plantilla descargada. Edita los PNG y arrastra la carpeta de vuelta.');
        setZipping(false);
      }).catch(err => {
        setErrs([`No se pudo generar el ZIP: ${String(err)}`]);
        setZipping(false);
      });
    } catch (e) {
      setErrs([`No se pudo generar la plantilla: ${e instanceof Error ? e.message : String(e)}`]);
      setZipping(false);
    }
  };

  const ready = p1 && p2;

  return (
    <div className="relative h-full w-full overflow-hidden bg-arcade crt vignette flex flex-col select-none">
      {/* cabecera */}
      <div className="flex items-center justify-between px-5 py-3 border-b-4 border-[#060310] bg-[#120a28]/80 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => { sfx.back(); onTitle(); }} className="pixel-btn pixel-btn--dark text-[9px] px-3 py-2 cursor-pointer">
            ◀ TÍTULO
          </button>
          <button
            onClick={() => { sfx.select(); onOpenCreator(); }}
            className="pixel-btn pixel-btn--magenta text-[9px] px-3 py-2 cursor-pointer flex items-center gap-2"
          >
            <BoltIcon size={12} /> <span className="hidden sm:inline">CREAR LUCHADOR</span><span className="sm:hidden">CREAR</span>
          </button>
        </div>
        <div className="text-center">
          <h2 className="font-display text-base md:text-xl text-[#ffd23f] text-outline">ELIGE TU LUCHADOR</h2>
          <div className="font-body text-[11px] text-[#8f7cc9] font-semibold tracking-widest">
            TORNEO PAJERO V.1 · {roster.length} EN EL CUADRO · {roster.filter(r => r.isCustom).length} IMPORTADOS
          </div>
        </div>
        <button
          onClick={() => { const m = !muted; setMutedUi(m); setAudioMuted(m); sfx.unlock(); }}
          className="pixel-btn pixel-btn--dark text-[9px] px-3 py-2 cursor-pointer flex items-center gap-2"
        >
          <SoundIcon size={14} off={muted} /> {muted ? 'MUDO' : 'SONIDO'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
          {/* P1 */}
          <div className="anim-rise"><SlotPanel side={1} def={p1} active={slot === 1} onActivate={() => { setSlot(1); sfx.select(); }} /></div>

          {/* VS + modo + start */}
          <div className="flex lg:flex-col items-center justify-center gap-3 order-first lg:order-none anim-rise" style={{ animationDelay: '0.08s' }}>
            <div className="font-display text-3xl text-[#ff4fd8] text-outline anim-float">VS</div>
            <div className="flex lg:flex-col gap-2">
              <button
                onClick={() => { setMode('cpu'); sfx.select(); }}
                className={`pixel-btn text-[8px] px-3 py-2.5 flex items-center gap-2 cursor-pointer ${mode !== 'cpu' ? 'pixel-btn--dark' : ''}`}
              >
                <CpuIcon size={14} /> VS CPU
              </button>
              <button
                onClick={() => { setMode('2p'); sfx.select(); }}
                className={`pixel-btn text-[8px] px-3 py-2.5 flex items-center gap-2 cursor-pointer ${mode !== '2p' ? 'pixel-btn--dark' : ''}`}
              >
                <UsersIcon size={14} /> 2 JUGADORES
              </button>
            </div>
            <button
              onClick={() => {
                const pool = roster;
                const a = pool[Math.floor(Math.random() * pool.length)];
                let b = pool[Math.floor(Math.random() * pool.length)];
                if (pool.length > 1) while (b === a) b = pool[Math.floor(Math.random() * pool.length)];
                setP1(a); setP2(b); sfx.select();
              }}
              className="pixel-btn pixel-btn--cyan text-[8px] px-3 py-2.5 flex items-center gap-2 cursor-pointer"
            >
              <BoltIcon size={14} /> ALEATORIO
            </button>
          </div>

          {/* P2 */}
          <div className="anim-rise" style={{ animationDelay: '0.04s' }}>
            <SlotPanel side={2} def={p2} active={slot === 2} onActivate={() => { setSlot(2); sfx.select(); }} />
          </div>
        </div>

        {/* roster */}
        <div className="max-w-6xl mx-auto px-4 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <SwordsIcon size={18} className="text-[#ffd23f]" />
            <h3 className="font-display text-[11px] text-[#efe7ff] text-outline">CUADRO DEL TORNEO</h3>
            <div className="flex-1 h-[3px] bg-[#241548]" />
            <span className="font-body text-[11px] font-bold text-[#8f7cc9]">
              Asignando a: <span style={{ color: slot === 1 ? '#ff3860' : '#35e0ff' }}>{slot === 1 ? 'P1' : 'P2'}</span>
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {roster.map((def, i) => {
              const selP1 = p1?.id === def.id, selP2 = p2?.id === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => assign(def)}
                  className="pixel-panel group relative p-2 cursor-pointer transition-transform hover:-translate-y-1 anim-rise"
                  style={{ animationDelay: `${0.05 + i * 0.04}s`, borderColor: selP1 ? '#ff3860' : selP2 ? '#35e0ff' : '#060310' }}
                >
                  {(selP1 || selP2) && (
                    <span
                      className="absolute -top-2 -right-2 z-10 font-display text-[8px] px-1.5 py-1 border-2 border-[#060310]"
                      style={{ background: selP1 ? '#ff3860' : '#35e0ff', color: '#0b0618' }}
                    >
                      {selP1 ? 'P1' : ''}{selP1 && selP2 ? '+' : ''}{selP2 ? 'P2' : ''}
                    </span>
                  )}
                  {def.isCustom && (
                    <span className="absolute -top-2 -left-2 z-10 font-display text-[7px] px-1.5 py-1 bg-[#7cff4f] text-[#0b0618] border-2 border-[#060310]">
                      NUEVO
                    </span>
                  )}
                  <div className="flex justify-center overflow-hidden">
                    <SpritePreview def={def} size={104} bg />
                  </div>
                  <div className="text-center mt-1.5">
                    <div className="font-display text-[9px] text-[#efe7ff] group-hover:text-[#ffd23f] transition-colors leading-relaxed">
                      {def.name}
                    </div>
                    <div className="font-body text-[10px] text-[#8f7cc9] font-semibold leading-tight truncate">
                      {def.title}
                    </div>
                  </div>
                </button>
              );
            })}
            {/* tarjeta del creador */}
            <button
              onClick={() => { sfx.select(); onOpenCreator(); }}
              className="pixel-panel p-2 cursor-pointer border-dashed flex flex-col items-center justify-center gap-2 min-h-[150px] text-[#ff4fd8] hover:text-[#ffd23f] hover:-translate-y-1 transition-all"
              style={{ borderStyle: 'dashed', borderColor: '#ff4fd8' }}
            >
              <BoltIcon size={30} />
              <span className="font-display text-[8px] text-center leading-relaxed">CREAR<br />LUCHADOR</span>
            </button>
            {/* tarjeta de importación rápida */}
            <button
              onClick={() => dirRef.current?.click()}
              className="pixel-panel p-2 cursor-pointer border-dashed flex flex-col items-center justify-center gap-2 min-h-[150px] text-[#8f7cc9] hover:text-[#ffd23f] hover:-translate-y-1 transition-all"
              style={{ borderStyle: 'dashed', borderColor: '#4a2f8f' }}
            >
              <FolderIcon size={30} />
              <span className="font-display text-[8px] text-center leading-relaxed">IMPORTAR<br />CARPETA</span>
            </button>
          </div>
        </div>

        {/* importación + guía */}
        <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={async e => {
              e.preventDefault(); setDrag(false);
              const files = await readDroppedItems(e.dataTransfer.items);
              void importFiles(files);
            }}
            className={`pixel-panel p-4 transition-colors ${drag ? 'outline-4 outline-[#7cff4f]' : ''}`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <FolderIcon size={20} className="text-[#7cff4f]" />
              <h3 className="font-display text-[10px] text-[#efe7ff] text-outline">IMPORTAR POR CARPETA</h3>
            </div>
            <p className="font-body text-[12.5px] text-[#b9a8e8] leading-snug mb-3">
              Arrastra aquí la <b className="text-[#ffd23f]">carpeta</b> de tu personaje (o varias a la vez).
              Cada carpeta = un luchador. Los PNG se asignan por nombre: <code className="text-[#35e0ff]">prefijo_0.png</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => dirRef.current?.click()} className="pixel-btn text-[8px] px-3 py-2.5 flex items-center gap-2 cursor-pointer">
                <FolderIcon size={13} /> ELEGIR CARPETA
              </button>
              <button onClick={downloadTemplate} className="pixel-btn pixel-btn--cyan text-[8px] px-3 py-2.5 flex items-center gap-2 cursor-pointer">
                <DownloadIcon size={13} /> {zipping ? 'GENERANDO…' : 'PLANTILLA .ZIP'}
              </button>
            </div>
            <input
              ref={dirRef} type="file" multiple className="hidden"
              {...({ webkitdirectory: '' } as Record<string, string>)}
              onChange={e => { void importFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
            />
            {busy && <div className="mt-3 font-display text-[8px] text-[#ffd23f] anim-blink">PROCESANDO…</div>}
            {msg && !busy && <div className="mt-3 font-body text-[12px] font-bold text-[#7cff4f]">{msg}</div>}
            {errs.length > 0 && (
              <ul className="mt-2 space-y-1">
                {errs.map((er, i) => (
                  <li key={i} className="font-body text-[11.5px] font-semibold text-[#ff3860]">⚠ {er}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="pixel-panel p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <GamepadIcon size={20} className="text-[#35e0ff]" />
              <h3 className="font-display text-[10px] text-[#efe7ff] text-outline">ESTRUCTURA DE ARCHIVOS</h3>
            </div>
            <pre className="font-body text-[11.5px] leading-[1.45] text-[#b9a8e8] bg-[#0d0722] border-2 border-[#060310] p-3 overflow-x-auto">
{`MiLuchador/
├─ ficha.json        (opcional: estadísticas)
├─ retrato.png       (opcional)
├─ idle_0.png … idle_3.png
├─ caminar_0.png …   (o walk_0.png)
├─ salto_0.png       (o jump_)
├─ golpe_0.png …     (o punch_)
├─ patada_0.png …    (o kick_)
├─ especial_0.png …  (o special_)
├─ dano_0.png …      (o hit_)
├─ bloquear_0.png    (o block_)
├─ ko_0.png …
└─ victoria_0.png …  (o win_)`}
            </pre>
            <p className="font-body text-[11px] text-[#8f7cc9] mt-2 leading-snug">
              <b className="text-[#ffd23f]">ficha.json</b>:{' '}
              <code className="text-[#35e0ff]">{'{ "nombre": "Kai", "vida": 100, "fuerza": 1, "velocidad": 1, "escala": 1, "energia": "#35e0ff" }'}</code>.
              Los sprites se recortan y escalan solos; solo el <b>idle</b> es imprescindible.
            </p>
          </div>
        </div>

        {/* controles */}
        <div className="max-w-6xl mx-auto px-4 pb-6">
          <div className="pixel-panel p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <div className="font-display text-[9px] text-[#ff3860] mb-2">JUGADOR 1</div>
              <div className="font-body text-[12px] text-[#b9a8e8] leading-relaxed">
                <b className="text-[#efe7ff]">A / D</b> mover · <b className="text-[#efe7ff]">W</b> saltar · <b className="text-[#efe7ff]">S</b> bloquear<br />
                <b className="text-[#efe7ff]">F</b> golpe · <b className="text-[#efe7ff]">G</b> patada · <b className="text-[#efe7ff]">H</b> especial
              </div>
            </div>
            <div>
              <div className="font-display text-[9px] text-[#35e0ff] mb-2">JUGADOR 2</div>
              <div className="font-body text-[12px] text-[#b9a8e8] leading-relaxed">
                <b className="text-[#efe7ff]">← / →</b> mover · <b className="text-[#efe7ff]">↑</b> saltar · <b className="text-[#efe7ff]">↓</b> bloquear<br />
                <b className="text-[#efe7ff]">,</b> golpe · <b className="text-[#efe7ff]">.</b> patada · <b className="text-[#efe7ff]">/</b> especial
              </div>
            </div>
            <div>
              <div className="font-display text-[9px] text-[#ffd23f] mb-2">SISTEMA</div>
              <div className="font-body text-[12px] text-[#b9a8e8] leading-relaxed">
                <b className="text-[#efe7ff]">P / Esc</b> pausa · <b className="text-[#efe7ff]">M</b> silencio<br />
                El <b className="text-[#ffd23f]">especial</b> dispara una onda de energía con la barra llena.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* barra inferior */}
      <div className="border-t-4 border-[#060310] bg-[#120a28] px-4 py-3 flex items-center justify-between gap-3 z-10">
        <div className="font-body text-[11px] font-bold text-[#8f7cc9] hidden sm:block">
          Mejor de 3 rondas · 60 s por ronda · El bloqueo reduce el daño un 85%
        </div>
        <div className="font-display text-[8px] text-[#5c4a99] hidden md:block">
          CREADO POR <span className="text-[#ff4fd8]">QUE PAJA RECORDS</span>
        </div>
        <button
          disabled={!ready}
          onClick={() => { if (ready) { sfx.start(); onStart(p1, p2, mode); } }}
          className={`pixel-btn text-[11px] px-8 py-3.5 cursor-pointer ${ready ? 'anim-glow' : ''}`}
        >
          ¡PELEAR! ▶
        </button>
      </div>
    </div>
  );
}
