import { useEffect, useRef } from 'react';
import { type AnimKey, type CharacterDef, FRAME_DUR, animLength, drawCharacter } from '../game/sprites';

// ---------- vista previa animada de un luchador ----------
export function SpritePreview({
  def, anim = 'idle', size = 140, flip = false, bg = true,
}: {
  def: CharacterDef; anim?: AnimKey; size?: number; flip?: boolean; bg?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let tick = 0;
    const render = () => {
      tick++;
      const dur = FRAME_DUR[anim];
      const frame = Math.floor(tick / dur) % animLength(def, anim);
      ctx.clearRect(0, 0, size, size);
      if (bg) {
        ctx.fillStyle = 'rgba(10,5,26,0.55)';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        for (let y = 4; y < size; y += 10) ctx.fillRect(0, y, size, 2);
      }
      ctx.save();
      ctx.translate(size / 2, size * 0.9);
      const k = (size / 165) * (flip ? -1 : 1);
      ctx.scale(k, size / 165);
      drawCharacter(ctx, def, anim, frame, 0, 0, 1);
      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [def, anim, size, flip, bg]);

  return <canvas ref={ref} width={size} height={size} className="pixelated" style={{ width: size, height: size }} />;
}

// ---------- iconos SVG ----------
const base = 'inline-block align-middle';
type IconProps = { size?: number; className?: string };

export const FolderIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <path d="M3 6h6l2 2h10v12H3V6z" fill="currentColor" />
    <path d="M3 6h6l2 2h10v2H3V6z" fill="rgba(255,255,255,0.35)" />
  </svg>
);

export const DownloadIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <path d="M12 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    <path d="M4 17v4h16v-4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
  </svg>
);

export const GamepadIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <path d="M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.2 2L15 15H9l-1.8 2A3 3 0 0 1 2 15v-3a4 4 0 0 1 4-4z" fill="currentColor" />
    <path d="M8 11v3M6.5 12.5h3" stroke="#0b0618" strokeWidth="1.8" />
    <circle cx="16" cy="11.5" r="1.2" fill="#0b0618" />
    <circle cx="18.5" cy="13.5" r="1.2" fill="#0b0618" />
  </svg>
);

export const BoltIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
  </svg>
);

export const CpuIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <rect x="6" y="6" width="12" height="12" fill="currentColor" />
    <rect x="9.5" y="9.5" width="5" height="5" fill="#0b0618" />
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const UsersIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <circle cx="8" cy="8" r="3.4" fill="currentColor" />
    <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6H2z" fill="currentColor" />
    <circle cx="16.5" cy="9" r="2.8" fill="currentColor" opacity="0.75" />
    <path d="M14.5 20c0-2.9 2-5.3 4.8-5.9 1.9.9 3.2 2.9 3.2 5.9h-8z" fill="currentColor" opacity="0.75" />
  </svg>
);

export const SoundIcon = ({ size = 18, className = '', off = false }: IconProps & { off?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
    {off ? (
      <path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
    ) : (
      <path d="M16 8a6 6 0 0 1 0 8M18.5 5.5a10 10 0 0 1 0 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    )}
  </svg>
);

export const SwordsIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <path d="M3 3l7 7M3 3v4M3 3h4M21 3l-7 7m7-7v4m0-4h-4M5 21l6-6m-6 6v-3m0 3h3M19 21l-6-6m6 6v-3m0 3h-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);

export const PauseIcon = ({ size = 18, className = '' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`${base} ${className}`}>
    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
  </svg>
);
