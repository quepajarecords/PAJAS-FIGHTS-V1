import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HAIR_STYLES,
  type AnimKey, type CharacterDef, type HairStyle, type HitFxKind,
  type Palette, type SpecialKind,
} from '../game/sprites';
import { sfx } from '../game/audio';
import { SpritePreview, BoltIcon, DownloadIcon } from './ui';

// ---------- datos de personalización ----------
const SKINS = ['#f7d7ae', '#f0c08a', '#e0a86e', '#d99a5f', '#c47f4a', '#a3623a', '#8a4f2c', '#6e3d20', '#c9e0d0', '#9fd8c8'];
const HAIRC = ['#23233a', '#111122', '#5a3a1e', '#8a5a2f', '#c98a3a', '#e8c96a', '#d12c2c', '#ff4fd8', '#35e0ff', '#7cff4f', '#efe7ff', '#173f2a'];
const GIS = ['#2f6bff', '#1b9e63', '#d12c2c', '#e07a1f', '#5d2e9e', '#20242c', '#c9a227', '#2ce0c8', '#ff4fd8', '#4a5568', '#7c2168', '#3c7a2e'];
const GI2S = ['#1b3fa6', '#0f6b43', '#8f1d1d', '#9c4f0c', '#3c1d69', '#12151c', '#8a6f1a', '#1a9a8a', '#b32e97', '#333c4a', '#521347', '#27521f'];
const BELTS = ['#ffd23f', '#d12c2c', '#20242c', '#efe7ff', '#2ce0c8', '#8a5a2f', '#7cff4f', '#ff4fd8'];
const FX_COLORS = ['#ffd23f', '#ff3860', '#35e0ff', '#ff4fd8', '#7cff4f', '#ff9b2f', '#efe7ff', '#2ce0c8'];

const HIT_KINDS: { id: HitFxKind; label: string; desc: string }[] = [
  { id: 'chispa', label: 'CHISPA', desc: 'Chispas clásicas al impactar.' },
  { id: 'impacto', label: 'IMPACTO', desc: 'Onda expansiva enorme, más chispas y más temblor.' },
  { id: 'electrico', label: 'ELÉCTRICO', desc: 'Descarga blanca + relámpagos del color de tu energía.' },
];
const SPECIALS: { id: SpecialKind; label: string; desc: string }[] = [
  { id: 'onda', label: 'ONDA', desc: 'La esfera de energía clásica.' },
  { id: 'triple', label: 'TRIPLE', desc: 'Tres ondas en abanico ondulante (60% de daño c/u).' },
  { id: 'gigante', label: 'GIGANTE', desc: 'Orbe enorme y lento que revienta fuerte (160%).' },
  { id: 'rayo', label: 'RAYO', desc: 'Haz ultra veloz y penetrante (80% de daño).' },
];
const ANIMS: { id: AnimKey; label: string }[] = [
  { id: 'idle', label: 'REPOSO' }, { id: 'walk', label: 'CAMINAR' }, { id: 'punch', label: 'GOLPE' },
  { id: 'kick', label: 'PATADA' }, { id: 'special', label: 'ESPECIAL' }, { id: 'hit', label: 'DAÑO' },
  { id: 'block', label: 'BLOQUEO' }, { id: 'ko', label: 'K.O.' }, { id: 'win', label: 'VICTORIA' },
];

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

// ---------- piezas de UI ----------
function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section className="pixel-panel relative p-4 mb-4">
      <span
        className="absolute -top-3 left-3 font-display text-[9px] px-2 py-1 border-2 border-[#060310]"
        style={{ background: color, color: '#0b0618' }}
      >
        {title}
      </span>
      <div className="pt-2">{children}</div>
    </section>
  );
}

function Swatches({ label, colors, value, onChange }: {
  label: string; colors: string[]; value: string; onChange: (c: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="font-display text-[8px] text-[#8f7cc9] mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map(c => (
          <button
            key={c}
            onClick={() => { onChange(c); sfx.select(); }}
            className="w-7 h-7 border-2 cursor-pointer transition-transform hover:scale-110 active:scale-95"
            style={{
              background: c,
              borderColor: value === c ? '#ffd23f' : '#060310',
              boxShadow: value === c ? `0 0 10px ${c}` : 'none',
            }}
            aria-label={label + ' ' + c}
          />
        ))}
      </div>
    </div>
  );
}

function StatSlider({ label, value, min, max, step, color, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number;
  color: string; onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-display text-[8px] text-[#8f7cc9]">{label}</span>
        <span className="font-display text-[9px]" style={{ color }}>{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}

function OptionCard({ active, title, desc, color, onClick }: {
  active: boolean; title: string; desc: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={() => { onClick(); sfx.select(); }}
      className={`pixel-panel p-3 text-left cursor-pointer transition-all hover:-translate-y-0.5 ${active ? '' : 'opacity-70 hover:opacity-100'}`}
      style={{ borderColor: active ? color : '#060310', boxShadow: active ? `0 0 14px ${color}55` : 'none' }}
    >
      <div className="font-display text-[9px] mb-1" style={{ color: active ? color : '#efe7ff' }}>
        {active ? '▶ ' : ''}{title}
      </div>
      <div className="font-body text-[11px] text-[#b9a8e8] leading-snug">{desc}</div>
    </button>
  );
}

// ---------- demo animada de efectos ----------
function FxPreview({ hitKind, hitColor, special, energy }: {
  hitKind: HitFxKind; hitColor: string; special: SpecialKind; energy: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    let raf = 0, t = 0;
    const W2 = cv.width, H2 = cv.height;
    const render = () => {
      t++;
      c.clearRect(0, 0, W2, H2);
      c.fillStyle = 'rgba(10,5,26,0.7)';
      c.fillRect(0, 0, W2, H2);
      c.fillStyle = 'rgba(255,210,63,0.5)';
      c.fillRect(0, H2 - 22, W2, 2);
      c.fillStyle = 'rgba(255,255,255,0.04)';
      for (let y = 6; y < H2; y += 10) c.fillRect(0, y, W2, 2);

      // --- explosión de golpe (ciclo) ---
      const ex = 96, ey = H2 - 62;
      const e = t % 120;
      if (e < 30) {
        const k = e / 30;
        const n = hitKind === 'impacto' ? 20 : 14;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + 0.35;
          const d = k * (hitKind === 'impacto' ? 52 : 40) * (0.6 + ((i * 37) % 10) / 18);
          c.globalAlpha = 1 - k;
          c.fillStyle = i % 3 === 0 ? '#ffffff' : hitColor;
          const s = 3 + (1 - k) * 3;
          c.fillRect(ex + Math.cos(a) * d - s / 2, ey + Math.sin(a) * d - s / 2, s, s);
        }
        c.globalAlpha = (1 - k) * 0.9;
        c.strokeStyle = hitKind === 'electrico' ? '#ffffff' : hitColor;
        c.lineWidth = hitKind === 'impacto' ? 4 : 3;
        c.beginPath(); c.arc(ex, ey, k * (hitKind === 'impacto' ? 58 : 42), 0, Math.PI * 2); c.stroke();
        if (hitKind === 'impacto') {
          c.lineWidth = 2;
          c.beginPath(); c.arc(ex, ey, k * 40, 0, Math.PI * 2); c.stroke();
        }
        if (hitKind === 'electrico') {
          c.strokeStyle = energy;
          c.lineWidth = 2;
          for (let b = 0; b < 3; b++) {
            c.beginPath();
            c.moveTo(ex, ey);
            let px = ex, py = ey;
            const ba = (b / 3) * Math.PI * 2 + t * 0.2;
            for (let seg = 0; seg < 4; seg++) {
              px += Math.cos(ba) * 11 + (Math.random() - 0.5) * 14;
              py += Math.sin(ba) * 11 + (Math.random() - 0.5) * 14;
              c.lineTo(px, py);
            }
            c.stroke();
          }
        }
        c.globalAlpha = 1;
        if (e < 4) {
          c.fillStyle = `rgba(255,255,255,${0.5 - e * 0.12})`;
          c.fillRect(0, 0, W2, H2);
        }
      }
      // --- proyectil especial ---
      const px = 200 + ((t * 3.4) % 340);
      const py = H2 - 58;
      const drawOrb = (x: number, y: number, r: number, big = false) => {
        const gl = c.createRadialGradient(x, y, 1, x, y, r * 2.4);
        gl.addColorStop(0, energy + 'dd');
        gl.addColorStop(1, energy + '00');
        c.fillStyle = gl;
        c.beginPath(); c.arc(x, y, r * 2.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = energy;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(x, y, r * 0.45, 0, Math.PI * 2); c.fill();
        if (big) {
          c.strokeStyle = 'rgba(255,255,255,0.7)';
          c.lineWidth = 2;
          c.beginPath(); c.arc(x, y, r + 4 + Math.sin(t * 0.4) * 2, 0, Math.PI * 2); c.stroke();
        }
      };
      c.save();
      c.shadowColor = energy; c.shadowBlur = 12;
      if (special === 'triple') {
        for (const ph of [-1.35, 0, 1.35]) {
          drawOrb(px, py + Math.sin(t * 0.12 + ph) * 16, 7);
        }
      } else if (special === 'gigante') {
        drawOrb(px, py, 17, true);
      } else if (special === 'rayo') {
        const gl = c.createLinearGradient(0, py - 9, 0, py + 9);
        gl.addColorStop(0, energy + '00');
        gl.addColorStop(0.5, energy + 'f0');
        gl.addColorStop(1, energy + '00');
        c.fillStyle = gl;
        c.fillRect(px - 40, py - 9, 80, 18);
        c.fillStyle = '#ffffff';
        c.fillRect(px - 36, py - 3, 72, 6);
      } else {
        drawOrb(px, py, 10);
      }
      c.restore();

      // etiquetas
      c.font = '8px "Press Start 2P", monospace';
      c.fillStyle = 'rgba(143,124,201,0.9)';
      c.fillText('GOLPE', 74, 18);
      c.fillText('ESPECIAL', px - 26, 18);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [hitKind, hitColor, special, energy]);
  return <canvas ref={ref} width={560} height={130} className="pixelated w-full border-2 border-[#060310]" />;
}

// ---------- pantalla ----------
export function CreatorScreen({ onSave, onBack }: {
  onSave: (def: CharacterDef) => void;
  onBack: () => void;
}) {
  const [pal, setPal] = useState<Palette>({
    skin: '#f0c08a', hair: '#23233a', gi: '#2f6bff', gi2: '#1b3fa6', belt: '#ffd23f',
    boots: '#4a3222', gloves: '#d12c2c', band: '#d12c2c', energy: '#35e0ff', eye: '#141024',
  });
  const [hair, setHair] = useState<HairStyle>('spiky');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [vida, setVida] = useState(100);
  const [fuerza, setFuerza] = useState(1);
  const [velocidad, setVelocidad] = useState(1);
  const [escala, setEscala] = useState(1);
  const [hitKind, setHitKind] = useState<HitFxKind>('chispa');
  const [hitColor, setHitColor] = useState('#ffd23f');
  const [special, setSpecial] = useState<SpecialKind>('onda');
  const [energy, setEnergy] = useState('#35e0ff');
  const [previewAnim, setPreviewAnim] = useState<AnimKey>('idle');

  const set = (k: keyof Palette) => (c: string) => setPal(p => ({ ...p, [k]: c }));

  const def = useMemo<CharacterDef>(() => ({
    id: 'preview',
    name: name.trim().toUpperCase().slice(0, 14) || '???',
    title: title.trim().slice(0, 28) || 'Forjado en el dojo',
    bio: '',
    kind: 'procedural',
    palette: pal, hair,
    stats: { vida: Math.round(vida), fuerza, velocidad },
    scale: escala,
    energyColor: energy,
    hitFx: { kind: hitKind, color: hitColor },
    specialStyle: special,
    isCustom: true,
  }), [pal, hair, name, title, vida, fuerza, velocidad, escala, energy, hitKind, hitColor, special]);

  // mini-previews de peinado (solo dependen de la paleta para no reiniciar canvases en vano)
  const hairDefs = useMemo<CharacterDef[]>(
    () => HAIR_STYLES.map(h => ({
      id: 'hp-' + h.id, name: '', title: '', bio: '', kind: 'procedural' as const,
      palette: pal, hair: h.id, stats: { vida: 100, fuerza: 1, velocidad: 1 },
      scale: 1, energyColor: '#35e0ff', isCustom: false,
    })),
    [pal],
  );

  const randomize = () => {
    sfx.select();
    setPal({
      skin: pick(SKINS), hair: pick(HAIRC), gi: pick(GIS), gi2: pick(GI2S), belt: pick(BELTS),
      boots: pick(['#4a3222', '#20242c', '#2a1b3d', '#122b1d']),
      gloves: pick(['#d12c2c', '#20242c', '#ffd23f', '#122b1d', '#efe7ff']),
      band: pick(BELTS), energy: pick(FX_COLORS), eye: '#141024',
    });
    setHair(pick(HAIR_STYLES).id);
    setVida(60 + Math.round(Math.random() * 180));
    setFuerza(Math.round((0.5 + Math.random() * 1.8) * 20) / 20);
    setVelocidad(Math.round((0.6 + Math.random() * 1.3) * 20) / 20);
    setEscala(Math.round((0.7 + Math.random() * 1.1) * 20) / 20);
    setHitKind(pick(HIT_KINDS).id);
    setHitColor(pick(FX_COLORS));
    setSpecial(pick(SPECIALS).id);
    setEnergy(pick(FX_COLORS));
  };

  const save = () => {
    const finalName = name.trim().toUpperCase().slice(0, 14) || 'LUCHADOR';
    onSave({
      ...def,
      id: `creado-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      name: finalName,
      title: title.trim().slice(0, 28) || 'Forjado en el dojo',
      bio: `Forjado en el creador. ${HIT_KINDS.find(h => h.id === hitKind)?.label} + especial ${SPECIALS.find(s => s.id === special)?.label}.`,
    });
    sfx.win();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-arcade crt vignette flex flex-col select-none">
      {/* cabecera */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b-4 border-[#060310] bg-[#120a28]/80 z-10">
        <button onClick={() => { sfx.back(); onBack(); }} className="pixel-btn pixel-btn--dark text-[9px] px-3 py-2 cursor-pointer">
          ◀ TORNEO
        </button>
        <div className="text-center min-w-0">
          <h2 className="font-display text-sm md:text-xl text-[#7cff4f] text-outline truncate">CREA TU LUCHADOR</h2>
          <div className="font-body text-[10px] text-[#8f7cc9] font-semibold tracking-widest">EDITOR COMPLETO · SE GUARDA EN TU NAVEGADOR</div>
        </div>
        <div className="flex gap-2">
          <button onClick={randomize} className="pixel-btn pixel-btn--cyan text-[8px] px-3 py-2 cursor-pointer flex items-center gap-2">
            <BoltIcon size={12} /> <span className="hidden sm:inline">SORPRÉNDEME</span>
          </button>
          <button onClick={save} className="pixel-btn text-[8px] px-4 py-2 cursor-pointer flex items-center gap-2 anim-glow">
            <DownloadIcon size={12} /> GUARDAR
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
          {/* vista previa */}
          <div className="pixel-panel p-4 lg:sticky lg:top-4">
            <div className="font-display text-[9px] text-[#8f7cc9] mb-2 text-center">VISTA PREVIA EN VIVO</div>
            <div className="flex justify-center">
              <SpritePreview def={def} anim={previewAnim} size={250} bg />
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {ANIMS.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setPreviewAnim(a.id); sfx.select(); }}
                  className={`font-display text-[7px] px-2 py-1.5 border-2 border-[#060310] cursor-pointer transition-colors ${
                    previewAnim === a.id ? 'bg-[#ffd23f] text-[#0b0618]' : 'bg-[#241548] text-[#b9a8e8] hover:bg-[#33205e]'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            {/* placa */}
            <div className="mt-4 border-2 border-[#060310] bg-[#0d0722] p-3 text-center">
              <div className="font-display text-sm text-[#ffd23f] text-outline">{def.name}</div>
              <div className="font-body text-[11px] text-[#b9a8e8] font-semibold">{def.title}</div>
              <div className="flex justify-center gap-2 mt-2">
                <span className="font-display text-[7px] px-2 py-1 border border-[#060310]" style={{ background: hitColor + '33', color: hitColor }}>
                  GOLPE: {HIT_KINDS.find(h => h.id === hitKind)?.label}
                </span>
                <span className="font-display text-[7px] px-2 py-1 border border-[#060310]" style={{ background: energy + '33', color: energy }}>
                  SUPER: {SPECIALS.find(s => s.id === special)?.label}
                </span>
              </div>
            </div>
            {/* demo de efectos */}
            <div className="mt-4">
              <div className="font-display text-[8px] text-[#8f7cc9] mb-2">DEMO DE EFECTOS</div>
              <FxPreview hitKind={hitKind} hitColor={hitColor} special={special} energy={energy} />
            </div>
          </div>

          {/* controles */}
          <div>
            <Section title="IDENTIDAD" color="#ffd23f">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-display text-[8px] text-[#8f7cc9] block mb-1.5">NOMBRE (máx. 14)</span>
                  <input
                    value={name} maxLength={14}
                    onChange={e => setName(e.target.value.toUpperCase())}
                    placeholder="EJ: RAYO"
                    className="w-full bg-[#0d0722] border-2 border-[#060310] px-3 py-2.5 font-display text-[11px] text-[#efe7ff] outline-none focus:border-[#ffd23f] placeholder:text-[#5c4a99]"
                  />
                </label>
                <label className="block">
                  <span className="font-display text-[8px] text-[#8f7cc9] block mb-1.5">TÍTULO</span>
                  <input
                    value={title} maxLength={28}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: El que no perdona"
                    className="w-full bg-[#0d0722] border-2 border-[#060310] px-3 py-2.5 font-body text-[13px] font-semibold text-[#efe7ff] outline-none focus:border-[#ffd23f] placeholder:text-[#5c4a99]"
                  />
                </label>
              </div>
            </Section>

            <Section title="APARIENCIA" color="#ff4fd8">
              <div className="font-display text-[8px] text-[#8f7cc9] mb-2">PEINADO</div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                {HAIR_STYLES.map((h, idx) => (
                  <button
                    key={h.id}
                    onClick={() => { setHair(h.id); sfx.select(); }}
                    className={`pixel-panel p-1.5 cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col items-center ${hair === h.id ? '' : 'opacity-70 hover:opacity-100'}`}
                    style={{ borderColor: hair === h.id ? '#ff4fd8' : '#060310', boxShadow: hair === h.id ? '0 0 12px #ff4fd855' : 'none' }}
                  >
                    <SpritePreview def={hairDefs[idx]} size={58} bg={false} />
                    <span className={`font-display text-[7px] mt-1 ${hair === h.id ? 'text-[#ff4fd8]' : 'text-[#b9a8e8]'}`}>{h.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
                <div>
                  <Swatches label="PIEL" colors={SKINS} value={pal.skin} onChange={set('skin')} />
                  <Swatches label="CABELLO" colors={HAIRC} value={pal.hair} onChange={set('hair')} />
                  <Swatches label="TRAJE" colors={GIS} value={pal.gi} onChange={set('gi')} />
                  <Swatches label="TRAJE (SOMBRA)" colors={GI2S} value={pal.gi2} onChange={set('gi2')} />
                </div>
                <div>
                  <Swatches label="CINTURÓN" colors={BELTS} value={pal.belt} onChange={set('belt')} />
                  <Swatches label="BOTAS" colors={['#4a3222', '#20242c', '#2a1b3d', '#122b1d', '#5a3a1e', '#8a6f1a', '#333c4a', '#8f1d1d']} value={pal.boots} onChange={set('boots')} />
                  <Swatches label="GUANTES" colors={['#d12c2c', '#20242c', '#ffd23f', '#122b1d', '#efe7ff', '#8a5a2f', '#1b3fa6', '#b32e97']} value={pal.gloves} onChange={set('gloves')} />
                  <Swatches label="BANDA / CINTA" colors={BELTS} value={pal.band} onChange={set('band')} />
                </div>
              </div>
            </Section>

            <Section title="ESTADÍSTICAS DE COMBATE" color="#ff3860">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <StatSlider label="VIDA" value={vida} min={40} max={300} step={5} color="#7cff4f" onChange={setVida} fmt={v => `${Math.round(v)} PV`} />
                <StatSlider label="FUERZA" value={fuerza} min={0.4} max={2.5} step={0.05} color="#ff3860" onChange={setFuerza} fmt={v => `×${v.toFixed(2)}`} />
                <StatSlider label="VELOCIDAD" value={velocidad} min={0.5} max={2} step={0.05} color="#35e0ff" onChange={setVelocidad} fmt={v => `×${v.toFixed(2)}`} />
                <StatSlider label="TAMAÑO" value={escala} min={0.5} max={2} step={0.05} color="#ffd23f" onChange={setEscala} fmt={v => `×${v.toFixed(2)}`} />
              </div>
              <p className="font-body text-[11px] text-[#8f7cc9] mt-1">
                Consejo: mucha fuerza y poca vida = cañón de cristal. Equilibra como quieras, es tu luchador.
              </p>
            </Section>

            <Section title="EFECTO DE GOLPE" color="#ff9b2f">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                {HIT_KINDS.map(h => (
                  <OptionCard key={h.id} active={hitKind === h.id} title={h.label} desc={h.desc} color="#ff9b2f" onClick={() => setHitKind(h.id)} />
                ))}
              </div>
              <Swatches label="COLOR DE CHISPAS" colors={FX_COLORS} value={hitColor} onChange={setHitColor} />
            </Section>

            <Section title="SÚPER PODER (con barra llena)" color="#35e0ff">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {SPECIALS.map(s => (
                  <OptionCard key={s.id} active={special === s.id} title={s.label} desc={s.desc} color="#35e0ff" onClick={() => setSpecial(s.id)} />
                ))}
              </div>
              <Swatches label="COLOR DE ENERGÍA" colors={FX_COLORS} value={energy} onChange={setEnergy} />
            </Section>
          </div>
        </div>
      </div>

      {/* barra inferior */}
      <div className="border-t-4 border-[#060310] bg-[#120a28] px-4 py-3 flex items-center justify-between gap-3 z-10">
        <div className="font-body text-[11px] font-bold text-[#8f7cc9] hidden sm:block">
          Al guardar, tu luchador entra al torneo y queda guardado en este navegador.
        </div>
        <button onClick={save} className="pixel-btn text-[10px] px-8 py-3.5 cursor-pointer anim-glow">
          ¡AL TORNEO! ▶
        </button>
      </div>
    </div>
  );
}
