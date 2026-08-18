import { useCallback, useEffect, useState } from 'react';
import { BUILT_INS, type CharacterDef } from './game/sprites';
import { TitleScreen } from './components/TitleScreen';
import { SelectScreen } from './components/SelectScreen';
import { FightScreen } from './components/FightScreen';
import { CreatorScreen } from './components/CreatorScreen';

type Screen = 'title' | 'select' | 'fight' | 'creator';

const LS_KEY = 'pajas-fighter-creados';

function loadSaved(): CharacterDef[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CharacterDef[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(d => d && d.kind === 'procedural' && d.palette && d.stats && typeof d.name === 'string');
  } catch {
    return [];
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [roster, setRoster] = useState<CharacterDef[]>(() => [...BUILT_INS, ...loadSaved()]);
  const [p1, setP1] = useState<CharacterDef | null>(null);
  const [p2, setP2] = useState<CharacterDef | null>(null);
  const [mode, setMode] = useState<'cpu' | '2p'>('cpu');
  const [fightKey, setFightKey] = useState(0);

  // persistir luchadores creados (procedurales) en el navegador
  useEffect(() => {
    try {
      const saved = roster.filter(r => r.isCustom && r.kind === 'procedural');
      localStorage.setItem(LS_KEY, JSON.stringify(saved));
    } catch { /* almacenamiento lleno o bloqueado: ignorar */ }
  }, [roster]);

  const handleImport = useCallback((defs: CharacterDef[]) => {
    if (defs.length === 0) return;
    setRoster(prev => [...prev.filter(p => !defs.some(d => d.id === p.id)), ...defs]);
  }, []);

  const handleCreated = useCallback((def: CharacterDef) => {
    setRoster(prev => [...prev.filter(p => p.id !== def.id), def]);
    setScreen('select');
  }, []);

  const handleStart = useCallback((a: CharacterDef, b: CharacterDef, m: 'cpu' | '2p') => {
    setP1(a); setP2(b); setMode(m);
    setFightKey(k => k + 1);
    setScreen('fight');
  }, []);

  return (
    <div className="h-full w-full font-body">
      {screen === 'title' && <TitleScreen onStart={() => setScreen('select')} />}
      {screen === 'select' && (
        <SelectScreen
          roster={roster}
          onImport={handleImport}
          onStart={handleStart}
          onTitle={() => setScreen('title')}
          onOpenCreator={() => setScreen('creator')}
        />
      )}
      {screen === 'creator' && (
        <CreatorScreen onSave={handleCreated} onBack={() => setScreen('select')} />
      )}
      {screen === 'fight' && p1 && p2 && (
        <FightScreen
          key={fightKey}
          p1={p1}
          p2={p2}
          mode={mode}
          onRematch={() => setFightKey(k => k + 1)}
          onExit={() => setScreen('select')}
        />
      )}
    </div>
  );
}
