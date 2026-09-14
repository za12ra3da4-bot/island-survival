// 건축 — 격자 맞춤, 설치 높이, 충돌체, 설치 가능 판정 (서버·클라이언트 공용)
import { STRUCTS } from './config.js';

export const GRID = 3;
export const WALL_H = 2.6;
const HALF_PI = Math.PI / 2;

// floor: 바닥, roof: 지붕, wall: 벽·문·창문·울타리, obj: 나머지 물건
export function layerOf(type) {
  const S = STRUCTS[type];
  if (S.snap === 'floor') return S.roof ? 'roof' : 'floor';
  return S.snap === 'wall' ? 'wall' : 'obj';
}

// 바라보는 방향 → 설치 방향 (격자 조각은 90°, 물건은 45° 단위)
export function snapRot(type, yaw) {
  const step = STRUCTS[type].snap ? HALF_PI : Math.PI / 4;
  return Math.round(yaw / step) * step;
}

// 격자에 맞춘 위치. 바닥·지붕은 칸 가운데, 벽은 칸 경계선 위
export function snapPos(type, x, z, rot) {
  const S = STRUCTS[type];
  const cell = (v) => Math.floor(v / GRID) * GRID + GRID / 2;
  const edge = (v) => Math.round(v / GRID) * GRID;
  if (S.snap === 'floor') return { x: cell(x), z: cell(z) };
  if (S.snap === 'wall') return Math.abs(Math.cos(rot)) > 0.5 ? { x: cell(x), z: edge(z) } : { x: edge(x), z: cell(z) };
  return { x, z };
}

// (x, z) 를 덮는 바닥의 윗면 높이 (없으면 -Infinity)
export function floorTop(cols, x, z) {
  let top = -Infinity;
  cols.query(x, z, 0.1, (c) => {
    if (c.plat === undefined || c.plat <= top) return;
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx * c.cos + dz * c.sin) <= c.hx + 0.01 && Math.abs(-dx * c.sin + dz * c.cos) <= c.hz + 0.01) top = c.plat;
  });
  return top;
}

// 설치물 밑면 높이
export function baseY(type, x, z, rot, T, cols) {
  const S = STRUCTS[type];
  const hAt = (px, pz) => Math.max(T.h(px, pz), floorTop(cols, px, pz));
  if (S.snap === 'floor') {
    const g = GRID / 2 - 0.2;
    let m = T.h(x, z);
    for (const [a, b] of [[g, g], [-g, g], [g, -g], [-g, -g]]) m = Math.max(m, T.h(x + a, z + b));
    m = Math.max(m, 0.05);
    return S.roof ? Math.max(m, floorTop(cols, x, z)) + WALL_H : m;
  }
  if (S.snap === 'wall') {
    const ex = Math.cos(rot) * 1.4, ez = -Math.sin(rot) * 1.4;
    return Math.max(hAt(x, z), hAt(x + ex, z + ez), hAt(x - ex, z - ez));
  }
  return hAt(x, z);
}

// 충돌체. 바닥은 걸어 올라설 수 있는 발판(plat)
export function structCollider(type, x, z, rot, y) {
  const S = STRUCTS[type];
  const cos = Math.cos(rot), sin = -Math.sin(rot);
  if (S.floor) return { x, z, hx: GRID / 2, hz: GRID / 2, cos, sin, plat: y + S.floor };
  if (S.box) return { x, z, hx: S.box[0], hz: S.box[1], cos, sin };
  if (S.r) return { x, z, r: S.r };
  return null;
}

const objR = (type) => {
  const S = STRUCTS[type];
  return S.r || (S.box ? Math.max(S.box[0], S.box[1]) * 0.8 : 0.9);
};

function distToWall(px, pz, x, z, rot) {
  const dx = px - x, dz = pz - z, cos = Math.cos(rot), sin = -Math.sin(rot);
  const lx = dx * cos + dz * sin, lz = -dx * sin + dz * cos;
  return Math.hypot(Math.max(0, Math.abs(lx) - GRID / 2), lz);
}

// 설치할 수 없으면 이유 문자열, 되면 null
export function canPlace(type, x, z, rot, T, cols, structs) {
  const layer = layerOf(type);
  if (Math.hypot(x, z) > 168) return '섬 끝이라 지을 수 없습니다.';
  const h = T.h(x, z), onFloor = floorTop(cols, x, z) > -Infinity;
  if (layer === 'floor') {
    if (h < -1.0) return '물이 너무 깊습니다.';
  } else if (layer !== 'roof') {
    if (h < 0.2 && !onFloor) return '물 위에는 바닥을 먼저 까세요.';
    if (layer === 'obj' && !onFloor && T.slope(x, z) > 0.9) return '땅이 너무 가파릅니다.';
  }
  for (const s of structs) {
    const l2 = layerOf(s.type), d = Math.hypot(s.x - x, s.z - z);
    if (layer === 'floor' || layer === 'roof') {
      if (l2 === layer && d < 0.5) return '이미 지어져 있습니다.';
    } else if (layer === 'wall') {
      if (l2 === 'wall' && d < 0.5 && Math.abs(Math.sin(s.rot - rot)) < 0.5) return '이미 벽이 있습니다.';
      if (l2 === 'obj' && distToWall(s.x, s.z, x, z, rot) < objR(s.type) * 0.8) return '물건이 막고 있습니다.';
    } else if (l2 === 'obj') {
      if (d < (objR(s.type) + objR(type)) * 0.8) return '너무 가깝습니다.';
    } else if (l2 === 'wall' && distToWall(x, z, s.x, s.z, s.rot) < objR(type) * 0.8) {
      return '벽에 너무 가깝습니다.';
    }
  }
  let bad = null;
  cols.query(x, z, 3.5, (c) => {
    if (bad || c.struct || c.plat !== undefined) return;
    const cr = c.r !== undefined ? c.r : Math.max(c.hx, c.hz);
    if (cr <= 0) return;
    if (layer === 'floor') {
      if (Math.abs(c.x - x) < GRID / 2 + cr - 0.25 && Math.abs(c.z - z) < GRID / 2 + cr - 0.25) bad = '나무나 바위가 막고 있습니다.';
    } else if (layer === 'wall') {
      if (distToWall(c.x, c.z, x, z, rot) < cr + 0.1) bad = '나무나 바위가 막고 있습니다.';
    } else if (layer === 'obj' && Math.hypot(c.x - x, c.z - z) < cr + objR(type) * 0.8) {
      bad = '여기에는 놓을 수 없습니다.';
    }
  });
  return bad;
}
