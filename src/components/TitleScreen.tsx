import { useEffect } from 'react';
import { BUILT_INS } from '../game/sprites';
import { sfx, startMusic, stopMusic } from '../game/audio';
import { SpritePreview, GamepadIcon, FolderIcon, SwordsIcon, BoltIcon } from './ui';

export function TitleScreen({ onStart }: { onStart: () => void }) {
  useEffect(() => {
    startMusic('title');
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        sfx.start();
        stopMusic();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); stopMusic(); };
  }, [onStart]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-arcade crt vignette flex flex-col items-center justify-center select-none">
      {/* rejilla de fondo */}
      <div
        className="absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(74,47,143,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(74,47,143,0.8) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 78%)',
        }}
      />

      {/* luchadores en guardia */}
      <div className="absolute bottom-[6%] left-[4%] anim-float" style={{ animationDelay: '0.2s' }}>
        <SpritePreview def={BUILT_INS[0]} size={190} bg={false} />
      </div>
      <div className="absolute bottom-[6%] right-[4%] anim-float" style={{ animationDelay: '0.9s' }}>
        <SpritePreview def={BUILT_INS[2]} size={190} bg={false} flip />
      </div>

      {/* logo */}
      <div className="relative text-center anim-rise">
        <div className="font-display text-[11px] tracking-[0.4em] text-[#35e0ff] text-outline mb-4">
          TORNEO PAJERO - EDICIÓN V.1
        </div>
        <h1 className="font-display leading-none">
          <span className="block text-6xl md:text-8xl text-[#ffd23f] text-outline">PAJAS</span>
          <span className="block text-6xl md:text-8xl text-[#ff3860] text-outline -mt-2 md:-mt-4">
            FIGHTER
          </span>
        </h1>
        <div className="hazard-strip h-3 w-72 md:w-96 mx-auto mt-6 border-2 border-[#060310]" />
      </div>

      {/* sello del estudio */}
      <div className="mt-7 flex items-center gap-3 anim-rise" style={{ animationDelay: '0.15s' }}>
        <span className="h-[3px] w-10 bg-[#4a2f8f]" />
        <div className="text-center">
          <div className="font-body text-[10px] font-bold tracking-[0.35em] text-[#8f7cc9]">CREADO POR</div>
          <div className="font-display text-[11px] md:text-[13px] text-[#ff4fd8] text-outline anim-float inline-block">
            QUE PAJA RECORDS
          </div>
        </div>
        <span className="h-[3px] w-10 bg-[#4a2f8f]" />
      </div>

      {/* insert coin */}
      <button
        onClick={() => { sfx.start(); stopMusic(); onStart(); }}
        className="mt-6 group cursor-pointer bg-transparent border-none"
      >
        <div className="font-display text-sm md:text-lg text-white text-outline anim-blink group-hover:text-[#ffd23f] transition-colors">
          ▶ PULSA ENTER PARA JUGAR
        </div>
      </button>

      {/* fichas informativas */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3 px-6 max-w-3xl">
        <div className="pixel-panel px-4 py-2.5 flex items-center gap-2.5 text-[#ffd23f]">
          <SwordsIcon size={16} />
          <span className="font-body font-semibold text-sm text-[#efe7ff]">Combate al mejor de 3 rondas</span>
        </div>
        <div className="pixel-panel px-4 py-2.5 flex items-center gap-2.5 text-[#35e0ff]">
          <GamepadIcon size={16} />
          <span className="font-body font-semibold text-sm text-[#efe7ff]">1 Jugador vs CPU · 2 Jugadores</span>
        </div>
        <div className="pixel-panel px-4 py-2.5 flex items-center gap-2.5 text-[#ff4fd8]">
          <FolderIcon size={16} />
          <span className="font-body font-semibold text-sm text-[#efe7ff]">Importa luchadores: carpeta + PNG</span>
        </div>
        <div className="pixel-panel px-4 py-2.5 flex items-center gap-2.5 text-[#7cff4f]">
          <BoltIcon size={16} />
          <span className="font-body font-semibold text-sm text-[#efe7ff]">Crea el tuyo: colores, golpes y súper poder</span>
        </div>
      </div>

      {/* marquesina inferior */}
      <div className="absolute bottom-0 left-0 right-0 border-t-4 border-[#060310] bg-[#120a28] overflow-hidden">
        <div className="hazard-strip h-2" />
        <div className="py-2.5 whitespace-nowrap font-display text-[9px] text-[#8f7cc9] tracking-widest">
          <span className="inline-block animate-[pf-marquee-text_22s_linear_infinite]">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="mx-8">
                KAI ★ LUNA ★ BRUTO ★ SOMBRA ★ TORNEO PAJERO V.1 ★ AÑADE LOS TUYOS CON SPRITES PNG ★ GOLPE · PATADA · ESPECIAL ★ QUE PAJA RECORDS ★
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-5 font-display text-[8px] text-[#5c4a99]">V1.0 · CRÉDITOS ∞</div>
      <style>{`@keyframes pf-marquee-text { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
