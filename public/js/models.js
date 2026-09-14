// 로우폴리 모델 — 면마다 살짝 다른 색을 칠한 합친 도형(정점 색) + 캐릭터 조립
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { TIER_COLOR, ITEMS } from '../shared/config.js';

const PI = Math.PI;
export const VC = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const geoCache = new Map();
const cached = (key, make) => {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
};

// ── 도형 도구 ─────────────────────────────────────
function jitterVerts(geo, amt, seed = 1) {
  const pos = geo.attributes.position, off = new Map();
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let o = off.get(key);
    if (!o) off.set(key, (o = [rnd() * amt, rnd() * amt, rnd() * amt]));
    pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
  }
  return geo;
}

// geo 를 옮기고 칠한다. t: {x,y,z, rx,ry,rz, sx,sy,sz, s}
export function P(geo, color, t = {}, jitter = 0.12, vj = 0) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (vj) jitterVerts(g, vj, Math.floor(Math.random() * 1e6) + 1);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(t.x || 0, t.y || 0, t.z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0)),
    new THREE.Vector3((t.sx || 1) * (t.s || 1), (t.sy || 1) * (t.s || 1), (t.sz || 1) * (t.s || 1)),
  );
  g.applyMatrix4(m);
  const n = g.attributes.position.count, arr = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (Math.random() - 0.5) * jitter;
    for (let v = 0; v < 3 && i + v < n; v++) {
      arr[(i + v) * 3] = c.r * k;
      arr[(i + v) * 3 + 1] = c.g * k;
      arr[(i + v) * 3 + 2] = c.b * k;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export function M(list) {
  const g = mergeGeometries(list.filter(Boolean), false);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const Cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const Dode = (r) => new THREE.DodecahedronGeometry(r, 0);
const Oct = (r) => new THREE.OctahedronGeometry(r, 0);
const Sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const Cap = (r, l, seg = 8) => new THREE.CapsuleGeometry(r, l, 3, seg);
const shade = (hex, k) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

// ── 자원 노드 ─────────────────────────────────────
export function nodeGeometry(type) {
  return cached(`node:${type}`, () => {
    switch (type) {
      case 'tree': return M([
        P(Cyl(0.2, 0.34, 2.8, 6), '#7a4e2d', { y: 1.4 }, 0.15),
        P(Ico(1.55), '#58bb46', { y: 3.4 }, 0.22, 0.25),
        P(Ico(1.15), '#4aa93c', { x: 0.95, y: 2.85, z: 0.35 }, 0.22, 0.2),
        P(Ico(1.05), '#66c955', { x: -0.85, y: 3.0, z: -0.45 }, 0.22, 0.2),
        P(Ico(0.95), '#74d25f', { x: 0.1, y: 4.35, z: 0.2 }, 0.22, 0.2),
      ]);
      case 'pine': return M([
        P(Cyl(0.17, 0.28, 2.2, 6), '#6b4428', { y: 1.1 }),
        P(Cone(1.75, 2.3, 7), '#2f8f4e', { y: 2.6 }, 0.2, 0.12),
        P(Cone(1.35, 2.0, 7), '#34a058', { y: 3.75 }, 0.2, 0.1),
        P(Cone(0.95, 1.7, 7), '#3eb466', { y: 4.8 }, 0.2, 0.08),
      ]);
      case 'palm': {
        const parts = [];
        let x = 0;
        for (let i = 0; i < 6; i++) {
          parts.push(P(Cyl(0.17 - i * 0.012, 0.2 - i * 0.012, 0.75, 6), i % 2 ? '#a07a4f' : '#8d6a42', { x, y: 0.37 + i * 0.7, rz: -0.08 - i * 0.02 }));
          x += 0.06 + i * 0.02;
        }
        const top = 4.3;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * PI * 2;
          parts.push(P(Box(2.4, 0.06, 0.55), k % 2 ? '#4cc35a' : '#3fb04d', { x: x + Math.cos(a) * 1.05, y: top - 0.3, z: Math.sin(a) * 1.05, ry: -a, rz: -0.45 }, 0.2));
        }
        for (let k = 0; k < 3; k++) parts.push(P(Sph(0.16, 6, 4), '#6b4a2b', { x: x + Math.cos(k * 2.1) * 0.25, y: top - 0.25, z: Math.sin(k * 2.1) * 0.25 }));
        return M(parts);
      }
      case 'bush': {
        const parts = [
          P(Ico(0.85), '#49a83d', { y: 0.55, sy: 0.75 }, 0.2, 0.15),
          P(Ico(0.62), '#58b94a', { x: 0.55, y: 0.45, z: 0.25, sy: 0.8 }, 0.2, 0.1),
          P(Ico(0.55), '#43983a', { x: -0.45, y: 0.4, z: -0.3, sy: 0.8 }, 0.2, 0.1),
        ];
        for (const [x, y, z] of [[0.3, 0.95, 0.4], [-0.4, 0.8, 0.45], [0.7, 0.6, -0.2], [-0.1, 1.05, -0.35], [0.05, 0.6, 0.78], [-0.72, 0.55, 0.05]]) {
          parts.push(P(Sph(0.12, 6, 4), '#e53935', { x, y, z }, 0.1));
        }
        return M(parts);
      }
      case 'rock': return M([
        P(Dode(1), '#9a9894', { y: 0.45, sy: 0.72 }, 0.18, 0.35),
        P(Dode(0.45), '#8a8884', { x: 0.85, y: 0.18, z: 0.35 }, 0.18, 0.15),
      ]);
      case 'iron': {
        const parts = [P(Dode(1), '#8a8580', { y: 0.5, sy: 0.8 }, 0.18, 0.3)];
        for (const [x, y, z] of [[0.55, 0.7, 0.55], [-0.6, 0.55, 0.45], [0.2, 1.05, -0.4], [-0.3, 0.3, -0.8], [0.8, 0.35, -0.2], [0, 1.15, 0.3]]) {
          parts.push(P(Oct(0.2), Math.random() < 0.5 ? '#d27a3a' : '#e3a063', { x, y, z, rx: Math.random() * 3, ry: Math.random() * 3 }, 0.1));
        }
        return M(parts);
      }
      case 'mithril': {
        const parts = [P(Dode(1), '#5d6270', { y: 0.5, sy: 0.8 }, 0.18, 0.3)];
        for (const [x, y, z, rz, rx] of [[0.3, 1.1, 0.2, 0.3, 0.2], [-0.45, 0.9, 0.3, -0.5, 0.1], [0.6, 0.7, -0.4, 0.8, -0.3], [-0.2, 0.85, -0.6, -0.2, -0.6], [0.75, 0.5, 0.5, 0.9, 0.5]]) {
          parts.push(P(Oct(0.26), '#63f0f5', { x, y, z, rz, rx, sy: 2.2 }, 0.2));
        }
        return M(parts);
      }
    }
    return M([P(Box(1, 1, 1), '#ff00ff', { y: 0.5 })]);
  });
}

export function decorGeometry(kind) {
  return cached(`decor:${kind}`, () => {
    if (kind === 'grass') {
      return M([
        P(Cone(0.07, 0.5, 3), '#5fae3f', { y: 0.25, rz: 0.2 }, 0.2),
        P(Cone(0.06, 0.42, 3), '#6dbd4a', { x: 0.1, y: 0.21, rz: -0.3 }, 0.2),
        P(Cone(0.06, 0.38, 3), '#58a23a', { x: -0.08, y: 0.19, z: 0.08, rx: 0.3 }, 0.2),
      ]);
    }
    if (kind === 'flower') {
      return M([
        P(Cyl(0.015, 0.015, 0.35, 3), '#4f9a36', { y: 0.17 }),
        P(Oct(0.09), '#ffffff', { y: 0.38 }, 0),
      ]);
    }
    if (kind === 'pebble') return M([P(Dode(0.18), '#9c9a96', { y: 0.06, sy: 0.6 }, 0.2, 0.05)]);
    if (kind === 'cloud') {
      return M([
        P(Ico(6), '#ffffff', { sy: 0.6 }, 0.06, 1),
        P(Ico(4.5), '#ffffff', { x: 6, y: -0.5, z: 1, sy: 0.6 }, 0.06, 0.8),
        P(Ico(4), '#ffffff', { x: -5.5, y: -0.8, z: -1, sy: 0.6 }, 0.06, 0.7),
        P(Ico(3.2), '#ffffff', { x: 2, y: 2.2, z: -1.5, sy: 0.7 }, 0.06, 0.5),
      ]);
    }
    return null;
  });
}

// ── 상자 ─────────────────────────────────────────
export function buildChest(gold) {
  const body = gold ? '#f0c23b' : '#9b5a2c', band = gold ? '#8d5a1f' : '#d4a93a';
  const g = new THREE.Group();
  const base = new THREE.Mesh(M([
    P(Box(1.0, 0.55, 0.72), body, { y: 0.275 }),
    P(Box(1.04, 0.57, 0.09), band, { y: 0.28, x: 0.33, ry: PI / 2, sx: 0.8 }),
    P(Box(0.1, 0.57, 0.76), band, { y: 0.28, x: 0.33 }),
    P(Box(0.1, 0.57, 0.76), band, { y: 0.28, x: -0.33 }),
    P(Box(0.16, 0.2, 0.06), gold ? '#c0392b' : '#f6d365', { y: 0.45, z: 0.38 }),
  ]), VC);
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.36);
  lid.add(new THREE.Mesh(M([
    P(Box(1.0, 0.22, 0.72), shade(body, 1.08), { y: 0.11, z: 0.36 }),
    P(Box(0.1, 0.24, 0.76), band, { y: 0.11, z: 0.36, x: 0.33 }),
    P(Box(0.1, 0.24, 0.76), band, { y: 0.11, z: 0.36, x: -0.33 }),
  ]), VC));
  g.add(base, lid);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, lid };
}

// ── 설치물 ────────────────────────────────────────
export function buildStruct(type, lv = 1) {
  const g = new THREE.Group();
  const add = (geo) => {
    const m = new THREE.Mesh(geo, VC);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  let flames = null;
  switch (type) {
    case 'workbench': {
      const L = Math.max(1, Math.min(4, lv || 1)), T = L >= 2 ? 1.02 : 0.93; // T: 상판 윗면 높이
      add(cached(`s:workbench:${L}`, () => {
        const parts = [
          P(Box(1.7, 0.14, 0.95), '#b98150', { y: 0.86 }),
          ...[[-0.72, -0.36], [0.72, -0.36], [-0.72, 0.36], [0.72, 0.36]].map(([x, z]) => P(Box(0.12, 0.8, 0.12), '#8a5a33', { x, y: 0.4, z })),
          P(Box(1.5, 0.08, 0.1), '#8a5a33', { y: 0.3, z: 0.36 }),
          P(Box(0.55, 0.02, 0.2), '#cfd4d8', { x: -0.3, y: T + 0.01, z: 0.18, ry: 0.3 }),
          P(Cyl(0.03, 0.03, 0.4, 5), '#6b4428', { x: 0.1, y: T + 0.03, z: -0.2, rz: PI / 2, ry: 0.5 }),
          P(Box(0.1, 0.12, 0.2), '#5b6068', { x: 0.27, y: T + 0.06, z: -0.3, ry: 0.5 }),
        ];
        if (L >= 2) parts.push( // 돌 상판 · 숫돌 · 받침돌
          P(Box(1.82, 0.1, 1.04), '#a3a09a', { y: 0.97 }, 0.18, 0.01),
          P(Cyl(0.2, 0.2, 0.08, 10), '#7d8fa3', { x: -0.62, y: T + 0.24, z: -0.28, rx: PI / 2 }),
          P(Box(0.05, 0.26, 0.05), '#6b4428', { x: -0.62, y: T + 0.13, z: -0.2 }),
          P(Box(0.05, 0.26, 0.05), '#6b4428', { x: -0.62, y: T + 0.13, z: -0.36 }),
          ...[[-0.86, -0.45], [0.86, -0.45], [-0.86, 0.45], [0.86, 0.45]].map(([x, z]) => P(Dode(0.11), '#8e8b87', { x, y: 0.1, z }, 0.2)),
        );
        if (L >= 3) parts.push( // 철 바이스 · 철 테두리
          P(Box(0.3, 0.1, 0.24), '#5b6068', { x: 0.55, y: T + 0.05, z: 0.22 }),
          P(Box(0.08, 0.2, 0.26), '#6f7680', { x: 0.44, y: T + 0.18, z: 0.22 }),
          P(Box(0.08, 0.2, 0.26), '#6f7680', { x: 0.66, y: T + 0.18, z: 0.22 }),
          P(Cyl(0.02, 0.02, 0.3, 5), '#aeb4bb', { x: 0.55, y: T + 0.22, z: 0.4, rx: PI / 2 }),
          P(Box(1.86, 0.06, 0.06), '#aeb4bb', { y: T - 0.01, z: 0.53 }),
          P(Box(1.86, 0.06, 0.06), '#aeb4bb', { y: T - 0.01, z: -0.53 }),
        );
        if (L >= 4) parts.push( // 미스릴 테두리
          P(Box(1.9, 0.05, 0.05), '#5fe3e8', { y: T + 0.03, z: 0.56 }),
          P(Box(1.9, 0.05, 0.05), '#5fe3e8', { y: T + 0.03, z: -0.56 }),
        );
        if (L >= 2) parts.push( // 단계 깃발
          P(Cyl(0.025, 0.025, 1.1, 5), '#6b4428', { x: 0.82, y: T + 0.55, z: -0.44 }),
          P(Box(0.02, 0.26, 0.4), ['', '', '#9c9a95', '#6f7680', '#3fc3cf'][L], { x: 0.82, y: T + 0.95, z: -0.23 }, 0.1),
        );
        return M(parts);
      }));
      if (L >= 4) glowPart(g, 'bench-crystal', () => spiky(0.12, 2.2), 0x5ff1ff, -0.72, T + 0.26, 0.3);
      break;
    }
    case 'campfire': {
      add(cached('s:campfire', () => {
        const parts = [];
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * PI * 2;
          parts.push(P(Dode(0.17), '#8e8b87', { x: Math.cos(a) * 0.6, y: 0.1, z: Math.sin(a) * 0.6 }, 0.2, 0.05));
        }
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * PI;
          parts.push(P(Cyl(0.08, 0.08, 1.0, 6), '#7a4e2d', { y: 0.2, ry: a, rz: PI / 2 - 0.25 }));
        }
        parts.push(P(Cyl(0.3, 0.35, 0.05, 8), '#2a2522', { y: 0.03 }));
        return M(parts);
      }));
      flames = new THREE.Group();
      const f1 = new THREE.Mesh(Cone(0.3, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xff8a1f }));
      f1.position.y = 0.55;
      const f2 = new THREE.Mesh(Cone(0.17, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      f2.position.y = 0.45;
      flames.add(f1, f2);
      g.add(flames);
      break;
    }
    case 'wood_wall': add(cached('s:wood_wall', () => {
      const parts = [];
      for (let k = 0; k < 6; k++) {
        const h = 2.2 + ((k * 37) % 5) * 0.07, x = -1.25 + k * 0.5;
        parts.push(P(Box(0.46, h, 0.3), k % 2 ? '#a8733f' : '#96643a', { x, y: h / 2 }));
        parts.push(P(Cone(0.26, 0.38, 4), '#8a5a33', { x, y: h + 0.19, ry: PI / 4 }));
      }
      parts.push(P(Box(3.05, 0.18, 0.12), '#6f4726', { y: 0.7, z: 0.2 }));
      parts.push(P(Box(3.05, 0.18, 0.12), '#6f4726', { y: 1.7, z: 0.2 }));
      return M(parts);
    }));
      break;
    case 'stone_wall': add(cached('s:stone_wall', () => {
      const parts = [];
      for (let row = 0; row < 4; row++) {
        let x = -1.5 + (row % 2) * 0.25;
        while (x < 1.5) {
          const w = Math.min(1.5 - x, 0.55 + ((row * 7 + Math.round(x * 10)) % 4) * 0.12);
          parts.push(P(Box(w - 0.04, 0.6, 0.55), ['#9a9894', '#8b8985', '#a6a39e'][(row + Math.round(x * 3)) % 3], { x: x + w / 2, y: 0.32 + row * 0.62 }, 0.12, 0.02));
          x += w;
        }
      }
      return M(parts);
    }));
      break;
  }
  return { group: g, flames };
}

// ── 난파선 ────────────────────────────────────────
export function buildBoat() {
  const g = new THREE.Group();
  const mk = (list) => {
    const m = new THREE.Mesh(M(list), VC);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const wreck = mk([
    P(Box(2.2, 0.3, 5.2), '#7a4e2d', { y: 0.2, rz: 0.22, z: -0.6 }),
    P(Box(0.18, 1.0, 3.2), '#8b5a2b', { x: 1.1, y: 0.7, z: -1.2, rz: 0.3 }),
    P(Box(0.18, 0.7, 2.0), '#8b5a2b', { x: -1.15, y: 0.4, z: 0.3, rz: -0.5, rx: 0.2 }),
    P(Box(2.2, 1.0, 0.18), '#8b5a2b', { y: 0.6, z: -3.3, rz: 0.2 }),
    ...[[0.4, 2.1, 0.8], [-1.6, 1.4, 1.2], [1.9, -0.2, 0.3], [0.2, 3.3, 2.1]].map(([x, z, r]) => P(Box(0.3, 0.06, 1.6), '#a0693a', { x, y: 0.1, z, ry: r })),
    P(Cyl(0.12, 0.14, 3.2, 7), '#6b4428', { x: 0.8, y: 0.3, z: 1.6, rz: 1.35, ry: 0.4 }),
  ]);
  const hull = mk([
    P(Box(2.2, 0.35, 7.4), '#7a4e2d', { y: 0.25 }),
    P(Box(0.18, 1.25, 7.0), '#a0693a', { x: 1.13, y: 0.85 }),
    P(Box(0.18, 1.25, 7.0), '#a0693a', { x: -1.13, y: 0.85 }),
    P(Box(0.2, 1.25, 1.9), '#a0693a', { x: 0.62, y: 0.85, z: 4.15, ry: -0.55 }),
    P(Box(0.2, 1.25, 1.9), '#a0693a', { x: -0.62, y: 0.85, z: 4.15, ry: 0.55 }),
    P(Box(2.45, 1.25, 0.2), '#8b5a2b', { y: 0.85, z: -3.55 }),
    ...[-2.5, -1.2, 0.1, 1.4, 2.7].map((z) => P(Box(2.1, 0.07, 0.5), '#b98150', { y: 0.95, z })),
    P(Box(2.3, 0.12, 0.12), '#6b4428', { y: 1.5, z: 1 }),
  ]);
  const frame = mk([
    ...[-2.8, -1.4, 0, 1.4, 2.8].flatMap((z) => [
      P(Box(0.1, 1.4, 0.1), '#c9ced6', { x: 1.25, y: 0.95, z }),
      P(Box(0.1, 1.4, 0.1), '#c9ced6', { x: -1.25, y: 0.95, z }),
      P(Box(2.6, 0.1, 0.1), '#c9ced6', { y: 1.62, z }),
    ]),
    P(Box(0.08, 0.08, 7.2), '#b4bac2', { x: 1.25, y: 1.62 }),
    P(Box(0.08, 0.08, 7.2), '#b4bac2', { x: -1.25, y: 1.62 }),
  ]);
  const mast = mk([
    P(Cyl(0.12, 0.16, 7, 8), '#6b4428', { y: 4.2, z: 0.6 }),
    P(Cyl(0.07, 0.07, 3, 6), '#6b4428', { y: 2.2, z: 0.6, rz: PI / 2 }),
    P(Box(2.9, 3.6, 0.06), '#f3ead2', { y: 4.3, z: 0.75 }, 0.06),
    P(Box(0.4, 0.4, 0.07), '#5fe3e8', { y: 4.5, z: 0.8 }, 0),
    P(Box(0.7, 0.4, 0.03), '#e84a3c', { x: 0.35, y: 7.6, z: 0.6 }),
  ]);
  g.add(wreck, hull, frame, mast);
  return { group: g, wreck, hull, frame, mast };
}

// ── 아이템 (손잡이가 원점, +y 방향으로 뻗음) ───────
export function itemGeometry(id) {
  return cached(`item:${id}`, () => {
    const I = ITEMS[id] || {};
    const tc = TIER_COLOR[I.tier] || '#cccccc';
    switch (I.kind) {
      case 'sword': return M([
        P(Cyl(0.03, 0.03, 0.22, 6), '#5a3a22', { y: 0.1 }),
        P(Sph(0.045, 6, 4), shade(tc, 0.7), { y: -0.02 }),
        P(Box(0.24, 0.05, 0.08), shade(tc, 0.75), { y: 0.23 }),
        P(Box(0.08, 0.62, 0.028), tc, { y: 0.56 }, 0.1),
        P(Cone(0.057, 0.14, 4), tc, { y: 0.94, ry: PI / 4, sz: 0.4 }),
      ]);
      case 'axe': return M([
        P(Cyl(0.03, 0.035, 0.78, 6), '#8a5a33', { y: 0.32 }),
        P(Box(0.24, 0.2, 0.06), tc, { x: 0.12, y: 0.62 }, 0.1),
        P(Box(0.06, 0.28, 0.065), shade(tc, 1.15), { x: 0.25, y: 0.62 }),
        P(Box(0.09, 0.11, 0.06), shade(tc, 0.8), { x: -0.05, y: 0.62 }),
      ]);
      case 'pick': return M([
        P(Cyl(0.03, 0.035, 0.78, 6), '#8a5a33', { y: 0.32 }),
        P(Box(0.4, 0.09, 0.07), tc, { y: 0.68 }, 0.1),
        P(Cone(0.05, 0.22, 4), shade(tc, 1.1), { x: 0.29, y: 0.64, rz: -PI / 2 - 0.35 }),
        P(Cone(0.05, 0.22, 4), shade(tc, 1.1), { x: -0.29, y: 0.64, rz: PI / 2 + 0.35 }),
      ]);
      case 'bow': {
        const arc = new THREE.TorusGeometry(0.46, 0.026, 5, 14, PI * 0.92);
        return M([
          P(arc, '#8a5a33', { x: -0.3, y: 0.0, rz: -PI * 0.46 }),
          P(Cyl(0.006, 0.006, 0.9, 3), '#f2ecdc', { x: 0.14, y: 0.0 }, 0),
          P(Cyl(0.04, 0.04, 0.16, 6), '#3d2a1a', { x: -0.3, y: 0.0 }),
        ]);
      }
    }
    switch (id) {
      case 'apple': return M([P(Sph(0.13, 8, 6), '#e53935', { y: 0.13 }), P(Cyl(0.012, 0.012, 0.08, 4), '#5a3a22', { y: 0.29 }), P(Box(0.08, 0.02, 0.05), '#4caf50', { x: 0.05, y: 0.29, rz: 0.4 })]);
      case 'raw_meat':
      case 'cooked_meat': return M([
        P(Cyl(0.03, 0.03, 0.34, 5), '#f4ecd8', { y: 0.05 }),
        P(Sph(0.045, 5, 4), '#f4ecd8', { y: -0.13 }),
        P(Sph(0.15, 7, 5), id === 'raw_meat' ? '#e57385' : '#9c5a2e', { y: 0.28, sy: 1.25 }, 0.15),
      ]);
      case 'arrow': return M([
        P(Cyl(0.012, 0.012, 0.7, 4), '#c9a26b', { y: 0.35 }),
        P(Cone(0.032, 0.1, 4), '#9aa0a6', { y: 0.75 }),
        P(Box(0.08, 0.14, 0.005), '#f5f5f5', { y: 0.06 }),
      ]);
      case 'wood': return M([P(Cyl(0.12, 0.12, 0.5, 6), '#8a5a33', { y: 0.12, rz: PI / 2 })]);
      case 'stone': return M([P(Dode(0.2), '#9a9894', { y: 0.15 }, 0.2, 0.05)]);
      case 'iron_ore': return M([P(Dode(0.2), '#8a8580', { y: 0.15 }), P(Oct(0.09), '#d27a3a', { x: 0.1, y: 0.25 })]);
      case 'mithril_ore': return M([P(Dode(0.2), '#5d6270', { y: 0.15 }), P(Oct(0.1), '#63f0f5', { x: 0.08, y: 0.28, sy: 1.8 })]);
      case 'iron_armor':
      case 'mithril_armor': return M([
        P(Box(0.4, 0.45, 0.22), id === 'iron_armor' ? '#c9ced6' : '#5fe3e8', { y: 0.22 }),
        P(Box(0.14, 0.12, 0.24), shade(id === 'iron_armor' ? '#c9ced6' : '#5fe3e8', 0.8), { x: 0.24, y: 0.4 }),
        P(Box(0.14, 0.12, 0.24), shade(id === 'iron_armor' ? '#c9ced6' : '#5fe3e8', 0.8), { x: -0.24, y: 0.4 }),
      ]);
      case 'coin': return M([P(Cyl(0.22, 0.22, 0.06, 10), '#f7c948', { rx: PI / 2 }, 0.08), P(Cyl(0.14, 0.14, 0.07, 8), '#e0a92e', { rx: PI / 2 }, 0)]);
    }
    return null;
  });
}

export function buildItem(id) {
  const I = ITEMS[id];
  if (I && I.cat === 'place') {
    const { group } = buildStruct(I.struct);
    const s = I.struct.includes('wall') ? 0.12 : 0.22;
    group.scale.setScalar(s);
    const holder = new THREE.Group();
    holder.add(group);
    return holder;
  }
  const geo = itemGeometry(id);
  const g = new THREE.Group();
  if (geo) g.add(new THREE.Mesh(geo, VC));
  return g;
}

export function projectileGeometry(kind) {
  return cached(`proj:${kind}`, () => {
    if (kind === 2) return M([P(Dode(0.9), '#7d7a76', {}, 0.2, 0.2)]);
    return M([
      P(Cyl(0.015, 0.015, 0.8, 4), kind === 1 ? '#d8d1bf' : '#c9a26b', { rx: PI / 2 }),
      P(Cone(0.035, 0.12, 4), '#8e949b', { z: 0.44, rx: PI / 2 }),
      P(Box(0.1, 0.005, 0.14), '#f5f5f5', { z: -0.34 }),
    ]);
  });
}

// ── 캐릭터 ────────────────────────────────────────
function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function buildPlayer(color) {
  const mat = VC;
  const root = new THREE.Group();
  const bodyG = pivot(root, 0, 0, 0);
  mesh(M([
    P(Cap(0.38, 0.55, 10), color, { y: 0.95 }, 0.08),
    P(Box(0.09, 0.15, 0.04), '#1b1b1b', { x: 0.13, y: 1.18, z: 0.36 }, 0),
    P(Box(0.09, 0.15, 0.04), '#1b1b1b', { x: -0.13, y: 1.18, z: 0.36 }, 0),
    P(Box(0.05, 0.05, 0.02), '#ffffff', { x: 0.15, y: 1.22, z: 0.385 }, 0),
    P(Box(0.05, 0.05, 0.02), '#ffffff', { x: -0.11, y: 1.22, z: 0.385 }, 0),
    P(Box(0.12, 0.04, 0.03), shade(color, 0.6), { y: 1.02, z: 0.37 }, 0),
  ]), mat, bodyG);
  const footL = pivot(root, 0.18, 0.08, 0), footR = pivot(root, -0.18, 0.08, 0);
  const footGeo = cached(`foot:${color}`, () => M([P(Box(0.22, 0.14, 0.34), shade(color, 0.55), { z: 0.04 })]));
  mesh(footGeo, mat, footL);
  mesh(footGeo, mat, footR);
  const handGeo = cached(`hand:${color}`, () => M([P(Sph(0.12, 8, 6), shade(color, 0.85))]));
  const handL = pivot(bodyG, 0.52, 0.9, 0.08), handR = pivot(bodyG, -0.52, 0.9, 0.08);
  mesh(handGeo, mat, handL);
  mesh(handGeo, mat, handR);
  const mount = pivot(handR, 0, 0, 0);
  mount.rotation.x = PI / 2 - 0.3;
  return { root, bodyG, footL, footR, handL, handR, mount };
}

export function buildViewHand(color) {
  const g = new THREE.Group();
  const skin = '#f2c28f', a = 0.35, rx = PI / 2 + a;
  // 주먹(원점)에서 카메라 쪽 아래로 뻗는 팔
  const along = (d) => ({ y: -Math.sin(a) * d, z: Math.cos(a) * d, rx });
  const hand = new THREE.Mesh(cached(`vhand:${color}`, () => M([
    P(Box(0.11, 0.1, 0.13), skin, {}, 0.06, 0.008),
    P(Box(0.116, 0.035, 0.035), shade(skin, 0.88), { y: 0.022, z: -0.062 }, 0.04),
    P(Box(0.04, 0.045, 0.075), shade(skin, 0.93), { x: -0.066, y: -0.006, z: -0.012 }, 0.04),
    P(Cyl(0.045, 0.056, 0.17, 6), shade(skin, 0.95), along(0.15), 0.05),
    P(Cyl(0.078, 0.078, 0.055, 7), shade(color, 0.72), along(0.245), 0.05),
    P(Cyl(0.082, 0.104, 0.52, 7), color, { ...along(0.53), x: 0.01 }, 0.08),
  ])), VC);
  g.add(hand);
  const mount = new THREE.Group();
  g.add(mount);
  return { group: g, hand, mount };
}

const ENEMY_PAL = {
  goblin: { skin: '#6dbb47', dark: '#4d8a33', belly: '#8fd16a', eye: 0xffe14d, cloth: '#7a4e2d', metal: '#8d949c', trim: '#c9a227' },
  king: { skin: '#4e9a33', dark: '#3a7524', belly: '#72b54f', eye: 0xff4a2e, cloth: '#9b1b1b', metal: '#f2c230', trim: '#f2c230' },
  wolf: { fur: '#7f838c', dark: '#5f636b', light: '#b3b7bf', eye: 0xffcf3d, spike: '#5f636b' },
  alpha: { fur: '#2c2c36', dark: '#1a1a21', light: '#4a4a57', eye: 0xff2a2a, spike: '#e9e2cf' },
  golem: { rock: '#8b8f95', dark: '#72767c', light: '#a2a6ad', eye: 0xff8a1f, moss: '#6aa84f' },
  titan: { rock: '#5d6269', dark: '#4a4e55', light: '#737880', eye: 0x5ff1ff, moss: '#3f7f5a' },
};

// 빛나는 조각(눈·룬·수정)은 조명을 받지 않아 밤에도 또렷하다
const glowMats = new Map();
function glowPart(parent, key, makeGeo, color, x, y, z, rot = null) {
  if (!glowMats.has(color)) glowMats.set(color, new THREE.MeshBasicMaterial({ color }));
  const m = new THREE.Mesh(cached(key, makeGeo), glowMats.get(color));
  m.position.set(x, y, z);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}
const Half = (r, w = 8, h = 3) => new THREE.SphereGeometry(r, w, h, 0, PI * 2, 0, PI / 2);
function spiky(r, stretch) {
  const g = Oct(r);
  g.scale(1, stretch, 1);
  return g;
}

export function buildEnemy(type) {
  const root = new THREE.Group();
  const mat = VC.clone();
  mat.emissive = new THREE.Color(0x000000);
  const R = { root, mat, legs: [], arms: [], head: null, body: null, jaw: null, tail: null, cape: null };
  const inner = pivot(root, 0, 0, 0);
  R.inner = inner;

  if (type === 'goblin' || type === 'king') {
    const C = ENEMY_PAL[type], king = type === 'king';
    R.body = pivot(inner, 0, 0, 0);
    mesh(cached(`goblin-body:${type}`, () => M([
      P(Ico(0.42, 1), C.skin, { y: 0.82, sz: 0.92, rx: 0.15 }, 0.1, 0.02),
      P(Ico(0.27, 1), C.belly, { y: 0.74, z: 0.22, sz: 0.5 }, 0.08),
      P(Cyl(0.4, 0.36, 0.14, 8), C.cloth, { y: 0.52 }, 0.1),
      P(Box(0.14, 0.12, 0.06), C.trim, { y: 0.52, z: 0.38 }, 0.05),
      P(Box(0.34, 0.34, 0.05), C.cloth, { y: 0.32, z: 0.26, rx: -0.12 }, 0.12),
      P(Box(0.4, 0.3, 0.05), shade(C.cloth, 0.8), { y: 0.34, z: -0.28, rx: 0.12 }, 0.12),
      P(Box(0.08, 0.72, 0.04), shade(C.cloth, 0.75), { y: 0.86, z: 0.33, rz: 0.75, rx: -0.25 }),
      P(Dode(0.19), C.metal, { x: -0.4, y: 1.08, z: 0.02 }, 0.12, 0.02),
      P(Cone(0.06, 0.22, 4), '#dfe3e8', { x: -0.52, y: 1.27, z: 0.02, rz: 0.5 }),
      ...(king ? [
        P(Dode(0.19), C.metal, { x: 0.4, y: 1.08, z: 0.02 }, 0.12, 0.02),
        P(Cone(0.06, 0.22, 4), '#dfe3e8', { x: 0.52, y: 1.27, z: 0.02, rz: -0.5 }),
        P(Ico(0.3, 0), '#e8dcc0', { y: 1.12, z: -0.05, sy: 0.45, sx: 1.5 }, 0.2, 0.03),
        P(Oct(0.07), '#e53935', { y: 1.0, z: 0.36 }, 0),
      ] : []),
    ])), mat, R.body);
    if (king) {
      R.cape = pivot(R.body, 0, 1.12, -0.32);
      mesh(cached('king-cape', () => M([
        P(Box(0.78, 0.95, 0.05), C.cloth, { y: -0.47 }, 0.1, 0.01),
        P(Box(0.8, 0.07, 0.07), C.trim, { y: -0.94 }),
        P(Box(0.07, 0.95, 0.07), C.trim, { x: 0.38, y: -0.47 }),
        P(Box(0.07, 0.95, 0.07), C.trim, { x: -0.38, y: -0.47 }),
      ])), mat, R.cape);
    }
    R.head = pivot(R.body, 0, 1.3, 0.04);
    mesh(cached(`goblin-head:${type}`, () => M([
      P(Ico(0.33, 1), C.skin, { sy: 0.95 }, 0.1, 0.015),
      P(Box(0.46, 0.08, 0.14), C.dark, { y: 0.11, z: 0.24, rx: 0.2 }, 0.05),
      P(Cone(0.11, 0.62, 4), C.skin, { x: 0.42, y: 0.1, z: -0.06, rz: -PI / 2 + 0.45, ry: 0.35 }, 0.1),
      P(Cone(0.11, 0.62, 4), C.skin, { x: -0.42, y: 0.1, z: -0.06, rz: PI / 2 - 0.45, ry: -0.35 }, 0.1),
      P(Cone(0.075, 0.24, 4), C.dark, { y: -0.02, z: 0.38, rx: PI / 2 + 0.3 }),
      P(Box(0.34, 0.1, 0.2), C.dark, { y: -0.2, z: 0.18 }, 0.08),
      P(Cone(0.035, 0.13, 4), '#fffbe8', { x: 0.11, y: -0.1, z: 0.27 }, 0),
      P(Cone(0.035, 0.13, 4), '#fffbe8', { x: -0.11, y: -0.1, z: 0.27 }, 0),
      ...(king ? [
        P(Cyl(0.26, 0.29, 0.18, 8), C.trim, { y: 0.34 }, 0.08),
        ...[0, 1, 2, 3, 4, 5].map((k) => P(Cone(0.06, 0.22, 4), C.trim, { x: Math.cos(k * 1.047) * 0.25, y: 0.53, z: Math.sin(k * 1.047) * 0.25 })),
        P(Oct(0.065), '#e53935', { y: 0.36, z: 0.28 }, 0),
        P(Oct(0.05), '#4d96ff', { x: 0.2, y: 0.35, z: 0.19 }, 0),
        P(Oct(0.05), '#6bcb77', { x: -0.2, y: 0.35, z: 0.19 }, 0),
      ] : [
        P(Half(0.35), C.metal, { y: 0.06, sy: 0.9, rx: -0.12 }, 0.1),
        P(Cone(0.05, 0.24, 4), '#dfe3e8', { y: 0.42, z: -0.03 }),
      ]),
    ])), mat, R.head);
    for (const s of [1, -1]) glowPart(R.head, 'eye-goblin', () => Box(0.1, 0.055, 0.03), C.eye, s * 0.12, 0.03, 0.31, [0, 0, s * 0.3]);
    for (const s of [1, -1]) {
      const leg = pivot(inner, s * 0.17, 0.45, 0);
      mesh(cached(`goblin-leg:${type}`, () => M([
        P(Box(0.17, 0.3, 0.2), C.dark, { y: -0.15 }, 0.08),
        P(Box(0.2, 0.14, 0.3), '#5a3a22', { y: -0.38, z: 0.04 }, 0.08),
      ])), mat, leg);
      R.legs.push(leg);
      const arm = pivot(R.body, s * 0.43, 1.0, 0.04);
      mesh(cached(`goblin-arm:${type}`, () => M([
        P(Box(0.13, 0.36, 0.14), C.skin, { y: -0.17 }, 0.08),
        P(Box(0.15, 0.08, 0.16), C.cloth, { y: -0.32 }),
        P(Ico(0.1, 0), C.skin, { y: -0.44 }, 0.08),
      ])), mat, arm);
      R.arms.push(arm);
    }
    mesh(cached(`goblin-weapon:${type}`, () => M(king ? [
      P(Cyl(0.045, 0.06, 1.0, 6), '#5a3a22', { y: -0.44, z: 0.38, rx: PI / 2 }),
      P(Box(0.1, 0.1, 0.1), C.trim, { y: -0.44, z: 0.06 }),
      P(Ico(0.2, 0), '#6f7680', { y: -0.44, z: 0.92 }, 0.15, 0.03),
      ...[[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1]].map(([x, y, z]) => P(Cone(0.06, 0.2, 4), '#dfe3e8', {
        x: x * 0.2, y: -0.44 + y * 0.2, z: 0.92 + z * 0.2, rx: z ? PI / 2 : 0, rz: x ? -x * PI / 2 : y < 0 ? PI : 0,
      })),
    ] : [
      P(Cyl(0.035, 0.04, 0.42, 5), '#5a3a22', { y: -0.44, z: 0.2, rx: PI / 2 }),
      P(Box(0.06, 0.08, 0.08), '#6b4428', { y: -0.44, z: 0.0 }),
      P(Box(0.04, 0.3, 0.46), '#9aa1a9', { y: -0.36, z: 0.6 }, 0.1),
      P(Box(0.045, 0.05, 0.46), '#dfe3e8', { y: -0.52, z: 0.6 }),
    ])), mat, R.arms[1]);
    if (king) root.scale.setScalar(3);
  } else if (type === 'wolf' || type === 'alpha') {
    const C = ENEMY_PAL[type], alpha = type === 'alpha';
    R.body = pivot(inner, 0, 0, 0);
    mesh(cached(`wolf-body:${type}`, () => M([
      P(Box(0.6, 0.6, 0.6), C.fur, { y: 0.78, z: 0.22 }, 0.12, 0.06),
      P(Box(0.5, 0.48, 0.62), C.fur, { y: 0.72, z: -0.3 }, 0.12, 0.05),
      P(Box(0.44, 0.2, 0.9), C.light, { y: 0.5 }, 0.1, 0.03),
      P(Box(0.66, 0.5, 0.36), C.dark, { y: 0.92, z: 0.42, rx: -0.3 }, 0.15, 0.06),
      ...[0, 1, 2, 3, 4, 5].map((k) => P(Cone(k < 2 ? 0.09 : 0.07, 0.28 - k * 0.025, 4), C.spike, { y: 1.12 - k * 0.05, z: 0.38 - k * 0.17, rx: -0.5 })),
      ...(alpha ? [P(Box(0.64, 0.08, 0.34), '#3d4148', { y: 1.1, z: 0.2 }, 0.1)] : []),
    ])), mat, R.body);
    if (alpha) for (const s of [1, -1]) for (const [y, z] of [[0.86, 0.3], [0.72, 0.14]]) glowPart(R.body, 'wolf-rune', () => Box(0.02, 0.05, 0.3), C.eye, s * 0.305, y, z, [0.5, 0, 0]);
    R.head = pivot(R.body, 0, 1.0, 0.55);
    mesh(cached(`wolf-head:${type}`, () => M([
      P(Box(0.44, 0.4, 0.4), C.fur, {}, 0.12, 0.03),
      P(Box(0.5, 0.26, 0.3), C.dark, { y: -0.04, z: -0.12 }, 0.12, 0.04),
      P(Box(0.24, 0.17, 0.36), C.light, { y: -0.06, z: 0.34 }, 0.08),
      P(Box(0.12, 0.08, 0.07), '#151515', { y: 0.02, z: 0.52 }, 0),
      P(Cone(0.1, 0.3, 4), C.dark, { x: 0.14, y: 0.3, z: -0.08, rz: -0.2 }),
      P(Cone(0.1, 0.3, 4), C.dark, { x: -0.14, y: 0.3, z: -0.08, rz: 0.2 }),
      P(Box(0.46, 0.06, 0.1), C.dark, { y: 0.14, z: 0.2, rx: 0.25 }),
      P(Cone(0.03, 0.11, 4), '#fffbe8', { x: 0.08, y: -0.19, z: 0.44, rx: PI }, 0),
      P(Cone(0.03, 0.11, 4), '#fffbe8', { x: -0.08, y: -0.19, z: 0.44, rx: PI }, 0),
      ...(alpha ? [P(Box(0.03, 0.2, 0.03), '#e9e2cf', { x: 0.16, y: 0.12, z: 0.21, rz: 0.4 }, 0)] : []),
    ])), mat, R.head);
    R.jaw = pivot(R.head, 0, -0.14, 0.2);
    mesh(cached(`wolf-jaw:${type}`, () => M([
      P(Box(0.2, 0.08, 0.3), C.light, { y: -0.03, z: 0.14 }),
      P(Cone(0.025, 0.08, 4), '#fffbe8', { x: 0.07, y: 0.04, z: 0.26 }, 0),
      P(Cone(0.025, 0.08, 4), '#fffbe8', { x: -0.07, y: 0.04, z: 0.26 }, 0),
    ])), mat, R.jaw);
    for (const s of [1, -1]) glowPart(R.head, 'eye-wolf', () => Box(0.09, 0.045, 0.03), C.eye, s * 0.12, 0.08, 0.205, [0, 0, s * 0.3]);
    R.tail = pivot(R.body, 0, 0.88, -0.6);
    mesh(cached(`wolf-tail:${type}`, () => M([
      P(Cone(0.13, 0.62, 5), C.fur, { y: -0.05, z: -0.26, rx: -2.0 }, 0.12, 0.03),
      P(Cone(0.07, 0.2, 5), alpha ? '#b3202a' : C.light, { y: -0.19, z: -0.55, rx: -2.0 }),
    ])), mat, R.tail);
    for (const [x, z] of [[0.2, 0.36], [-0.2, 0.36], [0.19, -0.4], [-0.19, -0.4]]) {
      const leg = pivot(inner, x, 0.58, z);
      mesh(cached(`wolf-leg:${type}`, () => M([
        P(Box(0.16, 0.36, 0.18), C.fur, { y: -0.16 }, 0.1),
        P(Box(0.11, 0.26, 0.11), C.dark, { y: -0.42 }),
        P(Box(0.15, 0.07, 0.18), C.dark, { y: -0.55, z: 0.03 }),
      ])), mat, leg);
      R.legs.push(leg);
    }
    if (alpha) root.scale.setScalar(3);
  } else if (type === 'golem' || type === 'titan') {
    const C = ENEMY_PAL[type], titan = type === 'titan';
    R.body = pivot(inner, 0, 0, 0);
    mesh(cached(`golem-body:${type}`, () => M([
      P(Dode(0.8), C.rock, { y: 1.45, sz: 0.78 }, 0.25, 0.12),
      P(Dode(0.5), C.dark, { y: 0.92, sx: 1.2, sz: 0.9 }, 0.2, 0.08),
      P(Dode(0.28), C.light, { x: 0.42, y: 1.62, z: 0.44 }, 0.2, 0.05),
      P(Dode(0.26), C.light, { x: -0.42, y: 1.56, z: 0.46 }, 0.2, 0.05),
      P(Dode(0.42), C.dark, { x: 0.78, y: 1.95, sy: 0.8 }, 0.2, 0.06),
      P(Dode(0.42), C.dark, { x: -0.78, y: 1.95, sy: 0.8 }, 0.2, 0.06),
      P(Ico(0.2), C.moss, { x: 0.8, y: 2.25, z: -0.05, sy: 0.5 }, 0.2),
      P(Ico(0.16), C.moss, { x: -0.3, y: 2.12, z: -0.35, sy: 0.6 }, 0.2),
      P(Ico(0.14), C.moss, { x: -0.85, y: 2.2, z: 0.1, sy: 0.5 }, 0.2),
      ...(titan ? [] : [
        P(Cone(0.03, 0.22, 3), '#7ed957', { x: 0.75, y: 2.4 }),
        P(Cone(0.03, 0.18, 3), '#7ed957', { x: 0.86, y: 2.36, z: -0.08, rz: -0.4 }),
      ]),
    ])), mat, R.body);
    glowPart(R.body, 'golem-rune-v', () => Box(0.06, 0.52, 0.04), C.eye, 0.02, 1.4, 0.64, [0, 0, 0.15]);
    glowPart(R.body, 'golem-rune-h', () => Box(0.34, 0.05, 0.04), C.eye, 0.02, 1.5, 0.63, [0, 0, -0.25]);
    if (titan) {
      [[0.3, 2.1, -0.45, 0.35, -0.5], [-0.35, 2.0, -0.5, -0.4, -0.5], [0, 2.3, -0.4, 0, -0.35], [0.85, 2.25, -0.1, 0.8, -0.2], [-0.85, 2.2, -0.1, -0.8, -0.2]]
        .forEach(([x, y, z, rz, rx], k) => glowPart(R.body, `titan-crystal${k % 2}`, () => spiky(k % 2 ? 0.16 : 0.2, 2.6), C.eye, x, y, z, [rx, 0, rz]));
    }
    R.head = pivot(R.body, 0, 2.3, 0.12);
    mesh(cached(`golem-head:${type}`, () => M([
      P(Dode(0.4), C.light, { sy: 0.85 }, 0.25, 0.07),
      P(Box(0.62, 0.14, 0.2), C.dark, { y: 0.14, z: 0.25 }, 0.2, 0.02),
    ])), mat, R.head);
    glowPart(R.head, 'golem-eye', () => Box(0.42, 0.07, 0.05), C.eye, 0, 0, 0.36);
    for (const s of [1, -1]) {
      const arm = pivot(R.body, s * 0.98, 1.9, 0);
      mesh(cached(`golem-arm:${type}`, () => M([
        P(Dode(0.3), C.dark, { y: -0.3 }, 0.2, 0.06),
        P(Dode(0.34), C.rock, { y: -0.78 }, 0.2, 0.06),
        P(Dode(0.48), C.light, { y: -1.25, sx: 1.05 }, 0.2, 0.08),
      ])), mat, arm);
      if (titan) for (const [kx, kz] of [[0.18, 0.3], [-0.12, 0.34]]) glowPart(arm, 'titan-knuckle', () => spiky(0.09, 1.8), C.eye, kx, -1.35, kz, [PI / 2 - 0.3, 0, 0]);
      R.arms.push(arm);
      const leg = pivot(inner, s * 0.4, 0.72, 0);
      mesh(cached(`golem-leg:${type}`, () => M([
        P(Box(0.48, 0.6, 0.5), C.dark, { y: -0.32 }, 0.2, 0.05),
        P(Dode(0.3), C.rock, { y: -0.62, z: 0.08, sy: 0.55, sx: 1.2 }, 0.2, 0.04),
      ])), mat, leg);
      R.legs.push(leg);
    }
    if (titan) root.scale.setScalar(2.3);
  } else if (type === 'archer') {
    const bone = '#ece6d3', boneD = '#c9c1a8', cloak = '#3b2f4a';
    R.body = pivot(inner, 0, 0, 0);
    mesh(cached('skel-body', () => M([
      P(Box(0.32, 0.14, 0.2), boneD, { y: 0.9 }, 0.1),
      P(Cyl(0.04, 0.04, 0.5, 5), boneD, { y: 1.15 }),
      ...[0, 1, 2, 3].map((k) => P(new THREE.TorusGeometry(0.15 - k * 0.012, 0.022, 3, 8, PI * 1.6), bone, { y: 1.18 + k * 0.08, rx: PI / 2, rz: PI * 0.7 })),
      P(Box(0.05, 0.3, 0.03), bone, { y: 1.28, z: 0.14 }),
      P(Box(0.48, 0.07, 0.18), bone, { y: 1.45 }),
      P(Box(0.5, 0.85, 0.04), cloak, { y: 1.05, z: -0.18, rx: 0.1 }, 0.15, 0.02),
      P(Box(0.56, 0.12, 0.24), shade(cloak, 1.25), { y: 1.47, z: -0.04 }, 0.1),
      P(Cyl(0.08, 0.07, 0.5, 6), '#6b4428', { x: 0.12, y: 1.25, z: -0.28, rz: -0.35 }),
      ...[0, 1, 2].map((k) => P(Box(0.05, 0.1, 0.01), '#e8413a', { x: 0.17 + k * 0.03, y: 1.55 + k * 0.01, z: -0.28 + (k - 1) * 0.03, rz: -0.35 })),
    ])), mat, R.body);
    R.head = pivot(R.body, 0, 1.66, 0.02);
    mesh(cached('skel-head', () => M([
      P(Dode(0.17), bone, { sy: 1.05 }, 0.08, 0.01),
      P(Box(0.22, 0.1, 0.18), bone, { y: -0.1, z: 0.05 }),
      P(Box(0.18, 0.06, 0.16), boneD, { y: -0.18, z: 0.05 }),
      P(Box(0.07, 0.07, 0.03), '#141414', { x: 0.065, y: -0.01, z: 0.15 }, 0),
      P(Box(0.07, 0.07, 0.03), '#141414', { x: -0.065, y: -0.01, z: 0.15 }, 0),
      P(Box(0.14, 0.02, 0.02), '#6b6250', { y: -0.15, z: 0.14 }, 0),
      P(Half(0.24, 7, 3), cloak, { y: 0.0, z: -0.04, rx: -0.5 }, 0.15),
      P(Cone(0.08, 0.22, 5), cloak, { y: 0.2, z: -0.18, rx: -1.0 }, 0.15),
    ])), mat, R.head);
    for (const s of [1, -1]) glowPart(R.head, 'eye-skel', () => Box(0.035, 0.035, 0.02), 0x5ff1ff, s * 0.065, -0.01, 0.168);
    for (const s of [1, -1]) {
      const leg = pivot(inner, s * 0.1, 0.86, 0);
      mesh(cached('skel-leg', () => M([
        P(Cyl(0.035, 0.03, 0.4, 5), bone, { y: -0.2 }),
        P(Sph(0.045, 5, 4), boneD, { y: -0.42 }),
        P(Cyl(0.03, 0.025, 0.4, 5), bone, { y: -0.64 }),
        P(Box(0.08, 0.04, 0.16), boneD, { y: -0.85, z: 0.04 }),
      ])), mat, leg);
      R.legs.push(leg);
      const arm = pivot(R.body, s * 0.25, 1.42, 0);
      mesh(cached('skel-arm', () => M([
        P(Sph(0.05, 5, 4), boneD, {}),
        P(Cyl(0.028, 0.025, 0.3, 5), bone, { y: -0.16 }),
        P(Sph(0.035, 5, 4), boneD, { y: -0.32 }),
        P(Cyl(0.025, 0.022, 0.28, 5), bone, { y: -0.47 }),
        P(Box(0.06, 0.07, 0.05), boneD, { y: -0.63 }),
      ])), mat, arm);
      R.arms.push(arm);
    }
    mesh(itemGeometry('bow'), mat, R.arms[0], 0, -0.6, 0.05).rotation.set(PI / 2, 0, PI / 2);
  } else if (type === 'pig') {
    const fur = '#8a6450', dark = '#5e4234', snout = '#d99a8a';
    R.body = pivot(inner, 0, 0, 0);
    mesh(cached('pig-body', () => M([
      P(Box(0.62, 0.56, 0.95), fur, { y: 0.58 }, 0.12, 0.04),
      P(Box(0.5, 0.2, 0.8), shade(fur, 1.15), { y: 0.36 }, 0.1),
      ...[0, 1, 2, 3, 4].map((k) => P(Cone(0.07, 0.22, 4), dark, { y: 0.92 - k * 0.02, z: 0.36 - k * 0.18, rx: -0.4 })),
      P(Cyl(0.02, 0.02, 0.22, 4), dark, { y: 0.7, z: -0.55, rx: -0.9 }),
    ])), mat, R.body);
    R.head = pivot(R.body, 0, 0.62, 0.52);
    mesh(cached('pig-head', () => M([
      P(Box(0.46, 0.42, 0.4), fur, { y: 0.02 }, 0.1, 0.02),
      P(Box(0.5, 0.22, 0.2), dark, { y: 0.16, z: -0.08 }, 0.12, 0.03),
      P(Cyl(0.12, 0.13, 0.12, 7), snout, { y: -0.06, z: 0.26, rx: PI / 2 }),
      P(Box(0.03, 0.05, 0.02), '#4a2a2a', { x: 0.045, y: -0.05, z: 0.33 }, 0),
      P(Box(0.03, 0.05, 0.02), '#4a2a2a', { x: -0.045, y: -0.05, z: 0.33 }, 0),
      P(Cone(0.035, 0.2, 4), '#fbf6e6', { x: 0.14, y: -0.02, z: 0.28, rx: 0.4, rz: -0.5 }, 0),
      P(Cone(0.035, 0.2, 4), '#fbf6e6', { x: -0.14, y: -0.02, z: 0.28, rx: 0.4, rz: 0.5 }, 0),
      P(Box(0.12, 0.14, 0.04), dark, { x: 0.18, y: 0.26, z: -0.04, rz: -0.5 }),
      P(Box(0.12, 0.14, 0.04), dark, { x: -0.18, y: 0.26, z: -0.04, rz: 0.5 }),
      P(Box(0.05, 0.05, 0.02), '#151515', { x: 0.12, y: 0.1, z: 0.205 }, 0),
      P(Box(0.05, 0.05, 0.02), '#151515', { x: -0.12, y: 0.1, z: 0.205 }, 0),
    ])), mat, R.head);
    for (const [x, z] of [[0.18, 0.28], [-0.18, 0.28], [0.18, -0.3], [-0.18, -0.3]]) {
      const leg = pivot(inner, x, 0.34, z);
      mesh(cached('pig-leg', () => M([
        P(Box(0.14, 0.3, 0.14), fur, { y: -0.14 }),
        P(Box(0.15, 0.06, 0.16), '#2e2420', { y: -0.31 }),
      ])), mat, leg);
      R.legs.push(leg);
    }
  }
  return R;
}
