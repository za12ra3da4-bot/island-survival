// 섬 지형 — 같은 seed 면 서버와 모든 클라이언트가 똑같은 높이를 계산한다 (정수 해시 + 사칙연산만 사용)
export const SIZE = 360;
export const HALF = SIZE / 2;
export const RES = 240;
export const CELL = SIZE / RES;
export const WATER = 0;

function hash(ix, iz, seed) {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, z, seed, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * vnoise(x * f, z * f, seed + o * 101);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

const ss = (e0, e1, x) => {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};

export function heightAt(x, z, seed) {
  const d = Math.sqrt(x * x + z * z);
  const nx = d > 0 ? x / d : 0, nz = d > 0 ? z / d : 0;
  const coastR = 130 + 95 * (fbm(nx * 1.9 + 5.3, nz * 1.9 + 2.1, seed + 7, 3) - 0.5);
  const coast = ss(1.02, 0.72, d / Math.min(168, coastR));
  let e = fbm(x * 0.009 + 11, z * 0.009 - 4, seed, 5);
  e = Math.min(1, Math.max(0, (e - 0.47) * 2.3 + 0.5));
  const r = fbm(x * 0.03, z * 0.03, seed + 33, 3);
  const mtn = ss(0.55, 0.9, e);
  let land = 3 + e * 15 + mtn * mtn * 40 + (r - 0.5) * 4;
  const camp = ss(30, 12, d);
  land = land * (1 - camp) + 6.5 * camp;
  return -9 + (land + 9) * coast;
}

export class Terrain {
  constructor(seed) {
    this.seed = seed;
    const n = RES + 1;
    this.n = n;
    this.hgt = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) this.hgt[i + j * n] = heightAt(-HALF + i * CELL, -HALF + j * CELL, seed);
    }
  }

  vert(i, j) {
    return this.hgt[i + j * this.n];
  }

  // 렌더링과 같은 삼각형 분할(b-c 대각선)로 보간
  h(x, z) {
    let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    fx = fx < 0 ? 0 : fx > RES - 0.0001 ? RES - 0.0001 : fx;
    fz = fz < 0 ? 0 : fz > RES - 0.0001 ? RES - 0.0001 : fz;
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, n = this.n;
    const a = this.hgt[i + j * n], b = this.hgt[i + 1 + j * n], c = this.hgt[i + (j + 1) * n], d = this.hgt[i + 1 + (j + 1) * n];
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  slope(x, z) {
    return Math.hypot(this.h(x + 1, z) - this.h(x - 1, z), this.h(x, z + 1) - this.h(x, z - 1)) / 2;
  }
}
