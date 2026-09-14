// 충돌 — 원(나무·바위·설치물)과 회전 상자(벽), 지형 위를 걷는 몸
import { PLAYER } from './config.js';
import { HALF } from './terrain.js';

export class Colliders {
  constructor(cell = 4) {
    this.cell = cell;
    this.map = new Map();
  }

  key(ix, iz) {
    return (ix + 1000) * 4096 + (iz + 1000);
  }

  add(c) {
    const br = c.r !== undefined ? c.r : Math.hypot(c.hx, c.hz);
    const k = this.cell;
    const x0 = Math.floor((c.x - br) / k), x1 = Math.floor((c.x + br) / k);
    const z0 = Math.floor((c.z - br) / k), z1 = Math.floor((c.z + br) / k);
    c._keys = [];
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const key = this.key(x, z);
        let list = this.map.get(key);
        if (!list) this.map.set(key, (list = []));
        list.push(c);
        c._keys.push(key);
      }
    }
    return c;
  }

  remove(c) {
    if (!c || !c._keys) return;
    for (const key of c._keys) {
      const list = this.map.get(key);
      if (!list) continue;
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    c._keys = null;
  }

  query(x, z, rad, fn) {
    const k = this.cell;
    const x0 = Math.floor((x - rad) / k), x1 = Math.floor((x + rad) / k);
    const z0 = Math.floor((z - rad) / k), z1 = Math.floor((z + rad) / k);
    const seen = x1 > x0 || z1 > z0 ? new Set() : null;
    for (let zz = z0; zz <= z1; zz++) {
      for (let xx = x0; xx <= x1; xx++) {
        const list = this.map.get(this.key(xx, zz));
        if (!list) continue;
        for (const c of list) {
          if (seen) {
            if (seen.has(c)) continue;
            seen.add(c);
          }
          fn(c);
        }
      }
    }
  }
}

// 몸(원)을 충돌체 밖으로 밀어낸다. 부딪힌 충돌체를 돌려준다.
export function resolve(b, cols) {
  let hit = null;
  cols.query(b.x, b.z, b.radius + 3, (c) => {
    if (c.r !== undefined) {
      if (c.r <= 0) return;
      const dx = b.x - c.x, dz = b.z - c.z, rr = c.r + b.radius, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), p = (rr - d) / d;
        b.x += dx * p;
        b.z += dz * p;
      } else {
        b.x += rr;
      }
      hit = c;
    } else {
      const dx = b.x - c.x, dz = b.z - c.z;
      const lx = dx * c.cos + dz * c.sin, lz = -dx * c.sin + dz * c.cos;
      const px = Math.max(-c.hx, Math.min(c.hx, lx)), pz = Math.max(-c.hz, Math.min(c.hz, lz));
      const ox = lx - px, oz = lz - pz, d2 = ox * ox + oz * oz;
      if (d2 >= b.radius * b.radius) return;
      let nlx, nlz;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), p = (b.radius - d) / d;
        nlx = lx + ox * p;
        nlz = lz + oz * p;
      } else {
        const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz);
        if (ex < ez) { nlx = (lx < 0 ? -1 : 1) * (c.hx + b.radius); nlz = lz; }
        else { nlz = (lz < 0 ? -1 : 1) * (c.hz + b.radius); nlx = lx; }
      }
      b.x = c.x + nlx * c.cos - nlz * c.sin;
      b.z = c.z + nlx * c.sin + nlz * c.cos;
      hit = c;
    }
  });
  return hit;
}

export const DEEP = -1.3;

// b: {x,y,z,vx,vy,vz,onGround,radius}. 막은 충돌체(또는 'water')를 돌려준다.
export function moveBody(b, dt, terrain, cols) {
  const steps = Math.max(1, Math.ceil(dt / 0.034));
  const h = dt / steps;
  let blocked = null;
  for (let s = 0; s < steps; s++) {
    const ox = b.x, oz = b.z;
    b.x += b.vx * h;
    b.z += b.vz * h;
    const c = resolve(b, cols);
    if (c) blocked = c;
    const d = Math.hypot(b.x, b.z), lim = HALF - 6;
    if (d > lim) { b.x *= lim / d; b.z *= lim / d; }
    const g = terrain.h(b.x, b.z);
    if (g < DEEP && g < terrain.h(ox, oz)) {
      b.x = ox;
      b.z = oz;
      blocked = blocked || 'water';
    }
    b.vy -= PLAYER.gravity * h;
    b.y += b.vy * h;
    const ground = Math.max(DEEP, terrain.h(b.x, b.z));
    if (b.y <= ground) {
      b.y = ground;
      if (b.vy < 0) b.vy = 0;
      b.onGround = true;
    } else if (b.onGround && b.vy <= 0 && b.y - ground < 0.6) {
      b.y = ground;
      b.vy = 0;
    } else {
      b.onGround = false;
    }
  }
  return blocked;
}
