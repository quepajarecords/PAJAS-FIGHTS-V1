// ============================================================
// PAJAS FIGHTER — importador de personajes por carpeta
// Convención de nombres (prefijo + _número.png), en español o inglés:
//   idle_/reposo_  caminar_/walk_  salto_/jump_  golpe_/punch_
//   patada_/kick_  especial_/special_  dano_/hit_  bloquear_/block_
//   ko_  victoria_/win_  +  retrato.png (opcional) y ficha.json (opcional)
// ============================================================

import { ANIM_KEYS, TARGET_H, type AnimKey, type CharacterDef } from './sprites';

const ALIAS: Record<string, AnimKey> = {
  idle: 'idle', reposo: 'idle', parado: 'idle', quieto: 'idle',
  caminar: 'walk', walk: 'walk', andar: 'walk', correr: 'walk', run: 'walk',
  salto: 'jump', saltar: 'jump', jump: 'jump', aire: 'jump',
  golpe: 'punch', punch: 'punch', puno: 'punch', punetazo: 'punch', jab: 'punch',
  patada: 'kick', kick: 'kick', pie: 'kick',
  especial: 'special', special: 'special', poder: 'special', onda: 'special', hadouken: 'special',
  dano: 'hit', hit: 'hit', herido: 'hit', dolor: 'hit', golpeado: 'hit', hurt: 'hit',
  bloquear: 'block', block: 'block', defensa: 'block', guardia: 'block',
  ko: 'ko', caido: 'ko', knocked: 'ko', muerto: 'ko',
  victoria: 'win', win: 'win', triunfo: 'win', ganar: 'win', pose: 'win',
};

const PORTRAIT_NAMES = ['retrato', 'portrait', 'cara', 'face', 'foto'];
const CONFIG_NAMES = ['ficha.json', 'config.json', 'datos.json', 'stats.json', 'ficha.txt'];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)); }

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}

// Recorta la zona con píxeles opacos y normaliza a TARGET_H de alto.
function normalizeFrame(img: HTMLImageElement): HTMLCanvasElement | null {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (w < 2 || h < 2 || w > 4096 || h > 4096) return null;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
  tctx.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try { data = tctx.getImageData(0, 0, w, h).data; } catch { return null; }
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const crop = document.createElement('canvas');
  crop.width = cw; crop.height = ch;
  crop.getContext('2d')!.drawImage(tmp, minX, minY, cw, ch, 0, 0, cw, ch);

  const k = TARGET_H / ch;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cw * k));
  out.height = TARGET_H;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(crop, 0, 0, out.width, out.height);
  return out;
}

interface Fila { state: AnimKey | 'portrait' | 'extra'; index: number; file: File }

function classifyFile(name: string): { state: AnimKey | 'portrait' | 'extra'; index: number } {
  const base = name.replace(/\.[^.]+$/, '');
  const parts = base.split(/[_\-.\s]+/).filter(Boolean).map(norm);
  if (parts.length === 0) return { state: 'extra', index: 0 };
  const first = parts[0];
  if (PORTRAIT_NAMES.includes(first)) return { state: 'portrait', index: 0 };
  const state = ALIAS[first];
  let index = 0;
  for (const p of parts.slice(1)) {
    if (/^\d+$/.test(p)) { index = parseInt(p, 10); break; }
  }
  return { state: state ?? 'extra', index };
}

interface FichaRaw {
  nombre?: string; name?: string; titulo?: string; title?: string; bio?: string;
  vida?: number; hp?: number; health?: number;
  fuerza?: number; force?: number; strength?: number; poder?: number;
  velocidad?: number; speed?: number;
  escala?: number; scale?: number;
  energia?: string; energy?: string; color?: string;
}

const FALLBACK: Record<AnimKey, AnimKey> = {
  idle: 'idle', walk: 'idle', jump: 'idle', punch: 'idle', kick: 'idle',
  special: 'punch', hit: 'idle', block: 'idle', ko: 'hit', win: 'idle',
};

async function buildCharacter(folderName: string, files: File[]): Promise<CharacterDef> {
  const rows: Fila[] = [];
  let configFile: File | null = null;

  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (CONFIG_NAMES.includes(lower)) { configFile = f; continue; }
    if (!/\.(png|gif|webp|jpg|jpeg|bmp)$/i.test(lower)) continue;
    const cls = classifyFile(f.name);
    rows.push({ ...cls, file: f });
  }

  // ficha.json
  let ficha: FichaRaw = {};
  if (configFile) {
    try { ficha = JSON.parse(await configFile.text()) as FichaRaw; } catch { /* ignorar */ }
  }

  // retrato
  let portrait: HTMLCanvasElement | undefined;
  const portraitRow = rows.find(r => r.state === 'portrait');
  if (portraitRow) {
    try {
      const img = await loadImage(portraitRow.file);
      portrait = normalizeFrame(img) ?? undefined;
    } catch { /* sin retrato */ }
  }

  // frames por estado
  const byState = new Map<AnimKey, { index: number; file: File }[]>();
  const extras: { index: number; file: File }[] = [];
  for (const r of rows) {
    if (r.state === 'portrait') continue;
    if (r.state === 'extra') { extras.push({ index: r.index, file: r.file }); continue; }
    const arr = byState.get(r.state) ?? [];
    arr.push({ index: r.index, file: r.file });
    byState.set(r.state, arr);
  }
  if (!byState.has('idle') && extras.length > 0) byState.set('idle', extras);

  if (byState.size === 0) throw new Error(`"${folderName}": no contiene imágenes PNG válidas.`);

  const cache = new Map<File, HTMLCanvasElement | null>();
  const loadState = async (s: AnimKey): Promise<HTMLCanvasElement[]> => {
    const list = (byState.get(s) ?? []).sort((a, b) => a.index - b.index);
    const out: HTMLCanvasElement[] = [];
    for (const item of list) {
      if (!cache.has(item.file)) {
        try {
          const img = await loadImage(item.file);
          cache.set(item.file, normalizeFrame(img));
        } catch { cache.set(item.file, null); }
      }
      const c = cache.get(item.file);
      if (c) out.push(c);
    }
    return out;
  };

  const loaded = new Map<AnimKey, HTMLCanvasElement[]>();
  for (const s of byState.keys()) loaded.set(s, await loadState(s));

  if (!(loaded.get('idle')?.length)) throw new Error(`"${folderName}": necesita al menos un sprite (idle_0.png).`);

  const frames = {} as Record<AnimKey, HTMLCanvasElement[]>;
  for (const k of ANIM_KEYS) {
    const own = loaded.get(k);
    frames[k] = own && own.length > 0 ? own : loaded.get(FALLBACK[k]) ?? loaded.get('idle')!;
  }

  const rawName = ficha.nombre ?? ficha.name ?? (folderName === '_raiz' ? 'LUCHADOR' : folderName);
  const name = String(rawName).replace(/[-_]+/g, ' ').trim().toUpperCase().slice(0, 14) || 'LUCHADOR';

  const vida = clamp(Number(ficha.vida ?? ficha.hp ?? ficha.health ?? 100) || 100, 40, 300);
  const fuerza = clamp(Number(ficha.fuerza ?? ficha.force ?? ficha.strength ?? ficha.poder ?? 1) || 1, 0.4, 2.5);
  const velocidad = clamp(Number(ficha.velocidad ?? ficha.speed ?? 1) || 1, 0.5, 2);
  const escala = clamp(Number(ficha.escala ?? ficha.scale ?? 1) || 1, 0.4, 2.5);
  const energia = ficha.energia ?? ficha.energy ?? ficha.color ?? '#ffd23f';

  return {
    id: `custom-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    name,
    title: String(ficha.titulo ?? ficha.title ?? 'Importado').slice(0, 28),
    bio: String(ficha.bio ?? 'Luchador importado desde carpeta de sprites.').slice(0, 140),
    kind: 'custom',
    frames,
    portrait,
    stats: { vida, fuerza, velocidad },
    scale: escala,
    energyColor: /^#[0-9a-fA-F]{6}$/.test(energia) ? energia : '#ffd23f',
    isCustom: true,
  };
}

export interface ImportResult { defs: CharacterDef[]; errors: string[] }

export async function loadCharactersFromFiles(files: File[]): Promise<ImportResult> {
  const rel = (f: File): string => {
    const anyF = f as File & { relPath?: string };
    return anyF.relPath || f.webkitRelativePath || f.name;
  };

  const groups = new Map<string, File[]>();
  for (const f of files) {
    const path = rel(f).replace(/\\/g, '/');
    const parts = path.split('/');
    const folder = parts.length > 1 ? parts[0] : '_raiz';
    const arr = groups.get(folder) ?? [];
    arr.push(f);
    groups.set(folder, arr);
  }

  const defs: CharacterDef[] = [];
  const errors: string[] = [];
  for (const [folder, list] of groups) {
    try {
      defs.push(await buildCharacter(folder, list));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Error leyendo "${folder}".`);
    }
  }
  return { defs, errors };
}

// Recorre entradas arrastradas (carpetas o archivos) y devuelve Files con ruta relativa.
export async function readDroppedItems(items: DataTransferItemList): Promise<File[]> {
  const out: File[] = [];
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(items)) {
    const anyItem = item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null };
    const e = anyItem.webkitGetAsEntry?.();
    if (e) entries.push(e);
    else if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  const walk = (entry: FileSystemEntry, prefix: string): Promise<void> =>
    new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((f) => {
          const anyF = f as File & { relPath?: string };
          anyF.relPath = prefix + f.name;
          out.push(f);
          resolve();
        }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const readAll = async () => {
          const batch = await new Promise<FileSystemEntry[]>((res) => reader.readEntries(res, () => res([])));
          if (batch.length === 0) { resolve(); return; }
          for (const b of batch) await walk(b, prefix + entry.name + '/');
          await readAll();
        };
        void readAll();
      } else resolve();
    });
  for (const e of entries) await walk(e, '');
  return out;
}
