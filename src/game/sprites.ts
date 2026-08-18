// ============================================================
// PAJAS FIGHTER — sistema de sprites
// Personajes procedurales (pixel art dibujado en canvas) +
// soporte para personajes importados (frames PNG por carpeta).
// ============================================================

export type AnimKey =
  | 'idle' | 'walk' | 'jump' | 'punch' | 'kick'
  | 'special' | 'hit' | 'block' | 'ko' | 'win';

export const ANIM_KEYS: AnimKey[] = [
  'idle', 'walk', 'jump', 'punch', 'kick', 'special', 'hit', 'block', 'ko', 'win',
];

export const ANIM_NAMES: Record<AnimKey, string> = {
  idle: 'Reposo', walk: 'Caminar', jump: 'Salto', punch: 'Golpe', kick: 'Patada',
  special: 'Especial', hit: 'Daño', block: 'Bloqueo', ko: 'K.O.', win: 'Victoria',
};

export interface Stats { vida: number; fuerza: number; velocidad: number }

export interface Palette {
  skin: string; hair: string; gi: string; gi2: string;
  belt: string; boots: string; gloves: string; band: string;
  energy: string; eye: string;
}

export type HairStyle = 'spiky' | 'long' | 'band' | 'hood' | 'helmet' | 'mohawk';

export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'spiky', label: 'Picos' },
  { id: 'long', label: 'Largo' },
  { id: 'band', label: 'Cinta' },
  { id: 'hood', label: 'Capucha' },
  { id: 'helmet', label: 'Casco' },
  { id: 'mohawk', label: 'Cresta' },
];

export type HitFxKind = 'chispa' | 'impacto' | 'electrico';
export type SpecialKind = 'onda' | 'triple' | 'gigante' | 'rayo';

export interface HitFx { kind: HitFxKind; color: string }

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  bio: string;
  kind: 'procedural' | 'custom';
  palette?: Palette;
  hair?: HairStyle;
  frames?: Record<AnimKey, HTMLCanvasElement[]>;
  portrait?: HTMLCanvasElement;
  stats: Stats;
  scale: number;
  energyColor: string;
  hitFx?: HitFx;
  specialStyle?: SpecialKind;
  isCustom: boolean;
}

export const TARGET_H = 140; // altura lógica de un luchador en el escenario

export const FRAME_DUR: Record<AnimKey, number> = {
  idle: 9, walk: 6, jump: 10, punch: 4, kick: 5, special: 5,
  hit: 7, block: 8, ko: 7, win: 9,
};

export const LOOP_ANIMS: Record<AnimKey, boolean> = {
  idle: true, walk: true, jump: true, punch: false, kick: false,
  special: false, hit: false, block: true, ko: false, win: true,
};

// ------------------------------------------------------------
// Poses — coordenadas: pies en (0,0), mirando a la derecha, y negativo = arriba
// ------------------------------------------------------------
interface R { x: number; y: number; w: number; h: number }
interface Arm extends R { gx: number; gy: number }
interface Pose {
  bob: number; torsoX: number; headX: number; headY: number;
  legB: R; legF: R; armB: Arm; armF: Arm;
  torsoOv?: R; headOv?: { x: number; y: number };
}

const st = (x: number, y: number, w: number, h: number): R => ({ x, y, w, h });
const ar = (x: number, y: number, w: number, h: number, gx: number, gy: number): Arm =>
  ({ x, y, w, h, gx, gy });

const guardArmF = (): Arm => ar(7, -47, 5, 15, 7, -35);
const guardArmB = (): Arm => ar(-13, -47, 5, 17, -14, -33);
const standLegs = (): { legB: R; legF: R } => ({ legB: st(-9, -24, 6, 24), legF: st(3, -24, 6, 24) });

const basePose = (): Pose => ({
  bob: 0, torsoX: 0, headX: 0, headY: 0,
  ...standLegs(), armB: guardArmB(), armF: guardArmF(),
});

const POSES: Record<AnimKey, Pose[]> = {
  idle: [0, -1, -2, -1].map((bob, i) => ({
    ...basePose(), bob,
    armF: ar(7, -47, 5, 15, 7, -35 - (i % 2)),
  })),
  walk: [
    { ...basePose(), bob: 0, legF: st(3, -24, 6, 24), legB: st(-9, -24, 6, 24), armF: ar(7, -47, 5, 15, 6, -34) },
    { ...basePose(), bob: -1, legF: st(7, -24, 6, 24), legB: st(-5, -24, 6, 24), armF: ar(8, -47, 5, 15, 9, -35) },
    { ...basePose(), bob: -2, legF: st(10, -24, 6, 24), legB: st(-2, -24, 6, 24), armF: ar(9, -47, 5, 15, 11, -36) },
    { ...basePose(), bob: -2, legF: st(3, -24, 6, 24), legB: st(-9, -24, 6, 24), armF: ar(7, -47, 5, 15, 6, -35) },
    { ...basePose(), bob: -1, legF: st(-3, -24, 6, 24), legB: st(-13, -24, 6, 24), armF: ar(6, -47, 5, 15, 4, -34) },
    { ...basePose(), bob: 0, legF: st(0, -24, 6, 24), legB: st(-11, -24, 6, 24), armF: ar(6, -47, 5, 15, 5, -34) },
  ],
  jump: [
    { ...basePose(), bob: -2, legB: st(-9, -22, 6, 16), legF: st(3, -20, 6, 14), armF: ar(7, -52, 5, 12, 8, -54) },
    { ...basePose(), bob: 0, legB: st(-9, -24, 6, 20), legF: st(3, -22, 6, 18), armF: ar(8, -50, 5, 13, 9, -52) },
  ],
  punch: [
    { ...basePose(), bob: -1, torsoX: -2, armF: ar(2, -45, 5, 13, 0, -34) },
    { ...basePose(), bob: 0, torsoX: 3, legF: st(5, -24, 6, 24), armF: ar(8, -45, 22, 6, 29, -46), armB: ar(-14, -44, 5, 15, -15, -31) },
    { ...basePose(), bob: -1, torsoX: 4, legF: st(5, -24, 6, 24), armF: ar(8, -44, 24, 6, 31, -45), armB: ar(-14, -44, 5, 15, -15, -31) },
    { ...basePose(), bob: 0, torsoX: 1, armF: ar(7, -46, 12, 6, 17, -47) },
  ],
  kick: [
    { ...basePose(), bob: -2, legF: st(3, -32, 6, 14) },
    { ...basePose(), bob: -3, torsoX: 2, legF: st(4, -30, 20, 7), armB: ar(-15, -46, 5, 15, -17, -33), armF: ar(5, -46, 5, 14, 4, -33) },
    { ...basePose(), bob: -3, torsoX: 2, legF: st(4, -31, 23, 7), armB: ar(-15, -46, 5, 15, -17, -33), armF: ar(5, -46, 5, 14, 4, -33) },
    { ...basePose(), bob: -2, legF: st(4, -28, 16, 7), armF: ar(6, -46, 5, 14, 5, -33) },
    { ...basePose(), bob: -1, legF: st(3, -24, 6, 24) },
  ],
  special: [
    { ...basePose(), bob: -5, legB: st(-9, -19, 6, 19), legF: st(3, -19, 6, 19), armF: ar(3, -34, 6, 9, 5, -27), armB: ar(-10, -34, 6, 9, -13, -27) },
    { ...basePose(), bob: -7, legB: st(-9, -17, 6, 17), legF: st(3, -17, 6, 17), armF: ar(3, -32, 6, 8, 4, -26), armB: ar(-10, -32, 6, 8, -9, -26) },
    { ...basePose(), bob: -2, torsoX: 3, legB: st(-11, -24, 6, 24), legF: st(6, -24, 6, 24), armF: ar(8, -43, 21, 6, 28, -44), armB: ar(6, -37, 19, 6, 24, -38) },
    { ...basePose(), bob: -2, torsoX: 4, legB: st(-11, -24, 6, 24), legF: st(6, -24, 6, 24), armF: ar(8, -43, 23, 6, 30, -44), armB: ar(6, -37, 21, 6, 26, -38) },
    { ...basePose(), bob: -1, torsoX: 3, legF: st(5, -24, 6, 24), armF: ar(8, -44, 19, 6, 26, -45), armB: ar(6, -38, 17, 6, 22, -39) },
    { ...basePose(), bob: -1, armF: ar(7, -46, 10, 6, 15, -47) },
  ],
  hit: [
    { ...basePose(), bob: -1, torsoX: -3, headX: -3, headY: -1, legF: st(5, -24, 6, 24), armF: ar(5, -42, 5, 14, 9, -31), armB: ar(-12, -44, 5, 15, -16, -34) },
    { ...basePose(), bob: -2, torsoX: -5, headX: -5, headY: 1, legB: st(-11, -24, 6, 24), legF: st(6, -24, 6, 24), armF: ar(5, -41, 5, 14, 11, -29), armB: ar(-12, -43, 5, 15, -17, -32) },
  ],
  block: [
    { ...basePose(), bob: -4, legB: st(-11, -20, 6, 20), legF: st(5, -20, 6, 20), armF: ar(9, -50, 5, 20, 9, -52), armB: ar(4, -48, 5, 18, 4, -50) },
    { ...basePose(), bob: -5, legB: st(-11, -19, 6, 19), legF: st(5, -19, 6, 19), armF: ar(9, -49, 5, 19, 9, -51), armB: ar(4, -47, 5, 17, 4, -49) },
  ],
  ko: [
    { ...basePose(), bob: -2, torsoX: -4, headX: -4, headY: -2, armF: ar(6, -40, 5, 15, 10, -28) },
    { ...basePose(), bob: -8, torsoX: -5, headX: -5, headY: -1, legB: st(-9, -16, 6, 16), legF: st(3, -16, 6, 16), armF: ar(6, -36, 5, 14, 8, -24), armB: ar(-13, -38, 5, 15, -15, -25) },
    { ...basePose(), bob: -11, torsoX: -5, headX: -5, headY: 0, legB: st(-9, -13, 6, 13), legF: st(3, -13, 6, 13), armF: ar(6, -33, 5, 13, 9, -22), armB: ar(-13, -35, 5, 14, -16, -23) },
    { ...basePose(), bob: -12, headY: 3, legB: st(-9, -10, 7, 10), legF: st(4, -10, 7, 10), armF: ar(7, -30, 5, 12, 10, -20), armB: ar(-14, -32, 5, 12, -16, -21) },
    { ...basePose(), bob: 0, torsoOv: st(-13, -13, 27, 9), headOv: { x: -24, y: -12 }, legF: st(12, -7, 20, 6), legB: st(9, -12, 19, 5), armF: ar(-4, -5, 12, 4, 7, -5), armB: ar(-9, -17, 11, 4, -1, -17) },
    { ...basePose(), bob: 0, torsoOv: st(-13, -13, 27, 9), headOv: { x: -24, y: -12 }, legF: st(12, -7, 20, 6), legB: st(9, -12, 19, 5), armF: ar(-4, -4, 12, 4, 7, -4), armB: ar(-9, -17, 11, 4, -1, -17) },
  ],
  win: [
    { ...basePose(), armF: ar(7, -62, 5, 14, 6, -66), armB: ar(-13, -40, 5, 15, -14, -27) },
    { ...basePose(), bob: -3, armF: ar(7, -64, 5, 14, 6, -69), armB: ar(-13, -40, 5, 15, -14, -27) },
    { ...basePose(), bob: -5, headY: -1, armF: ar(7, -66, 5, 14, 6, -71), armB: ar(-13, -40, 5, 15, -14, -27) },
    { ...basePose(), bob: -2, armF: ar(7, -63, 5, 14, 6, -67), armB: ar(-13, -40, 5, 15, -14, -27) },
  ],
};

export function animLength(def: CharacterDef, anim: AnimKey): number {
  if (def.kind === 'custom' && def.frames) return Math.max(1, def.frames[anim].length);
  return POSES[anim].length;
}

// ------------------------------------------------------------
// Dibujo del luchador procedural
// ------------------------------------------------------------
function drawHair(ctx: CanvasRenderingContext2D, p: Palette, style: HairStyle, hx: number, hy: number) {
  ctx.fillStyle = p.hair;
  switch (style) {
    case 'spiky':
      ctx.fillRect(hx - 7, -66 + hy, 14, 5);
      ctx.fillRect(hx - 8, -69 + hy, 4, 4);
      ctx.fillRect(hx - 2, -70 + hy, 4, 5);
      ctx.fillRect(hx + 4, -68 + hy, 4, 3);
      ctx.fillRect(hx - 8, -62 + hy, 3, 9);
      break;
    case 'long':
      ctx.fillRect(hx - 7, -65 + hy, 14, 4);
      ctx.fillRect(hx - 9, -62 + hy, 4, 24);
      ctx.fillRect(hx + 3, -63 + hy, 4, 3);
      break;
    case 'band':
      ctx.fillRect(hx - 6, -64 + hy, 12, 3);
      ctx.fillStyle = p.band;
      ctx.fillRect(hx - 7, -60 + hy, 14, 3);
      ctx.fillRect(hx - 12, -59 + hy, 5, 2);
      ctx.fillRect(hx - 16, -57 + hy, 4, 2);
      break;
    case 'hood':
      ctx.fillStyle = p.gi2;
      ctx.fillRect(hx - 8, -66 + hy, 16, 6);
      ctx.fillRect(hx - 8, -60 + hy, 3, 12);
      ctx.fillRect(hx + 5, -64 + hy, 3, 6);
      break;
    case 'helmet':
      ctx.fillRect(hx - 7, -66 + hy, 14, 8);
      ctx.fillStyle = p.eye;
      ctx.fillRect(hx - 1, -59 + hy, 8, 3);
      break;
    case 'mohawk':
      ctx.fillRect(hx - 1, -72 + hy, 4, 10);
      ctx.fillRect(hx - 3, -66 + hy, 8, 4);
      break;
  }
}

function drawFighterPose(ctx: CanvasRenderingContext2D, p: Palette, hair: HairStyle, pose: Pose) {
  const { bob } = pose;
  ctx.save();
  ctx.translate(0, bob);

  // brazo trasero
  ctx.fillStyle = p.gi2;
  ctx.fillRect(pose.armB.x, pose.armB.y, pose.armB.w, pose.armB.h);
  ctx.fillStyle = p.gloves;
  ctx.fillRect(pose.armB.gx, pose.armB.gy, 6, 6);

  // pierna trasera
  ctx.fillStyle = p.gi2;
  ctx.fillRect(pose.legB.x, pose.legB.y, pose.legB.w, pose.legB.h);
  ctx.fillStyle = p.boots;
  if (pose.legB.w > 10) ctx.fillRect(pose.legB.x + pose.legB.w - 7, pose.legB.y, 7, pose.legB.h);
  else ctx.fillRect(pose.legB.x, -7, pose.legB.w, 7);

  // torso
  if (pose.torsoOv) {
    ctx.fillStyle = p.gi;
    ctx.fillRect(pose.torsoOv.x, pose.torsoOv.y, pose.torsoOv.w, pose.torsoOv.h);
    ctx.fillStyle = p.gi2;
    ctx.fillRect(pose.torsoOv.x + pose.torsoOv.w - 6, pose.torsoOv.y, 6, pose.torsoOv.h);
  } else {
    const tx = pose.torsoX;
    ctx.fillStyle = p.gi;
    ctx.fillRect(tx - 8, -50, 16, 26);
    ctx.fillStyle = p.gi2;
    ctx.fillRect(tx - 8, -50, 16, 5);
    ctx.fillRect(tx - 2, -45, 4, 18);
    ctx.fillStyle = p.belt;
    ctx.fillRect(tx - 8, -27, 16, 4);
    ctx.fillStyle = '#ffe98a';
    ctx.fillRect(tx - 2, -27, 4, 4);
  }

  // pierna delantera
  ctx.fillStyle = p.gi;
  ctx.fillRect(pose.legF.x, pose.legF.y, pose.legF.w, pose.legF.h);
  ctx.fillStyle = p.boots;
  if (pose.legF.w > 10) ctx.fillRect(pose.legF.x + pose.legF.w - 8, pose.legF.y - 1, 8, pose.legF.h + 1);
  else ctx.fillRect(pose.legF.x, -7, pose.legF.w, 7);

  // cabeza
  const headR = pose.headOv
    ? { x: pose.headOv.x, y: pose.headOv.y, w: 11, h: 10 }
    : { x: pose.headX - 6, y: -62 + pose.headY, w: 12, h: 12 };
  ctx.fillStyle = p.skin;
  ctx.fillRect(headR.x, headR.y, headR.w, headR.h);
  drawHair(ctx, p, hair, pose.headOv ? pose.headOv.x + 5 : pose.headX, pose.headOv ? pose.headOv.y + 12 : pose.headY);
  ctx.fillStyle = p.eye;
  ctx.fillRect(headR.x + headR.w - 4, headR.y + 4, 2, 3);

  // brazo delantero
  ctx.fillStyle = p.gi;
  ctx.fillRect(pose.armF.x, pose.armF.y, pose.armF.w, pose.armF.h);
  ctx.fillStyle = p.gloves;
  ctx.fillRect(pose.armF.gx, pose.armF.gy, 7, 7);

  ctx.restore();
}

// Renderiza un frame procedural en su propio canvas (pies abajo-centro).
export function renderProceduralFrame(
  p: Palette, hair: HairStyle, anim: AnimKey, frame: number, px = 2,
): HTMLCanvasElement {
  const poses = POSES[anim];
  const pose = poses[((frame % poses.length) + poses.length) % poses.length];
  const c = document.createElement('canvas');
  c.width = 70 * px; c.height = 76 * px;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate((70 * px) / 2, 72 * px);
  ctx.scale(px, px);
  drawFighterPose(ctx, p, hair, pose);
  return c;
}

// ------------------------------------------------------------
// Dibujo unificado (procedural o importado) sobre el escenario
// x,y = punto de apoyo (pies). facing: 1 derecha, -1 izquierda.
// ------------------------------------------------------------
export function drawCharacter(
  ctx: CanvasRenderingContext2D, def: CharacterDef, anim: AnimKey, frame: number,
  x: number, y: number, facing: 1 | -1,
) {
  ctx.save();
  ctx.translate(x, y);
  const s = (def.kind === 'custom' ? 1 : 2.2) * def.scale;
  ctx.scale(facing * s, s);
  if (def.kind === 'custom' && def.frames) {
    const frames = def.frames[anim];
    const f = frames[((frame % frames.length) + frames.length) % frames.length];
    ctx.drawImage(f, -f.width / 2, -f.height);
  } else if (def.palette && def.hair) {
    const poses = POSES[anim];
    drawFighterPose(ctx, def.palette, def.hair, poses[frame % poses.length]);
  }
  ctx.restore();
}

export function makePortrait(def: CharacterDef, size = 120): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, def.kind === 'custom' ? '#33205e' : def.palette!.gi2);
  g.addColorStop(1, '#0d0722');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // patrón de fondo
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < size; i += 12) ctx.fillRect(0, i, size, 2);
  if (def.kind === 'custom' && def.portrait) {
    const p = def.portrait;
    const k = Math.min(size / p.width, size / p.height) * 0.92;
    ctx.drawImage(p, (size - p.width * k) / 2, (size - p.height * k) / 2, p.width * k, p.height * k);
  } else {
    ctx.translate(size / 2, size * 0.94);
    ctx.scale(1.62, 1.62);
    if (def.palette && def.hair) drawFighterPose(ctx, def.palette, def.hair, POSES.idle[0]);
  }
  return c;
}

// ------------------------------------------------------------
// Plantilla inicial
// ------------------------------------------------------------
const PAL = {
  kai: {
    skin: '#f0c08a', hair: '#23233a', gi: '#2f6bff', gi2: '#1b3fa6', belt: '#ffd23f',
    boots: '#4a3222', gloves: '#d12c2c', band: '#d12c2c', energy: '#35e0ff', eye: '#141024',
  },
  luna: {
    skin: '#f4cf9f', hair: '#ff4fd8', gi: '#5d2e9e', gi2: '#3c1d69', belt: '#2ce0c8',
    boots: '#2a1b3d', gloves: '#ffd23f', band: '#2ce0c8', energy: '#ff4fd8', eye: '#190f28',
  },
  bruto: {
    skin: '#d99a5f', hair: '#8a5a2f', gi: '#e07a1f', gi2: '#9c4f0c', belt: '#20242c',
    boots: '#20242c', gloves: '#20242c', band: '#d12c2c', energy: '#ff9b2f', eye: '#1c1208',
  },
  sombra: {
    skin: '#e8d9c4', hair: '#173f2a', gi: '#256b45', gi2: '#173f2a', belt: '#c9a227',
    boots: '#122b1d', gloves: '#122b1d', band: '#7cff4f', energy: '#7cff4f', eye: '#0d1f14',
  },
} satisfies Record<string, Palette>;

export const BUILT_INS: CharacterDef[] = [
  {
    id: 'kai', name: 'KAI', title: 'El Errante del Norte',
    bio: 'Monje errante que canaliza el trueno azul en sus puños. Equilibrado y letal.',
    kind: 'procedural', palette: PAL.kai, hair: 'spiky',
    stats: { vida: 100, fuerza: 1, velocidad: 1 }, scale: 1,
    energyColor: '#35e0ff', isCustom: false,
  },
  {
    id: 'luna', name: 'LUNA', title: 'Garras de Medianoche',
    bio: 'Asesina veloz del sindicato neón. Frágil, pero nadie la alcanza.',
    kind: 'procedural', palette: PAL.luna, hair: 'long',
    stats: { vida: 85, fuerza: 0.92, velocidad: 1.18 }, scale: 1,
    energyColor: '#ff4fd8', isCustom: false,
  },
  {
    id: 'bruto', name: 'BRUTO', title: 'Muro de Hierro',
    bio: 'Ex campeón del foso. Lento como una avalancha, imparable como ella.',
    kind: 'procedural', palette: PAL.bruto, hair: 'band',
    stats: { vida: 128, fuerza: 1.28, velocidad: 0.86 }, scale: 1.04,
    energyColor: '#ff9b2f', isCustom: false,
  },
  {
    id: 'sombra', name: 'SOMBRA', title: 'Veneno Encapuchado',
    bio: 'Nadie ha visto su rostro. Su energía verde corroe hasta el acero.',
    kind: 'procedural', palette: PAL.sombra, hair: 'hood',
    stats: { vida: 92, fuerza: 0.98, velocidad: 1.1 }, scale: 0.98,
    energyColor: '#7cff4f', isCustom: false,
  },
];
